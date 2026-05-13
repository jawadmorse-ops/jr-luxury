import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'

/**
 * Contact section 3D backdrop — a custom GLSL fragment shader.
 *
 * Decision: the contact section deserves its own atmospheric language,
 * not a duplicate of philosophy's torus or atelier's particles. The
 * cleanest move is to bookend the page — hero opens with a shader-
 * driven nebula (energy, chaos, "the work begins"); contact closes
 * with a shader-driven CALM (resolution, stillness, "let's talk").
 *
 * Visual recipe:
 *   • Horizontal flowing bands of gold light, very slow drift
 *   • Soft vertical fbm distortion — feels like sunset light across
 *     still water, NOT like the hero's churning curl-noise
 *   • A single gentle "horizon" band at the vertical center pulses
 *     subtly — gives the eye a place to settle
 *   • Cursor parallax: extremely subtle, just enough that the field
 *     acknowledges your presence
 *   • Vignette + grain so dark edges don't band
 *
 * Why this works as a closer:
 *   • Same shader-on-plane vocabulary as the hero — visual rhyme
 *   • Calmer parameters (slower drift, more horizontal/orderly, gold-
 *     only palette) — a different mood, same craft
 *   • The form is the hero of this section; the shader is the room
 *     it sits in
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
  uniform vec2  uMouse;
  uniform vec2  uResolution;
  uniform vec3  uColorGold;
  uniform vec3  uColorDeep;
  uniform vec3  uBg;
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

  // 4-octave fbm — gentler than the hero's 5-octave; this section is
  // about calm, not energy
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    // Slow horizontal drift — much slower than the hero (0.025 vs 0.06)
    float t = uTime * 0.025;

    // Cursor parallax — very subtle (0.06 vs the hero's 0.18)
    vec2 cursorOffset = (uMouse - 0.5) * vec2(-0.06, 0.06);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) + cursorOffset;

    // Horizontal-biased noise — squashing y exaggerates horizontal
    // bands, reads as "flowing along a horizon" not churning
    vec2 q = vec2(p.x * 0.5 + t, p.y * 2.5 - t * 0.6);
    float field = fbm(q);
    float field2 = fbm(q * 1.8 - vec2(t * 0.5, t * 0.3));
    field = field * 0.7 + field2 * 0.3;

    // Start from the deep near-black bg
    vec3 col = uBg;

    // Soft gold bands — drawn where the noise field is mid-to-high
    float bandMask = smoothstep(0.40, 0.85, field);
    col = mix(col, uColorGold, bandMask * 0.35);

    // The "horizon" — a soft gold pulse centered vertically in the
    // section. Gives the eye a place to settle, anchors the form.
    float horizon = smoothstep(0.15, 0.0, abs(uv.y - 0.5));
    float horizonPulse = 0.5 + 0.5 * sin(uTime * 0.4);
    col += uColorGold * horizon * 0.18 * (0.7 + 0.3 * horizonPulse);

    // Filament highlights at the very brightest noise peaks — match
    // the hero's filament vocabulary, sparingly used here
    float filament = smoothstep(0.82, 0.96, field);
    col += uColorGold * filament * 0.55;

    // Deep undertone in the dark regions — adds dimensional warmth
    float deepMask = smoothstep(0.25, 0.0, field);
    col = mix(col, uColorDeep, deepMask * 0.30);

    // Vignette — gentler than hero (0.42 vs 0.35 inner), this isn't
    // meant to be as focused; it's atmosphere, not a focal moment
    float vig = smoothstep(1.4, 0.42, length(uv - 0.5));
    col *= mix(0.55, 1.0, vig);

    // Subtle film grain
    float grain = (hash(vUv * uResolution.xy + uTime) - 0.5) * 0.01;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`

export function initContactScene(prefersReducedMotion) {
  if (prefersReducedMotion) return null

  const section = document.getElementById('contact')
  if (!section) return null

  const canvas = document.createElement('canvas')
  canvas.className = 'contact-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  section.insertBefore(canvas, section.firstChild)

  const isMobile = window.matchMedia('(max-width: 768px)').matches
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2))
  renderer.setClearColor(0x030303, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
  camera.position.z = 1

  const uniforms = {
    uTime:        { value: 0 },
    uMouse:       { value: new THREE.Vector2(0.5, 0.5) },
    uResolution:  { value: new THREE.Vector2(1, 1) },
    uColorGold:   { value: new THREE.Color(0xC9A96E) },
    uColorDeep:   { value: new THREE.Color(0x1a1218) },  // warm dark
    uBg:          { value: new THREE.Color(0x030303) },
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

  // ── Post-processing — subtle bloom only ─────────────────
  const post = buildComposer(renderer, scene, camera, { pipeline: 'subtle', samples: 4 })

  // ── Cursor tracking with weighted lerp ──────────────────
  const targetMouse = { x: 0.5, y: 0.5 }
  if (!window.matchMedia('(pointer: coarse)').matches) {
    section.addEventListener('mousemove', (e) => {
      const r = section.getBoundingClientRect()
      targetMouse.x = (e.clientX - r.left) / r.width
      targetMouse.y = 1 - (e.clientY - r.top) / r.height
    }, { passive: true })
  }

  // ── Resize ──────────────────────────────────────────────
  function resize() {
    const w = section.offsetWidth || window.innerWidth
    const h = section.offsetHeight || window.innerHeight
    if (!w || !h) return
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    renderer.setSize(w, h, false)
    post.setSize(w, h)
    uniforms.uResolution.value.set(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(section)

  // ── Render loop ─────────────────────────────────────────
  let rafId = null
  let active = true
  const clock = new THREE.Clock()

  function tick() {
    if (!active) return
    rafId = requestAnimationFrame(tick)
    uniforms.uTime.value = clock.getElapsedTime()

    // Lerp cursor for weight
    uniforms.uMouse.value.x += (targetMouse.x - uniforms.uMouse.value.x) * 0.04
    uniforms.uMouse.value.y += (targetMouse.y - uniforms.uMouse.value.y) * 0.04

    post.composer.render()
  }

  function start() { if (!active) { active = true; tick() } }
  function stop()  { active = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null } }

  start()

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start()
      else stop()
    }, { threshold: 0, rootMargin: '200px' }).observe(section)
  }

  return {
    destroy() {
      stop()
      ro.disconnect()
      canvas.remove()
      geo.dispose()
      material.dispose()
      post.dispose()
      renderer.dispose()
    },
  }
}
