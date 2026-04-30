import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass }     from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass }     from 'three/examples/jsm/postprocessing/OutputPass.js'

const ChromaShader = {
  uniforms: {
    tDiffuse: { value: null },
    uOffset:  { value: 0.003 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    varying vec2 vUv;
    void main() {
      vec2 dir    = normalize(vUv - 0.5);
      float dist  = length(vUv - 0.5);
      vec2 offset = dir * dist * uOffset;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, texture2D(tDiffuse, vUv).a);
    }
  `,
}

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime:    { value: 0.0 },
    uAmount:  { value: 0.028 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = rand(vUv * 1500.0 + uTime) * uAmount;
      color.rgb  += grain - uAmount * 0.5;
      gl_FragColor = color;
    }
  `,
}

export function initHeroScene(prefersReducedMotion) {
  const canvas = document.getElementById('hero-canvas')
  if (!canvas) return
  if (prefersReducedMotion) return

  const isMobile      = window.matchMedia('(max-width: 768px)').matches
  const particleCount = isMobile ? 700 : 2200
  const W = window.innerWidth
  const H = window.innerHeight

  // ── Renderer ─────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias:       !isMobile,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.5))
  renderer.setSize(W, H)
  renderer.setClearColor(0x000000, 1)
  renderer.toneMapping         = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  // ── Scene + Camera ───────────────────────────────────────
  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 100)
  camera.position.z = 4.5

  scene.add(new THREE.AmbientLight(0x020408, 1))

  // ── Ghost wireframe geometry A — large icosahedron ───────
  const icoGeo   = new THREE.IcosahedronGeometry(2.4, 1)
  const icoEdges = new THREE.EdgesGeometry(icoGeo)
  const icoMat   = new THREE.LineBasicMaterial({
    color: 0x3366CC, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending,
  })
  const ico = new THREE.LineSegments(icoEdges, icoMat)
  ico.position.set(1.6, 0.4, -0.6)
  scene.add(ico)

  // ── Ghost wireframe geometry B — octahedron ──────────────
  const octGeo   = new THREE.OctahedronGeometry(1.9, 0)
  const octEdges = new THREE.EdgesGeometry(octGeo)
  const octMat   = new THREE.LineBasicMaterial({
    color: 0x7722CC, transparent: true, opacity: 0.09,
    blending: THREE.AdditiveBlending,
  })
  const oct = new THREE.LineSegments(octEdges, octMat)
  oct.position.set(-1.8, -0.4, -0.4)
  scene.add(oct)

  // ── Ghost wireframe geometry C — tetrahedron accent ──────
  const tetGeo   = new THREE.TetrahedronGeometry(1.2, 0)
  const tetEdges = new THREE.EdgesGeometry(tetGeo)
  const tetMat   = new THREE.LineBasicMaterial({
    color: 0x0099CC, transparent: true, opacity: 0.06,
    blending: THREE.AdditiveBlending,
  })
  const tet = new THREE.LineSegments(tetEdges, tetMat)
  tet.position.set(0.2, -1.6, 0.2)
  scene.add(tet)

  // ── Particles — neon palette ──────────────────────────────
  const palette = [
    new THREE.Color(0x4488FF),  // blue
    new THREE.Color(0x00AAFF),  // sky
    new THREE.Color(0x8844FF),  // purple
    new THREE.Color(0x00FFCC),  // mint
    new THREE.Color(0xC9A96E),  // gold (brand echo)
    new THREE.Color(0xffffff),  // white
    new THREE.Color(0x44CCFF),  // cyan
  ]

  const positions = new Float32Array(particleCount * 3)
  const pColors   = new Float32Array(particleCount * 3)

  for (let i = 0; i < particleCount; i++) {
    const r     = 1.6 + Math.random() * 3.8
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
    const c = palette[Math.floor(Math.random() * palette.length)]
    pColors[i * 3] = c.r; pColors[i * 3 + 1] = c.g; pColors[i * 3 + 2] = c.b
  }

  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors,   3))

  const pMat = new THREE.PointsMaterial({
    size: isMobile ? 0.032 : 0.022, vertexColors: true,
    blending: THREE.AdditiveBlending, transparent: true,
    opacity: 0.88, depthWrite: false, sizeAttenuation: true,
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)

  // ── Orbital neon point lights ─────────────────────────────
  const lightDefs = [
    { color: 0x4488FF, intensity: 5.5, distance: 12, radius: 2.8, speed:  0.38, phase: 0 },
    { color: 0x8833FF, intensity: 4.5, distance: 10, radius: 2.2, speed: -0.27, phase: Math.PI * 2 / 3 },
    { color: 0x00CCFF, intensity: 5.0, distance: 11, radius: 3.2, speed:  0.19, phase: Math.PI * 4 / 3 },
  ]
  const orbitLights = lightDefs.map(def => {
    const light = new THREE.PointLight(def.color, def.intensity, def.distance)
    scene.add(light)
    return { light, ...def, angle: def.phase }
  })

  // ── Post-processing (desktop only) ───────────────────────
  let composer   = null
  let chromaPass = null
  let grainPass  = null

  if (!isMobile) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    // Stronger bloom threshold for neon pop
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 1.4, 0.6, 0.08)
    composer.addPass(bloomPass)

    chromaPass = new ShaderPass(ChromaShader)
    chromaPass.uniforms.uOffset.value = 0.003
    composer.addPass(chromaPass)

    grainPass = new ShaderPass(GrainShader)
    composer.addPass(grainPass)

    composer.addPass(new OutputPass())
  }

  // ── Mouse parallax + velocity ────────────────────────────
  let mouseNX = 0, mouseNY = 0
  let lerpRX  = 0, lerpRY  = 0
  let prevMX  = 0, mouseVel = 0

  function onMouseMove(e) {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2
    mouseVel = Math.abs(nx - prevMX)
    prevMX   = nx
    mouseNX  = nx
    mouseNY  = (e.clientY / window.innerHeight - 0.5) * 2
  }
  function onTouchMove(e) {
    mouseNX = (e.touches[0].clientX / window.innerWidth  - 0.5) * 2
    mouseNY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2
  }
  document.addEventListener('mousemove', onMouseMove, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: true })

  // ── Resize ───────────────────────────────────────────────
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer?.setSize(w, h)
  }
  window.addEventListener('resize', onResize, { passive: true })

  let paused = false
  document.addEventListener('visibilitychange', () => { paused = document.hidden })

  // ── Animation loop ───────────────────────────────────────
  let rafId = null

  function tick(t) {
    rafId = requestAnimationFrame(tick)
    if (paused) return

    const time = t * 0.001

    ico.rotation.x = time * 0.055
    ico.rotation.y = time * 0.085
    oct.rotation.y = -time * 0.065
    oct.rotation.z =  time * 0.045
    tet.rotation.x =  time * 0.10
    tet.rotation.z = -time * 0.07

    orbitLights.forEach(o => {
      o.angle += o.speed * 0.007
      o.light.position.set(
        Math.cos(o.angle)       * o.radius,
        Math.sin(o.angle * 0.6) * o.radius * 0.44,
        Math.sin(o.angle)       * o.radius
      )
    })

    particles.rotation.y = time * 0.028
    particles.rotation.x = time * 0.011

    lerpRX += (mouseNY * 0.18 - lerpRX) * 0.048
    lerpRY += (mouseNX * 0.24 - lerpRY) * 0.048
    scene.rotation.x = lerpRX
    scene.rotation.y = lerpRY

    if (chromaPass) {
      const target = 0.003 + Math.min(mouseVel * 0.05, 0.022)
      chromaPass.uniforms.uOffset.value += (target - chromaPass.uniforms.uOffset.value) * 0.10
      mouseVel *= 0.85
    }

    if (grainPass) grainPass.uniforms.uTime.value = time * 9.0

    composer ? composer.render() : renderer.render(scene, camera)
  }

  rafId = requestAnimationFrame(tick)

  // ── Cleanup ──────────────────────────────────────────────
  function destroy() {
    if (rafId) cancelAnimationFrame(rafId)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('resize', onResize)
    composer?.dispose()
    renderer.dispose()
    ;[icoGeo, icoEdges, octGeo, octEdges, tetGeo, tetEdges, pGeo].forEach(g => g.dispose())
    ;[icoMat, octMat, tetMat, pMat].forEach(m => m.dispose())
  }

  return { destroy, camera }
}
