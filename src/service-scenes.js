import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'

// ── Service shader — vertex displacement + fresnel rim + color drift ─
//
// Each card's geometry shares this shader; per-shape config controls
// the personality (displacement amount + color pair). The result is
// three distinct "moods" instead of three identical metal primitives.

const SERVICE_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uDisplace;
  uniform float uFreq;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisp;

  // Cheap 3D hash + value-noise — adequate for low-frequency vertex
  // displacement. We don't need crystal-clean noise here, we need
  // something that breathes.
  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), u.x),
          mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), u.x),
          mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), u.x), u.y),
      u.z
    );
  }

  void main() {
    vec3 pos = position;
    float t = uTime * 0.5;
    // Two layers of displacement so the surface breathes at two cadences
    float n =
      noise3(pos * uFreq + vec3(t, t * 0.7, -t * 0.5)) * 0.65 +
      noise3(pos * uFreq * 2.1 - vec3(t * 1.2, t * 0.4, t * 0.9)) * 0.35;
    vDisp = n;
    pos += normal * n * uDisplace;

    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vPosition = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const SERVICE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColorA;     // base / shadow side
  uniform vec3 uColorB;     // highlight / rim side
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisp;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    // Tight fresnel — power=3.6 keeps rim concentrated at the silhouette
    // edge instead of blooming over the entire surface
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.6);

    // Base lit by the displacement value — high regions warmer than
    // valleys, giving organic contrast that reads as topography
    vec3 col = mix(uColorA, uColorA * 1.6, smoothstep(-0.4, 0.4, vDisp));

    // Mid-tone gold pickup at moderate angles — adds light specular
    // without becoming bloom-bait
    float midSpec = smoothstep(0.55, 0.95, 1.0 - max(dot(vNormal, viewDir), 0.0));
    col = mix(col, uColorB * 0.35, midSpec);

    // Concentrated rim — only the silhouette edge punches above 1.0
    // (this is what bloom will halate around — clean ring, not a wash)
    col += uColorB * fresnel * 0.85;

    // Subtle slow color breath
    col *= 0.92 + 0.10 * sin(uTime * 0.4 + vDisp * 4.0);

    gl_FragColor = vec4(col, 1.0);
  }
`

// Per-shape personality. Higher uDisplace = more organic/molten, lower
// = more crystalline/refined. Color pairs nudge each scene into its
// own register without breaking the unified gold-anchored palette.
const SHADER_CONFIG = {
  icosahedron: {
    // Web Design & Development — crystalline, digital
    displace: 0.06,
    freq:     1.4,
    colorA:   0x1a1820,
    colorB:   0xC9A96E,    // gold rim
  },
  torusknot: {
    // 3D & WebGL Experiences — molten, dramatic
    displace: 0.18,
    freq:     0.9,
    colorA:   0x2a1118,
    colorB:   0xE5B584,    // warm gold + slight rose lean
  },
  octahedron: {
    // Brand Identity & Strategy — refined, faceted
    displace: 0.04,
    freq:     1.1,
    colorA:   0x141214,
    colorB:   0xD4B87A,    // softer gold
  },
}

// ── Mini 3D scene for each service card ─────────────────────────────
function createServiceScene(canvas) {
  const shape = canvas.dataset.shape || 'icosahedron'
  const card  = canvas.closest('.material-card')

  // Try/catch around WebGL init — Brave's strict fingerprinting
  // shield + low-end devices can fail context creation. If it does,
  // hide the canvas so the section's CSS fallback gradient shows
  // cleanly instead of a black opaque box.
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: true,
      failIfMajorPerformanceCaveat: false,
    })
    if (renderer.getContext()?.isContextLost?.()) {
      throw new Error('WebGL context lost on init')
    }
  } catch (err) {
    canvas.style.display = 'none'
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping         = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.z = 3.4

  // No three.js lighting needed — shader bakes its own fresnel rim
  let geo
  switch (shape) {
    case 'torusknot':
      // High tube/radial segments for smooth displacement
      geo = new THREE.TorusKnotGeometry(0.7, 0.24, 220, 36, 2, 3)
      break
    case 'octahedron':
      // detail=4 → enough subdivisions for displacement to breathe
      geo = new THREE.OctahedronGeometry(1.05, 4)
      break
    default: // icosahedron
      geo = new THREE.IcosahedronGeometry(1.05, 4)
  }

  const cfg = SHADER_CONFIG[shape] ?? SHADER_CONFIG.icosahedron
  const mat = new THREE.ShaderMaterial({
    vertexShader:   SERVICE_VERTEX,
    fragmentShader: SERVICE_FRAGMENT,
    uniforms: {
      uTime:     { value: 0 },
      uDisplace: { value: cfg.displace },
      uFreq:     { value: cfg.freq },
      uColorA:   { value: new THREE.Color(cfg.colorA) },
      uColorB:   { value: new THREE.Color(cfg.colorB) },
    },
  })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  // Faint wireframe overlay catches the high-displacement peaks and
  // gives each shape a subtle "wireframe halo" that bloom amplifies
  const wireMat = new THREE.MeshBasicMaterial({
    color: cfg.colorB, wireframe: true, transparent: true, opacity: 0.06,
  })
  scene.add(new THREE.Mesh(geo, wireMat))

  // ── Mouse tilt ──────────────────────────────────────────
  let tRX = 0, tRY = 0, cRX = 0, cRY = 0

  if (card) {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect()
      tRX = ((e.clientY - r.top)  / r.height - 0.5) * 1.4
      tRY = ((e.clientX - r.left) / r.width  - 0.5) * 1.4
    }, { passive: true })
    card.addEventListener('mouseleave', () => { tRX = 0; tRY = 0 })
  }

  // ── Post-processing — subtle bloom + 4x MSAA for clean edges
  const post = buildComposer(renderer, scene, camera, { pipeline: 'subtle', samples: 4 })

  // ── Resize ──────────────────────────────────────────────
  function resize() {
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight || 200
    if (!w) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    post.setSize(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // ── Tick ────────────────────────────────────────────────
  let rafId = null
  function tick(t) {
    rafId = requestAnimationFrame(tick)
    const time = t * 0.001

    cRX += (tRX - cRX) * 0.07
    cRY += (tRY - cRY) * 0.07

    mesh.rotation.x = time * 0.22 + cRX
    mesh.rotation.y = time * 0.36 + cRY
    mat.uniforms.uTime.value = time

    post.setGrainTime(time)
    post.composer.render()
  }
  rafId = requestAnimationFrame(tick)

  return function destroy() {
    cancelAnimationFrame(rafId)
    ro.disconnect()
    post.dispose()
    renderer.dispose()
    geo.dispose()
    mat.dispose()
    wireMat.dispose()
  }
}

// ── Large ambient ring behind the Philosophy section ─────────────────
function createPhilosophyScene(canvas) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: true,
      failIfMajorPerformanceCaveat: false,
    })
    if (renderer.getContext()?.isContextLost?.()) {
      throw new Error('WebGL context lost on init')
    }
  } catch (err) {
    canvas.style.display = 'none'
    return () => {}  // no-op destroy
  }
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
  camera.position.z = 5

  const geo = new THREE.TorusGeometry(3.2, 0.012, 6, 220)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xC9A96E, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const ring1 = new THREE.Mesh(geo, mat)
  scene.add(ring1)

  const geo2 = new THREE.TorusGeometry(2.4, 0.008, 6, 180)
  const ring2 = new THREE.Mesh(geo2, mat.clone())
  ring2.rotation.x = Math.PI / 3
  scene.add(ring2)

  // Bloom-only pipeline — additive thin gold rings turn into proper
  // glowing filament when the bloom pass fattens the bright pixels.
  // 4x MSAA so the thin (radius 0.012) torus geometry doesn't show
  // staircase aliasing at retina resolutions.
  const post = buildComposer(renderer, scene, camera, { pipeline: 'background', samples: 4 })

  function resize() {
    const w = canvas.offsetWidth  || canvas.parentElement?.offsetWidth  || 800
    const h = canvas.offsetHeight || canvas.parentElement?.offsetHeight || 600
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    post.setSize(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas.parentElement || canvas)

  let rafId = null
  function tick(t) {
    rafId = requestAnimationFrame(tick)
    const time = t * 0.001
    ring1.rotation.z = time * 0.06
    ring1.rotation.y = time * 0.04
    ring2.rotation.z = -time * 0.05
    ring2.rotation.x = Math.PI / 3 + time * 0.03
    post.composer.render()
  }
  rafId = requestAnimationFrame(tick)

  return function destroy() {
    cancelAnimationFrame(rafId)
    ro.disconnect()
    post.dispose()
    renderer.dispose()
    geo.dispose()
    geo2.dispose()
    mat.dispose()
  }
}

// ── Public init ──────────────────────────────────────────────────────
export function initServiceScenes(prefersReducedMotion) {
  if (prefersReducedMotion) return

  const cleanups = []

  // Service card mini-scenes — render on every device including
  // mobile. The 3D structures ARE the signature of this section
  // (icosahedron, torusknot, octahedron with displacement + bloom).
  // Skipping them on mobile leaves a static row of text cards with
  // no premium feel. Modern phones handle three small WebGL contexts
  // fine; the DPR cap at 2 plus the shaders' tiny canvas size keeps
  // GPU cost in check.
  document.querySelectorAll('.service-canvas').forEach(canvas => {
    cleanups.push(createServiceScene(canvas))
  })

  // Philosophy ambient ring (very cheap, runs on all devices)
  const philCanvas = document.querySelector('.philosophy-canvas')
  if (philCanvas) cleanups.push(createPhilosophyScene(philCanvas))

  return () => cleanups.forEach(fn => fn?.())
}
