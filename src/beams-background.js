function createBeam(w, h) {
  return {
    x:          Math.random() * w * 1.5 - w * 0.25,
    y:          Math.random() * h * 1.5 - h * 0.25,
    width:      30 + Math.random() * 60,
    length:     h * 2.5,
    angle:      -35 + Math.random() * 10,
    speed:      0.6 + Math.random() * 1.2,
    opacity:    0.25 + Math.random() * 0.2,
    hue:        190 + Math.random() * 70,
    pulse:      Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
  }
}

function resetBeam(beam, index, total, w, h) {
  const spacing = w / 3
  const col     = index % 3
  beam.y       = h + 100
  beam.x       = col * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5
  beam.width   = 100 + Math.random() * 100
  beam.speed   = 0.5 + Math.random() * 0.4
  beam.hue     = 190 + (index * 70) / total
  beam.opacity = 0.25 + Math.random() * 0.15
}

function drawBeam(ctx, beam) {
  ctx.save()
  ctx.translate(beam.x, beam.y)
  ctx.rotate((beam.angle * Math.PI) / 180)

  const op  = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2)
  const g   = ctx.createLinearGradient(0, 0, 0, beam.length)
  const hsl = `hsla(${beam.hue}, 85%, 65%`
  g.addColorStop(0,   `${hsl}, 0)`)
  g.addColorStop(0.1, `${hsl}, ${(op * 0.5).toFixed(3)})`)
  g.addColorStop(0.4, `${hsl}, ${op.toFixed(3)})`)
  g.addColorStop(0.6, `${hsl}, ${op.toFixed(3)})`)
  g.addColorStop(0.9, `${hsl}, ${(op * 0.5).toFixed(3)})`)
  g.addColorStop(1,   `${hsl}, 0)`)

  ctx.fillStyle = g
  ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length)
  ctx.restore()
}

function mountBeams(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const TOTAL = 30
  let beams   = []
  let rafId   = null
  let active  = false
  let W = 0, H = 0

  function resize() {
    const dpr    = window.devicePixelRatio || 1
    const parent = canvas.parentElement
    W = parent.offsetWidth  || window.innerWidth
    H = parent.offsetHeight || window.innerHeight
    if (!W || !H) return

    canvas.width        = Math.round(W * dpr)
    canvas.height       = Math.round(H * dpr)
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'

    // setTransform resets + scales — avoids compounding on every resize
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    beams = Array.from({ length: TOTAL }, () => createBeam(W, H))
  }

  function tick() {
    if (!active) return

    // Use CSS-pixel dimensions for drawing (context is scaled by dpr via setTransform)
    ctx.clearRect(0, 0, W, H)
    ctx.filter = 'blur(35px)'

    beams.forEach((beam, i) => {
      beam.y     -= beam.speed
      beam.pulse += beam.pulseSpeed
      if (beam.y + beam.length < -100) resetBeam(beam, i, TOTAL, W, H)
      drawBeam(ctx, beam)
    })

    ctx.filter = 'none'
    rafId = requestAnimationFrame(tick)
  }

  function start() {
    if (!active) { active = true; tick() }
  }
  function stop() {
    active = false
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  }

  resize()
  window.addEventListener('resize', resize, { passive: true })

  // Start immediately — pause/resume when scrolled in/out of view
  start()

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => entry.isIntersecting ? start() : stop(),
      { threshold: 0 }
    ).observe(canvas.parentElement)
  }
}

export function initBeamsBackground(prefersReducedMotion) {
  if (prefersReducedMotion) return
  document.querySelectorAll('.beams-canvas').forEach(mountBeams)
}
