import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'

/**
 * Contact section 3D backdrop — a single large gold torus, slowly
 * rotating in space behind the form.
 *
 * Restraint by design:
 *   Previous iterations tried multiple expanding rings ("signal" /
 *   "transmission" metaphor — too literal, too busy) and a displaced
 *   icosphere (no thematic reason). Neither felt elegant.
 *
 *   This is one ring. One slow rotation. One subtle cursor tilt.
 *   The form is the hero of this section; the geometry is a frame.
 *
 * Why a torus and not nothing:
 *   The user wants 3D presence in every section. A single torus
 *   provides geometric stability + gives bloom something to halate
 *   around. The slow rotation feels alive without competing.
 */

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
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.z = 7

  // One ring. Generous radius, thin tube. The thin geometry barely
  // exists as solid mesh — the bloom is what makes it luminous.
  const geo = new THREE.TorusGeometry(2.4, 0.012, 8, 240)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xC9A96E,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ring = new THREE.Mesh(geo, mat)
  // Tilt the ring backward + sideways so it reads as occupying 3D
  // depth, not just a flat circle on the page
  ring.rotation.x = -0.5
  ring.rotation.z = 0.15
  scene.add(ring)

  // Post: bloom only (background preset). The whole point is to let
  // the thin geometry glow.
  const post = buildComposer(renderer, scene, camera, { pipeline: 'background', samples: 4 })

  // Cursor parallax — very subtle, just enough that you notice the
  // ring "responding" to you if you look closely
  const targetCursor = { x: 0.5, y: 0.5 }
  if (!window.matchMedia('(pointer: coarse)').matches) {
    section.addEventListener('mousemove', (e) => {
      const r = section.getBoundingClientRect()
      targetCursor.x = (e.clientX - r.left) / r.width
      targetCursor.y = (e.clientY - r.top) / r.height
    }, { passive: true })
  }
  const cursor = { x: 0.5, y: 0.5 }

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

  let rafId = null
  let active = true
  const clock = new THREE.Clock()

  function tick() {
    if (!active) return
    rafId = requestAnimationFrame(tick)
    const t = clock.getElapsedTime()

    cursor.x += (targetCursor.x - cursor.x) * 0.04
    cursor.y += (targetCursor.y - cursor.y) * 0.04

    // Slow continuous rotation on Y, small cursor parallax on X
    ring.rotation.y = t * 0.06
    ring.rotation.x = -0.5 + (cursor.y - 0.5) * 0.15

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
      mat.dispose()
      post.dispose()
      renderer.dispose()
    },
  }
}
