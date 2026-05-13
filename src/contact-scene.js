import * as THREE from 'three'
import { buildComposer } from './postprocessing.js'

/**
 * Contact section 3D backdrop — a large, slowly-rotating wireframe
 * sphere with displaced surface. Sits behind the contact form, far
 * enough back that it reads as decorative depth, close enough that
 * it gives the form section a sense of *gravity* — there's something
 * substantial behind the call-to-action.
 *
 * Why a sphere here (vs. the constellation in atelier):
 *   • Atelier is a journey (process) — constellation = network of
 *     connected ideas. Sphere wouldn't fit that.
 *   • Contact is the destination — the page's gravitational pull.
 *     A single substantial form anchors that emotionally.
 *
 * Visual notes:
 *   • Wireframe icosphere, subdivided, vertex-displaced by noise
 *   • Slow Y rotation + scroll-driven X rotation
 *   • Gold filament edges + bloom = elegant glowing skeleton
 *   • Cursor parallax slides it gently
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec3 vPosition;
  varying float vDisp;

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
    float t = uTime * 0.25;
    float n = noise3(pos * 1.4 + vec3(t, t * 0.7, -t * 0.5));
    vDisp = n;
    pos += normal * n * 0.12;
    vPosition = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec3 vPosition;
  varying float vDisp;

  void main() {
    // Warm gold base, slight color drift with displacement
    vec3 base = mix(vec3(0.55, 0.42, 0.20), vec3(0.85, 0.69, 0.40), vDisp + 0.4);
    // Subtle slow pulse
    float pulse = 0.85 + 0.15 * sin(uTime * 0.6 + vDisp * 3.0);
    gl_FragColor = vec4(base * pulse, 1.0);
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
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.z = 5

  // Wireframe icosphere — detail 4 for smooth subdivision, vertex
  // displaced in the shader so it pulses like something alive
  const geo = new THREE.IcosahedronGeometry(1.6, 4)
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uTime: { value: 0 } },
    wireframe: true,
    transparent: true,
  })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  // Inner solid icosphere — same geometry but solid (gives the
  // wireframe something to silhouette against and adds bloom-able
  // body)
  const innerMat = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vDisp;
      void main() {
        // Very dark fill, just enough to give the wireframe edges
        // a body. The bloom does the rest.
        vec3 col = vec3(0.08, 0.06, 0.04) * (vDisp + 0.4);
        gl_FragColor = vec4(col, 0.6);
      }
    `,
    uniforms: { uTime: mat.uniforms.uTime },  // share time uniform
    transparent: true,
    depthWrite: false,
  })
  const innerMesh = new THREE.Mesh(geo, innerMat)
  innerMesh.scale.setScalar(0.98)
  scene.add(innerMesh)

  // ── Post-processing ─────────────────────────────────────
  const post = buildComposer(renderer, scene, camera, { pipeline: 'subtle', samples: 4 })

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
    mat.uniforms.uTime.value = t

    // Lerp cursor for weight
    cursor.x += (targetCursor.x - cursor.x) * 0.05
    cursor.y += (targetCursor.y - cursor.y) * 0.05

    // Slow continuous rotation + cursor parallax tilt
    mesh.rotation.y = t * 0.18 + (cursor.x - 0.5) * 0.4
    mesh.rotation.x = (cursor.y - 0.5) * 0.3
    innerMesh.rotation.copy(mesh.rotation)

    // Scroll-driven scale — sphere grows slightly as section enters
    const rect = section.getBoundingClientRect()
    const total = section.offsetHeight + window.innerHeight
    const traveled = Math.max(0, window.innerHeight - rect.top)
    const progress = Math.min(1, Math.max(0, traveled / total))
    const scale = 0.85 + progress * 0.35
    mesh.scale.setScalar(scale)
    innerMesh.scale.setScalar(scale * 0.98)

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
      innerMat.dispose()
      post.dispose()
      renderer.dispose()
    },
  }
}
