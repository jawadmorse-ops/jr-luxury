import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'

/**
 * The hero's WebGL background — a custom GLSL fragment shader that
 * paints a fluid, breathing nebula in the JR brand palette (gold,
 * indigo, rose) over near-black. No 3D geometry: a single full-screen
 * triangle runs the shader.
 *
 * Visual intent:
 *  • Domain-warped fbm — fluid metal / deep nebula feel, not generic
 *    "cloudy noise"
 *  • Three drifting metaball-like color regions (gold, indigo, rose)
 *    blended into the field
 *  • Cursor warm halo follows the mouse with weighted lerp
 *  • Scroll uniform pulls the camera into the field, slowly increasing
 *    noise scale and shifting palette toward warm — feels like diving
 *    forward as the user enters the page
 *  • Vignette to keep eyes locked on the headline
 *
 * Performance:
 *  • DPR cap [1, 1.5] desktop, [1, 1] mobile
 *  • 5-octave fbm × 3 evaluations per pixel (domain warp). Modern
 *    integrated GPUs handle this at 60fps full-screen no problem
 *  • Pause via IntersectionObserver when scrolled past the hero
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
  uniform vec2  uMouse;       // 0..1 normalized, smoothed
  uniform float uScroll;      // 0..1, hero exit progress
  uniform vec2  uResolution;
  uniform vec3  uColorGold;
  uniform vec3  uColorIndigo;
  uniform vec3  uColorRose;
  uniform vec3  uBg;
  varying vec2  vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

  // Fractal Brownian Motion — 5 octaves with rotation matrix between
  // each so adjacent octaves don't axis-align (looks more organic)
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Centered, aspect-corrected coords in [-1, 1]
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uResolution.x / max(uResolution.y, 1.0);

    float t = uTime * 0.06;

    // Scroll dive — as user scrolls down, the noise scale grows
    // (perceived as moving forward into the field)
    float dive = 1.0 + uScroll * 0.55;

    // Cursor parallax — the field offsets opposite the cursor by a
    // tiny amount, simulating looking at a 3D scene through a window.
    // Cheap depth, no actual 3D needed.
    vec2 cursorOffset = (uMouse - 0.5) * vec2(-0.18, 0.18);
    vec2 p = uv * dive + cursorOffset;

    // Domain warping: q distorts the lookup, then r distorts again,
    // producing the fluid-metal / nebula quality
    vec2 q = vec2(
      fbm(p * 0.6 + vec2(t, t * 0.5)),
      fbm(p * 0.6 + vec2(-t * 0.7, t * 1.1))
    );
    vec2 r = vec2(
      fbm(p * 0.9 + q + vec2(1.7, 9.2) + t * 0.7),
      fbm(p * 0.9 + q + vec2(8.3, 2.8) - t * 0.5)
    );
    float field = fbm(p + r * 1.4);

    // Start with deep near-black background
    vec3 col = uBg;

    // Gold pulses — wherever the warp accumulated high values
    float goldMask = smoothstep(0.42, 0.92, field);
    col = mix(col, uColorGold, goldMask * 0.55);

    // Bright filament highlights — concentrated where the warp is
    // VERY high. These tiny ridges of light catch the bloom and
    // halate, giving the field a sense of volumetric depth that
    // pure fbm noise can't produce alone. Active Theory–signature
    // "streaming light" feel.
    float filament = smoothstep(0.78, 0.96, field);
    col += uColorGold * filament * 0.85;

    // Indigo veins — drawn from the inner warp magnitude, bias to the
    // upper half of the screen so it reads as cool depth above
    float indigoMask = smoothstep(0.45, 0.85, dot(r, r) * 0.55);
    indigoMask *= smoothstep(-0.3, 0.6, uv.y);
    col = mix(col, uColorIndigo, indigoMask * 0.40);

    // Indigo filament highlights — mirror the gold filaments but cooler
    float indigoFil = smoothstep(0.74, 0.92, dot(r, r) * 0.55);
    col += uColorIndigo * indigoFil * 0.45 * smoothstep(-0.2, 0.5, uv.y);

    // Rose blooms — pulled from the q-magnitude and biased lower
    float roseMask = smoothstep(0.50, 0.78, length(q));
    roseMask *= smoothstep(0.6, -0.4, uv.y);
    col = mix(col, uColorRose, roseMask * 0.30);

    // Rose filament highlights at the bottom edge — adds depth contrast
    float roseFil = smoothstep(0.72, 0.88, length(q));
    col += uColorRose * roseFil * 0.40 * smoothstep(0.5, -0.4, uv.y);

    // Cursor warm halo — molten gold pool that follows the mouse
    vec2 mp = (uMouse * 2.0 - 1.0);
    mp.x *= uResolution.x / max(uResolution.y, 1.0);
    float dCursor = distance(uv, mp);
    float halo = smoothstep(0.55, 0.0, dCursor);
    col += uColorGold * halo * 0.22;

    // Subtle warm shift on scroll — palette warms as the user dives
    col = mix(col, col * vec3(1.05, 0.96, 0.88), uScroll * 0.35);

    // Vignette — keeps eyes on the headline center, falls off to edges.
    // Slightly tighter (0.4 → 0.35 inner) so the center reads more
    // luminous against the darker edges
    float vig = smoothstep(1.5, 0.35, length(uv));
    col *= mix(0.50, 1.0, vig);

    // Subtle film grain so the dark areas don't band on cheap displays.
    float grain = (hash(vUv * uResolution.xy + uTime) - 0.5) * 0.008;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`

export function initHeroWebGL(prefersReducedMotion) {
  if (prefersReducedMotion) return null
  const canvas = document.querySelector('.hero-webgl-canvas')
  if (!canvas) return null

  const isMobile = window.matchMedia('(max-width: 768px)').matches
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  })
  // Bumped from 1.5 to 2.0 on desktop — high-DPI screens were showing
  // visible pixelation in the dark gradient regions
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2))
  renderer.setClearColor(0x030303, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
  camera.position.z = 1

  const uniforms = {
    uTime:        { value: 0 },
    uMouse:       { value: new THREE.Vector2(0.5, 0.5) },
    uScroll:      { value: 0 },
    uResolution:  { value: new THREE.Vector2(1, 1) },
    uColorGold:   { value: new THREE.Color(0xC9A96E) },
    uColorIndigo: { value: new THREE.Color(0x6366F1) },
    uColorRose:   { value: new THREE.Color(0xF43F5E) },
    uBg:          { value: new THREE.Color(0x030303) },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader:   VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    depthTest:      false,
    depthWrite:     false,
  })

  // Full-screen triangle (cheaper than a quad — one extra fragment but
  // saves rasterization work vs two triangles)
  const geo = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geo, material)
  scene.add(mesh)

  // ── Mouse tracking ──────────────────────────────────────
  const targetMouse = { x: 0.5, y: 0.5 }
  if (!window.matchMedia('(pointer: coarse)').matches) {
    window.addEventListener('mousemove', (e) => {
      targetMouse.x = e.clientX / window.innerWidth
      targetMouse.y = 1 - e.clientY / window.innerHeight
    }, { passive: true })
  }

  // ── Post-processing ─────────────────────────────────────
  // Hero gets the full pipeline: bloom + chromatic aberration + film
  // grain + tone-mapped output. This is where the cinematic gold pulses
  // turn into actual halation. samples: 4 for MSAA inside the composer
  // (essential — the renderer's antialias flag doesn't apply once we
  // render to offscreen targets in the composer chain).
  const post = buildComposer(renderer, scene, camera, { pipeline: 'hero', samples: 4 })

  // ── Resize ──────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    post.setSize(w, h)
    uniforms.uResolution.value.set(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // ── Scroll progress (0 at hero top, 1 at hero exit) + canvas
  //    bridge fade so the next section takes over visually before
  //    the user reaches the section boundary
  let lastFade = -1
  function updateScroll() {
    const hero = document.getElementById('hero')
    if (!hero) return
    const rect = hero.getBoundingClientRect()
    const traveled = Math.max(0, window.innerHeight - rect.bottom)
    const progress = Math.min(1, traveled / hero.offsetHeight)
    uniforms.uScroll.value = progress

    // Bridge fade — hero canvas opacity ramps from 1 to 0 across the
    // 55-90% scroll window. Holds full hero atmosphere longer (text
    // exits at 75%, so visuals + text overlap through the middle),
    // then fades the canvas just before the section boundary. Beams
    // ramp in around 60%, providing the visual handoff.
    const fade = progress < 0.55 ? 1 :
                 progress > 0.90 ? 0 :
                 1 - (progress - 0.55) / 0.35
    if (Math.abs(fade - lastFade) > 0.005) {
      canvas.style.opacity = fade.toFixed(3)
      lastFade = fade
    }
  }

  // ── Render loop ─────────────────────────────────────────
  let rafId = null
  let active = true
  const clock = new THREE.Clock()

  function tick() {
    if (!active) return
    rafId = requestAnimationFrame(tick)

    uniforms.uTime.value = clock.getElapsedTime()

    // Lerp mouse for weighted feel
    uniforms.uMouse.value.x += (targetMouse.x - uniforms.uMouse.value.x) * 0.06
    uniforms.uMouse.value.y += (targetMouse.y - uniforms.uMouse.value.y) * 0.06

    updateScroll()
    post.setGrainTime(uniforms.uTime.value)
    post.composer.render()
  }

  function start() {
    if (active && rafId) return
    active = true
    if (!rafId) tick()
  }
  function stop() {
    active = false
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  }

  start()

  // Pause when hero scrolls out of viewport (saves battery on phones)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => entry.isIntersecting ? start() : stop(),
      { threshold: 0 }
    ).observe(canvas.parentElement)
  }

  return {
    destroy() {
      stop()
      ro.disconnect()
      post.dispose()
      geo.dispose()
      material.dispose()
      renderer.dispose()
    },
    renderer,
    scene,
    camera,
    uniforms,
  }
}
