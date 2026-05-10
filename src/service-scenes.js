import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'

// ── Mini 3D scene for each service card ─────────────────────────────
function createServiceScene(canvas) {
  const shape = canvas.dataset.shape || 'icosahedron'
  const card  = canvas.closest('.material-card')

  // alpha: false here — we render our own dark backdrop so bloom has
  // something to bloom against. Without this, the alpha-blend output
  // washes out and the highlight halation gets clipped.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping         = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.z = 3.4

  scene.add(new THREE.AmbientLight(0xffffff, 0.12))

  const keyLight = new THREE.PointLight(0xD4A96E, 6, 12)
  keyLight.position.set(2, 3, 3)
  scene.add(keyLight)

  const rimLight = new THREE.PointLight(0xA8C4C8, 3, 8)
  rimLight.position.set(-2.5, -1, 1)
  scene.add(rimLight)

  let geo
  switch (shape) {
    case 'torusknot':
      geo = new THREE.TorusKnotGeometry(0.7, 0.24, 140, 18, 2, 3)
      break
    case 'octahedron':
      geo = new THREE.OctahedronGeometry(1.05, 0)
      break
    default: // icosahedron
      geo = new THREE.IcosahedronGeometry(1.05, 0)
  }

  const mat = new THREE.MeshStandardMaterial({
    color:     0xC9A96E,
    metalness: 0.94,
    roughness: 0.06,
  })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xD4B87A, wireframe: true, transparent: true, opacity: 0.08,
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

  // ── Post-processing — subtle bloom only for these mini scenes ───
  const post = buildComposer(renderer, scene, camera, { pipeline: 'subtle' })

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
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
  const post = buildComposer(renderer, scene, camera, { pipeline: 'background' })

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
  const isMobile = window.matchMedia('(max-width: 768px)').matches

  // Service card mini-scenes (skip on mobile for perf)
  if (!isMobile) {
    document.querySelectorAll('.service-canvas').forEach(canvas => {
      cleanups.push(createServiceScene(canvas))
    })
  }

  // Philosophy ambient ring (very cheap, runs on all devices)
  const philCanvas = document.querySelector('.philosophy-canvas')
  if (philCanvas) cleanups.push(createPhilosophyScene(philCanvas))

  return () => cleanups.forEach(fn => fn?.())
}
