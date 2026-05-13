import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'
import { isWebGLFunctional } from './webgl-detect.js'

/**
 * Atelier section 3D backdrop — a scroll-driven particle constellation.
 *
 * Why this section needs 3D:
 *   The process section (Discovery → Strategy → Development → Testing
 *   → Launch) was a static text column with the global beams behind it.
 *   That's not AT-tier; we need motion behind the text that feels alive.
 *
 * What it is:
 *   • 220 small luminous points distributed in 3D space, slowly drifting
 *   • Lines drawn between nearby points (the "constellation" feel) —
 *     these flicker in/out as points move past each other
 *   • Camera dollies forward subtly with scroll, creating depth parallax
 *   • Bloom on the points makes them halate like distant city lights
 *
 * Performance:
 *   • Points: 220 (well within budget for mobile GPUs)
 *   • Lines computed in JS each frame — capped to nearest-neighbor only
 *   • Pauses via IntersectionObserver when section scrolls out
 */

const PALETTE = [
  new THREE.Color(0xC9A96E),  // gold
  new THREE.Color(0xD4B87A),  // soft gold
  new THREE.Color(0xA8C4C8),  // cool cyan accent
  new THREE.Color(0xE5B584),  // warm rose-gold
]

export function initAtelierScene(prefersReducedMotion) {
  if (prefersReducedMotion) return null
  // Bail if WebGL is silently neutralized (Brave strict shield etc.).
  // The #atelier CSS gradient handles atmosphere when this is gone.
  if (!isWebGLFunctional()) return null

  const section = document.getElementById('atelier')
  if (!section) return null

  // Mount canvas as backdrop — same pattern as philosophy-canvas
  const canvas = document.createElement('canvas')
  canvas.className = 'atelier-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  section.insertBefore(canvas, section.firstChild)

  const isMobile = window.matchMedia('(max-width: 768px)').matches
  // Try/catch around WebGL init — Brave strict shield + ancient GPUs
  // can fail. Hide the canvas on failure so the #atelier CSS fallback
  // gradient shows through cleanly.
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.z = 8

  // ── Particle constellation ──────────────────────────────
  const POINT_COUNT = isMobile ? 140 : 220
  const positions = new Float32Array(POINT_COUNT * 3)
  const colors = new Float32Array(POINT_COUNT * 3)
  const velocities = new Float32Array(POINT_COUNT * 3)

  for (let i = 0; i < POINT_COUNT; i++) {
    // Distribute in a wide, vertically tall volume — matches the
    // section's natural shape (vertical process list)
    positions[i * 3 + 0] = (Math.random() - 0.5) * 12
    positions[i * 3 + 1] = (Math.random() - 0.5) * 14
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4

    // Slow random drift
    velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.004
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.004
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002

    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
    colors[i * 3 + 0] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  const pointGeo = new THREE.BufferGeometry()
  pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  pointGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const pointMat = new THREE.PointsMaterial({
    size: 0.05,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const points = new THREE.Points(pointGeo, pointMat)
  scene.add(points)

  // ── Constellation lines ─────────────────────────────────
  // Connect points that are within `MAX_DIST` of each other — feels
  // like a living network instead of a static dot field
  const MAX_DIST = isMobile ? 1.4 : 1.7
  const MAX_LINES = isMobile ? 240 : 420
  const linePositions = new Float32Array(MAX_LINES * 6)
  const lineColors = new Float32Array(MAX_LINES * 6)

  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  scene.add(lines)

  // ── Post-processing — bloom only (background preset) ────
  const post = buildComposer(renderer, scene, camera, { pipeline: 'background', samples: 4 })

  // ── Resize ──────────────────────────────────────────────
  function resize() {
    const w = section.offsetWidth || canvas.offsetWidth || window.innerWidth
    const h = section.offsetHeight || canvas.offsetHeight || window.innerHeight
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

  // ── Compute line segments each frame ────────────────────
  function rebuildLines() {
    let lineIdx = 0
    const maxDistSq = MAX_DIST * MAX_DIST
    for (let i = 0; i < POINT_COUNT; i++) {
      const ix = positions[i * 3], iy = positions[i * 3 + 1], iz = positions[i * 3 + 2]
      const ir = colors[i * 3], ig = colors[i * 3 + 1], ib = colors[i * 3 + 2]
      // Inner loop walks forward only (avoid double-counting pairs)
      for (let j = i + 1; j < POINT_COUNT && lineIdx < MAX_LINES; j++) {
        const dx = positions[j * 3] - ix
        const dy = positions[j * 3 + 1] - iy
        const dz = positions[j * 3 + 2] - iz
        const dSq = dx * dx + dy * dy + dz * dz
        if (dSq > maxDistSq) continue
        // Fade line strength with distance — closer = brighter
        const strength = 1.0 - Math.sqrt(dSq) / MAX_DIST
        const base = lineIdx * 6
        linePositions[base + 0] = ix
        linePositions[base + 1] = iy
        linePositions[base + 2] = iz
        linePositions[base + 3] = positions[j * 3]
        linePositions[base + 4] = positions[j * 3 + 1]
        linePositions[base + 5] = positions[j * 3 + 2]
        // Average the two endpoints' colors and scale by strength
        const r = (ir + colors[j * 3]) * 0.5 * strength
        const g = (ig + colors[j * 3 + 1]) * 0.5 * strength
        const b = (ib + colors[j * 3 + 2]) * 0.5 * strength
        lineColors[base + 0] = r
        lineColors[base + 1] = g
        lineColors[base + 2] = b
        lineColors[base + 3] = r
        lineColors[base + 4] = g
        lineColors[base + 5] = b
        lineIdx++
      }
    }
    // Zero out unused slots so they don't render as stray geometry
    for (let i = lineIdx * 6; i < MAX_LINES * 6; i++) {
      linePositions[i] = 0
      lineColors[i] = 0
    }
    lineGeo.attributes.position.needsUpdate = true
    lineGeo.attributes.color.needsUpdate = true
    lineGeo.setDrawRange(0, lineIdx * 2)
  }

  // ── Render loop ─────────────────────────────────────────
  let rafId = null
  let active = true

  function tick() {
    if (!active) return
    rafId = requestAnimationFrame(tick)

    // Drift particles
    for (let i = 0; i < POINT_COUNT; i++) {
      const px = i * 3
      positions[px + 0] += velocities[px + 0]
      positions[px + 1] += velocities[px + 1]
      positions[px + 2] += velocities[px + 2]
      // Wrap so the constellation never thins out at edges
      if (positions[px + 0] > 6) positions[px + 0] = -6
      if (positions[px + 0] < -6) positions[px + 0] = 6
      if (positions[px + 1] > 7) positions[px + 1] = -7
      if (positions[px + 1] < -7) positions[px + 1] = 7
      if (positions[px + 2] > 2) positions[px + 2] = -2
      if (positions[px + 2] < -2) positions[px + 2] = 2
    }
    pointGeo.attributes.position.needsUpdate = true

    // Recompute lines (this is the cost-heavy part — ~O(n²/2))
    rebuildLines()

    // Camera dolly with scroll — read scroll position once per frame
    const rect = section.getBoundingClientRect()
    const total = section.offsetHeight + window.innerHeight
    const traveled = Math.max(0, window.innerHeight - rect.top)
    const progress = Math.min(1, Math.max(0, traveled / total))
    camera.position.z = 8 - progress * 1.6   // dolly forward 1.6 units
    camera.position.y = -progress * 0.8      // slight downward tilt

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
      pointGeo.dispose()
      pointMat.dispose()
      lineGeo.dispose()
      lineMat.dispose()
      post.dispose()
      renderer.dispose()
    },
  }
}
