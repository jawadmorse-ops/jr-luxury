import * as THREE from 'three'

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
    // feel, not a grid. Hues interleave cyan/gold/rose so palette
    // never reads monotone.
    vec3 hueWarm   = vec3(0.79, 0.66, 0.43);   // gold
    vec3 hueCold   = vec3(0.42, 0.62, 0.78);   // cyan
    vec3 hueAccent = vec3(0.96, 0.45, 0.55);   // rose

    float r1 = ray(uv, 0.12, 0.10, scrollY);
    float r2 = ray(uv, 0.34, 0.16, scrollY * 1.3);
    float r3 = ray(uv, 0.50, 0.08, scrollY * 0.8);
    float r4 = ray(uv, 0.68, 0.13, scrollY * 1.1);
    float r5 = ray(uv, 0.85, 0.09, scrollY * 0.95);
    float r6 = ray(uv, 0.93, 0.18, scrollY * 1.4);

    // Beam brightness — tuned so the rays read clearly against the
    // near-black background but don't compete with hero/service WebGL
    vec3 col = vec3(0.0);
    col += hueCold   * r1 * 1.10;
    col += hueWarm   * r2 * 1.40;
    col += hueAccent * r3 * 0.95;
    col += hueWarm   * r4 * 1.25;
    col += hueCold   * r5 * 1.00;
    col += hueAccent * r6 * 1.10;

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

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  })
  const isMobile = window.matchMedia('(max-width: 768px)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.25))
  renderer.setClearColor(0x030303, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
  camera.position.z = 1

  const uniforms = {
    uTime:       { value: 0 },
    uScroll:     { value: 0 },
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

  const clock = new THREE.Clock()
  let rafId = null
  const hero = document.getElementById('hero')
  let lastHidden = null

  function tick() {
    rafId = requestAnimationFrame(tick)
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uScroll.value = window.scrollY
    renderer.render(scene, camera)

    // Visibility check inline with render — runs every frame, works
    // regardless of scroll event source (native, Lenis, programmatic).
    // Reveal beams once user has scrolled past 60% of the hero.
    if (hero) {
      const trigger = hero.offsetTop + hero.offsetHeight * 0.6
      const hidden = window.scrollY < trigger
      if (hidden !== lastHidden) {
        lastHidden = hidden
        canvas.style.opacity = hidden ? '0' : '1'
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
