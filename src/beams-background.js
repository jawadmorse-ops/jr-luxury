import * as THREE from 'three'
import { isWebGLFunctional } from './webgl-detect.js'

/**
 * Global GLSL beams — replaces the per-section 2D-canvas implementation
 * with a single fragment shader that renders drifting god-rays in the
 * JR brand palette. Mounted ONCE as a fixed position canvas at body
 * level so it persists across the whole page (no re-init per section,
 * one WebGL context instead of six).
 *
 * Visual intent:
 *  • Vertical god-rays drifting upward, similar feel to the previous
 *    2D beams but with shader-driven smooth gradients and depth
 *  • Hue band that drifts cyan → gold → rose across the rays so the
 *    palette never feels static
 *  • Darker low region at bottom, brighter peaks toward top — reads
 *    as light streaming downward from above
 *  • Scroll-aware uniform shifts the noise field as user scrolls so
 *    rays don't feel "stuck to the screen"
 *  • Z-index sits behind all content; the hero's opaque WebGL canvas
 *    naturally covers it during the hero section, so beams only show
 *    in the dark content sections (which is what we want)
 */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uScroll;
  uniform float uProgress;   // 0 → top of page, 1 → bottom
  uniform vec2  uResolution;
  varying vec2  vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // 3-octave fbm — cheap; we want soft drift, not detail
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  // Single vertical god-ray. x0 is column center in normalized [0,1]
  // x. width is column half-width. Brightest along center, fades to
  // nothing at ±width.
  float ray(vec2 uv, float x0, float width, float scrollY) {
    float dx = abs(uv.x - x0);
    float profile = smoothstep(width, 0.0, dx);
    // Vertical falloff — fbm-modulated so each ray flickers
    // independently, scrolled with page so they don't feel pinned
    float n = fbm(vec2(x0 * 17.3, uv.y * 2.0 + scrollY + uTime * 0.06));
    float vert = mix(0.55, 1.0, n);
    // Long vertical taper — bright top, fading toward bottom
    vert *= smoothstep(-0.1, 0.6, uv.y);
    return profile * vert;
  }

  void main() {
    vec2 uv = vUv;
    float scrollY = uScroll * 0.0009;

    // Six rays at varied positions/widths — chosen for organic
    // feel, not a grid. Hue triplet biases with uProgress so the
    // palette walks cool → warm → rose as the visitor descends:
    //   • Top sections (philosophy / materials): cooler, cyan-led
    //   • Middle (atelier / testimonials): warm gold dominant
    //   • Bottom (contact / footer): rose accents emerge
    vec3 hueWarm = mix(
      vec3(0.74, 0.62, 0.42),   // dimmer gold up top
      vec3(0.84, 0.70, 0.46),   // brighter gold lower
      uProgress
    );
    vec3 hueCold = mix(
      vec3(0.42, 0.66, 0.82),   // saturated cyan up top
      vec3(0.32, 0.54, 0.72),   // dimmer cyan lower (recedes)
      uProgress
    );
    vec3 hueAccent = mix(
      vec3(0.86, 0.42, 0.50),   // soft rose up top
      vec3(1.00, 0.50, 0.58),   // punchy rose lower
      uProgress
    );

    float r1 = ray(uv, 0.12, 0.10, scrollY);
    float r2 = ray(uv, 0.34, 0.16, scrollY * 1.3);
    float r3 = ray(uv, 0.50, 0.08, scrollY * 0.8);
    float r4 = ray(uv, 0.68, 0.13, scrollY * 1.1);
    float r5 = ray(uv, 0.85, 0.09, scrollY * 0.95);
    float r6 = ray(uv, 0.93, 0.18, scrollY * 1.4);

    // Beam brightness — dialed back so they're an atmosphere, not a
    // wall. Was washing out card text on top of them; halved the
    // multipliers so the rays whisper instead of shout.
    vec3 col = vec3(0.0);
    col += hueCold   * r1 * 0.55;
    col += hueWarm   * r2 * 0.70;
    col += hueAccent * r3 * 0.48;
    col += hueWarm   * r4 * 0.62;
    col += hueCold   * r5 * 0.50;
    col += hueAccent * r6 * 0.55;

    // Slow horizontal hue drift — palette breathes across rays
    float drift = 0.5 + 0.5 * sin(uTime * 0.18);
    col *= mix(vec3(1.05, 0.96, 0.86), vec3(0.86, 0.96, 1.05), drift);

    // Edge fade so rays don't feel cut off at viewport edges
    float edge = smoothstep(0.0, 0.05, uv.x) * smoothstep(0.0, 0.05, 1.0 - uv.x);
    col *= edge;

    gl_FragColor = vec4(col, 1.0);
  }
`

let _instance = null

export function initBeamsBackground(prefersReducedMotion) {
  if (prefersReducedMotion) return null
  if (_instance) return _instance
  // Brave strict shield etc. — skip the global beams entirely, let
  // each section's CSS gradient fallback be the visual
  if (!isWebGLFunctional()) return null

  // Hide all the old per-section 2D beam canvases — they stay in DOM
  // for backward compat (some scroll triggers may reference them)
  // but no longer render anything
  document.querySelectorAll('.beams-canvas').forEach(c => {
    c.style.display = 'none'
  })

  // Create the ONE shared canvas
  const canvas = document.createElement('canvas')
  canvas.id = 'global-beams-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.insertBefore(canvas, document.body.firstChild)

  // Try/catch around WebGL init — gracefully fail on Brave strict
  // shield. The beams are decorative; if they can't render, removing
  // the canvas entirely lets the per-section CSS gradients shine
  // without competition.
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    })
    if (renderer.getContext()?.isContextLost?.()) {
      throw new Error('WebGL context lost on init')
    }
  } catch (err) {
    canvas.remove()
    return null
  }
  const isMobile = window.matchMedia('(max-width: 768px)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.25))
  renderer.setClearColor(0x030303, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
  camera.position.z = 1

  const uniforms = {
    uTime:       { value: 0 },
    uScroll:     { value: 0 },
    uProgress:   { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader:   VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    depthTest:      false,
    depthWrite:     false,
  })

  const geo = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geo, material)
  scene.add(mesh)

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    uniforms.uResolution.value.set(w, h)
  }
  resize()
  window.addEventListener('resize', resize, { passive: true })

  // plain timestamp instead of THREE.Clock (deprecated in r184)
  const t0 = performance.now()
  let rafId = null
  const hero = document.getElementById('hero')
  let lastHidden = null

  function tick() {
    rafId = requestAnimationFrame(tick)
    uniforms.uTime.value = (performance.now() - t0) * 0.001
    uniforms.uScroll.value = window.scrollY
    // Scroll progress 0..1 — drives cool → warm → rose palette walk.
    // Clamped because some browsers report scrollY past max during
    // overscroll bounce.
    const max = document.documentElement.scrollHeight - window.innerHeight
    uniforms.uProgress.value = Math.max(0, Math.min(1, max > 0 ? window.scrollY / max : 0))
    renderer.render(scene, camera)

    // Visibility check inline with render — runs every frame, works
    // regardless of scroll event source (native, Lenis, programmatic).
    // Reveal beams once user has scrolled past 60% of the hero.
    // JS owns the target opacity for BOTH breakpoints — the old mobile
    // CSS `opacity: .35 !important` beat these inline writes, so beams
    // could never actually hide on phones.
    if (hero) {
      const trigger = hero.offsetTop + hero.offsetHeight * 0.6
      const hidden = window.scrollY < trigger
      if (hidden !== lastHidden) {
        lastHidden = hidden
        canvas.style.opacity = hidden ? '0' : (isMobile ? '0.35' : '1')
      }
    }
  }
  tick()

  // Visibility is now driven by the render tick (runs every frame),
  // not by scroll events. See tick() above.

  _instance = {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
      window.removeEventListener('resize', resize)
      canvas.remove()
      geo.dispose()
      material.dispose()
      renderer.dispose()
      _instance = null
    },
  }
  return _instance
}
