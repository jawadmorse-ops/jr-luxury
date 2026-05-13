import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'

/**
 * Contact section 3D backdrop — concentric pulsing rings emanating
 * outward, like a transmission signal.
 *
 * Why this over a static shape:
 *   The previous icosphere was decorative but thematically empty.
 *   Contact is the page's call-to-action — "reach out, get in touch."
 *   Concentric rings expanding outward = signal, transmission, the
 *   *act* of reaching. Visually says what the section is for.
 *
 * Construction:
 *   • 5 thin gold torus rings at different radii
 *   • Each ring slowly scales outward on a phase-offset loop —
 *     when one fades at the outer edge, the next is expanding from
 *     the center. Continuous "ping" rhythm.
 *   • Opacity fades with scale so rings dissolve as they expand
 *   • Slow Y rotation on the whole group adds three-dimensionality
 *   • Cursor parallax tilts the rings — they "lean toward" the user
 *   • Bloom makes the thin geometry glow like neon filament
 */

const RING_COUNT = 5
const RING_CYCLE_DURATION = 6.0   // seconds for one full expansion
const MAX_SCALE = 4.2              // outermost scale before reset
const MIN_SCALE = 0.4

export function initContactScene(prefersReducedMotion) {
  if (prefersReducedMotion) return null

  const section = document.getElementById('contact')
  if (!section) return null

  const canvas = document.createElement('canvas')
  canvas.className = 'contact-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  section.insertBefore(canvas, section.firstChild)

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.z = 6

  // Parent group so we can rotate the whole transmission as one unit
  const group = new THREE.Group()
  scene.add(group)

  // ── Build the rings ─────────────────────────────────────
  // Thin torus geometry (radius 1, tube 0.018 — barely visible
  // outline, the bloom does the heavy lifting). Slightly tilted
  // backward so they read as receding into depth.
  const ringGeo = new THREE.TorusGeometry(1, 0.018, 8, 180)
  const baseMat = new THREE.MeshBasicMaterial({
    color: 0xC9A96E,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const rings = []
  for (let i = 0; i < RING_COUNT; i++) {
    const mat = baseMat.clone()
    const ring = new THREE.Mesh(ringGeo, mat)
    ring.rotation.x = -0.35  // subtle backward tilt — depth cue
    // Phase offset evenly across the cycle so rings cascade
    ring.userData.phase = (i / RING_COUNT) * RING_CYCLE_DURATION
    rings.push(ring)
    group.add(ring)
  }

  // ── Post-processing: bloom only, generous ───────────────
  const post = buildComposer(renderer, scene, camera, { pipeline: 'background', samples: 4 })

  // ── Cursor parallax ─────────────────────────────────────
  const targetCursor = { x: 0.5, y: 0.5 }
  if (!window.matchMedia('(pointer: coarse)').matches) {
    section.addEventListener('mousemove', (e) => {
      const r = section.getBoundingClientRect()
      targetCursor.x = (e.clientX - r.left) / r.width
      targetCursor.y = (e.clientY - r.top) / r.height
    }, { passive: true })
  }
  const cursor = { x: 0.5, y: 0.5 }

  // ── Resize ──────────────────────────────────────────────
  function resize() {
    const w = section.offsetWidth || window.innerWidth
    const h = section.offsetHeight || window.innerHeight
    if (!w || !h) return
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    post.setSize(w, h)
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
    const t = clock.getElapsedTime()

    // Cursor lerp
    cursor.x += (targetCursor.x - cursor.x) * 0.05
    cursor.y += (targetCursor.y - cursor.y) * 0.05

    // Group: slow Y rotation + cursor parallax
    group.rotation.y = t * 0.08 + (cursor.x - 0.5) * 0.5
    group.rotation.x = -0.1 + (cursor.y - 0.5) * 0.25

    // Each ring: scale outward on its own phase, fade with scale
    rings.forEach((ring) => {
      const localT = ((t + ring.userData.phase) % RING_CYCLE_DURATION) / RING_CYCLE_DURATION
      // Eased outward — fast start, slow end, mimics how a signal
      // wave attenuates
      const eased = 1.0 - Math.pow(1.0 - localT, 2.5)
      const scale = MIN_SCALE + eased * (MAX_SCALE - MIN_SCALE)
      ring.scale.setScalar(scale)
      // Fade out as ring approaches max scale (the "dissipation")
      const fade = 1.0 - Math.pow(localT, 1.8)
      ring.material.opacity = 0.9 * fade
    })

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
      ringGeo.dispose()
      baseMat.dispose()
      rings.forEach(r => r.material.dispose())
      post.dispose()
      renderer.dispose()
    },
  }
}
