import './style.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { initServiceScenes }    from './service-scenes.js'
import { initBeamsBackground }  from './beams-background.js'
import { initHeroWebGL }        from './hero-webgl.js'
import { createElement }  from 'react'
import { createRoot }     from 'react-dom/client'
import { HeroGeometric }  from './components/HeroGeometric.jsx'
import { initI18n, t }   from './i18n.js'

gsap.registerPlugin(ScrollTrigger)

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isTouch = window.matchMedia('(hover: none)').matches

if (prefersReducedMotion) gsap.globalTimeline.timeScale(50)

// ─── Lenis smooth scroll ───────────────────────────────
//
// One Lenis instance for the whole app, exposed on window so any
// component can scrollTo() through it (anchor links, footer "back to
// top", future programmatic moves). Driven by GSAP's ticker so any
// ScrollTrigger pin/scrub stays perfectly in phase with the smooth
// scroll position. Reduce-motion users skip Lenis entirely and fall
// back to native instant scroll — no surprise inertial behavior.
let lenis = null
if (!prefersReducedMotion) {
  lenis = new Lenis({
    // 0.1 = warm/cinematic. Higher = snappier. AT-tier sites land here.
    lerp: 0.1,
    duration: 1.2,
    smoothWheel: true,
    // Touch keeps native momentum — Lenis only intercepts wheel.
    syncTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 1,
  })
  // Drive Lenis raf via GSAP ticker so ScrollTrigger and Lenis share
  // a single clock. lagSmoothing(0) prevents the catch-up jump after
  // a tab returns from background.
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  // ScrollTrigger refresh on every Lenis scroll event ensures pins
  // and scrubs use Lenis-driven scroll values, not native scrollY.
  lenis.on('scroll', ScrollTrigger.update)
  // Expose for anchor-link handler + future programmatic use
  window.__lenis = lenis
}

let _heroReactRoot = null

function renderHero() {
  if (!_heroReactRoot) return
  _heroReactRoot.render(
    createElement(HeroGeometric, {
      badge:    t('hero.badge'),
      title1:   t('hero.title1'),
      title2:   t('hero.title2'),
      subtitle: t('hero.subtitle'),
      cta1:     t('hero.cta1'),
      cta2:     t('hero.cta2'),
    })
  )
}

window.addEventListener('DOMContentLoaded', () => {
  // Mount the React HeroGeometric component
  const heroRootEl = document.getElementById('hero-react-root')
  if (heroRootEl) {
    _heroReactRoot = createRoot(heroRootEl)
    renderHero()
  }

  initI18n(renderHero)
  initHeroWebGL(prefersReducedMotion)
  initBeamsBackground(prefersReducedMotion)
  initResizeRefresh()
  initPreloader()
  initServiceScenes(prefersReducedMotion)
  initCursor()
  initScrollProgress()
  initHeroParticles()
  initMagneticNav()
  initKineticType()
  initScrollReveal()
  initProductReveal()
  initNav()
  initMobileMenu()
  initSmoothScroll()
  initForm()
  initFooter()
})

// ─── Refresh ScrollTrigger on monitor/DPI switch ───────
function initResizeRefresh() {
  let timer
  window.addEventListener('resize', () => {
    clearTimeout(timer)
    timer = setTimeout(() => ScrollTrigger.refresh(true), 200)
  }, { passive: true })
}

// ─── Preloader — GSAP timeline ─────────────────────────
function initPreloader() {
  const el = document.getElementById('preloader')
  if (!el) return

  // Set hero element initial states now — preloader covers them so no flash
  gsap.set('.hero-corner',     { width: 0, height: 0 })
  gsap.set('.hl-inner',        { yPercent: 110 })
  gsap.set('.hero-side-label', { opacity: 0, y: -24 })
  gsap.set('.hero-ticker',     { opacity: 0, y: 14 })

  if (prefersReducedMotion) {
    el.style.display = 'none'
    document.body.style.overflow = ''
    heroEntrance()
    return
  }

  document.body.style.overflow = 'hidden'

  gsap.timeline({
    onComplete() { document.body.style.overflow = ''; heroEntrance() },
  })
    .fromTo('.pl-mono',
      { opacity: 0, letterSpacing: '0.9em', filter: 'blur(18px)' },
      { opacity: 1, letterSpacing: '0.55em', filter: 'blur(0px)', duration: 2, ease: 'expo.out' }
    )
    .fromTo('.pl-tag',  { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power2.out' }, '-=0.8')
    .fromTo('.pl-bar',  { opacity: 0 },        { opacity: 1, duration: 0.4 }, '-=0.5')
    .fromTo('.pl-fill', { scaleX: 0 },         { scaleX: 1, duration: 1.4, transformOrigin: 'left center', ease: 'power2.inOut' }, '<')
    .to('#preloader', {
      yPercent: -105,
      duration: 0.9,
      ease: 'power3.in',
      delay: 0.3,
      onComplete() { el.style.display = 'none' },
    })
}

// ─── Hero entrance — runs after preloader exits ────────
function heroEntrance() {
  if (prefersReducedMotion) {
    gsap.set('.hero-corner', { width: 42, height: 42 })
    gsap.set('.hl-inner', { yPercent: 0 })
    gsap.set(['.hero-side-label', '.hero-ticker'], { opacity: 1, y: 0 })
    return
  }

  const tl = gsap.timeline()

  tl.to('.hero-corner',     { width: 42, height: 42, duration: 0.85, stagger: 0.08, ease: 'expo.out' })
    .to('.hero-side-label', { opacity: 1, y: 0, duration: 1.2, stagger: 0.15, ease: 'expo.out' }, '-=0.5')
    .to('.hero-ticker',     { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, '<')
}


// ─── Hero scroll zoom — camera dives into the scene ───
function initHeroScrollZoom(heroCtrl) {
  if (!heroCtrl?.camera || prefersReducedMotion) return
  gsap.to(heroCtrl.camera.position, {
    z: 1.4,
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start:   'top top',
      end:     'bottom top',
      scrub:   2.5,
    },
  })
}

// ─── Kinetic typography — ScrollTrigger scrub ─────────
//
// Hero lines drift apart in opposite directions as you scroll.
// Each h2 wipes up out of its overflow:hidden container.
// Eyebrows slide in from the side. Stat numbers scale in.
function initKineticType() {
  if (prefersReducedMotion) return

  // Side labels fade-lift on scroll
  gsap.to('.hero-side-label', {
    y: -55, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: '18% top', end: '68% top', scrub: 1 },
  })
  // Ticker fades out without y movement (it's pinned to bottom: 0)
  gsap.to('.hero-ticker', {
    opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: '22% top', end: '55% top', scrub: 1 },
  })

  // Watermark parallax — drifts upward at 0.28× scroll speed
  gsap.to('.hero-watermark', {
    y: '22%', ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
  })

  // Corners fade on scroll
  gsap.to('.hero-corner', {
    opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: '10% top', end: '55% top', scrub: true },
  })

  // Particles float upward slightly
  gsap.to('.hero-particles', {
    y: '-12%', ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
  })

  // Section h2 kinetic reveal — each wipes up from overflow:hidden parent
  gsap.utils.toArray([
    '.section-header h2',
    '.philosophy-text h2',
    '.contact-text h2',
    '.testimonial-inner blockquote p',
  ]).forEach(el => {
    gsap.from(el, {
      yPercent: 35, opacity: 0, duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    })
  })

  // Section eyebrows slide in from left
  gsap.utils.toArray('.section-eyebrow').forEach(el => {
    gsap.from(el, {
      opacity: 0, x: -22, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 92%' },
    })
  })

  // Stat numbers: kinetic scale-in
  gsap.utils.toArray('.stat-number').forEach(el => {
    const raw   = el.textContent.trim()
    const value = parseFloat(raw)
    const suf   = raw.replace(/[\d.]/g, '')
    if (!value) return

    const proxy = { val: 0 }
    gsap.to(proxy, {
      val: value,
      duration: 1.8,
      ease: 'power3.out',
      onUpdate() {
        el.textContent = (Number.isInteger(value)
          ? Math.round(proxy.val)
          : proxy.val.toFixed(1)) + suf
      },
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
    })

    gsap.from(el, {
      scale: 0.55, opacity: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
    })
  })
}

// ─── Generic scroll reveals ────────────────────────────
//
// Replaces the old IntersectionObserver + .visible class approach.
// Gold section rules are triggered the same way they were before.
function initScrollReveal() {
  // Gold rule on section headers
  ScrollTrigger.batch('.section-header', {
    onEnter: batch => batch.forEach(el => el.classList.add('rule-visible')),
    start: 'top 78%',
  })

  const revealTargets = [...document.querySelectorAll('.reveal')]

  ScrollTrigger.batch(revealTargets, {
    onEnter: batch => {
      gsap.to(batch, {
        opacity: 1, y: 0,
        duration: 1.05, stagger: 0.09, ease: 'expo.out', overwrite: true,
      })
    },
    start: 'top 88%',
  })

  // Philosophy stats bar (each stat slides in)
  gsap.from('.stat', {
    opacity: 0, y: 20, duration: 0.9, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.philosophy-stats', start: 'top 80%' },
  })

  // Testimonial quote mark
  gsap.from('.quote-mark', {
    opacity: 0, scale: 0.7, duration: 1, ease: 'expo.out',
    scrollTrigger: { trigger: '.quote-mark', start: 'top 85%' },
  })

}

// ─── Product card 3D rotation reveals ─────────────────
//
// Material cards rotate in on X-axis — like picking a card off a table.
// Philosophy card rotates slightly on Y — like a page turning.
// Process steps stagger in from the left.
function initProductReveal() {
  if (prefersReducedMotion) return

  // Material cards
  gsap.from('.material-card', {
    rotateX: 12, y: 64, opacity: 0,
    duration: 1.1, stagger: 0.16, ease: 'expo.out',
    transformOrigin: 'top center',
    scrollTrigger: { trigger: '.materials-grid', start: 'top 75%' },
  })

  // Philosophy card — gentle Y-rotation "page turn" feel
  gsap.from('.philosophy-card', {
    rotateY: -10, x: -44, opacity: 0,
    duration: 1.3, ease: 'expo.out',
    scrollTrigger: { trigger: '.philosophy-card', start: 'top 80%' },
  })

  // Process steps — stagger slide from left
  gsap.from('.process-step', {
    x: -52, opacity: 0,
    duration: 1, stagger: 0.18, ease: 'expo.out',
    scrollTrigger: { trigger: '.process-steps', start: 'top 72%' },
  })

  // Process connectors scale in
  gsap.from('.process-connector', {
    scaleY: 0, opacity: 0,
    duration: 0.6, stagger: 0.18, ease: 'power2.out',
    transformOrigin: 'top',
    scrollTrigger: { trigger: '.process-steps', start: 'top 72%' },
  })
}

// ─── Private Collection — stagger rotate-in + parallax ─
//
// Cards rotate subtly into view as a staggered stack.
// ScrollTrigger scrub then drives a per-column parallax as you pass
// the section — the asymmetry creates depth without `initSilkScroll()`.
function initPrivateCollection() {
  const cards = gsap.utils.toArray('.private-grid .prv-card')
  if (!cards.length) return

  // Stagger rotate-in entrance
  gsap.fromTo(cards,
    { rotate: 5, scale: 0.92, opacity: 0 },
    {
      rotate: 0, scale: 1, opacity: 1,
      duration: 1.5, stagger: 0.16, ease: 'expo.out',
      scrollTrigger: { trigger: '.private-grid', start: 'top 78%' },
    }
  )

  if (prefersReducedMotion) return

  // Scrubbed parallax — different column travel rates for layered depth
  const factors = [-26, 10, 22, -13]
  cards.forEach((card, i) => {
    gsap.to(card, {
      y: factors[i], ease: 'none',
      scrollTrigger: {
        trigger: '#private-collection',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.8,
      },
    })
  })
}

// ─── Silk horizontal scroll gallery ───────────────────
//
// Spring-physics lerp stays — it's genuinely better than ScrollTrigger
// for the silk weight feel. Card reveals are now driven by GSAP instead
// of the old class-based CSS transition.
function initSilkCollectionScroll() {
  const tunnel   = document.getElementById('coll-tunnel')
  const track    = document.getElementById('coll-track')
  const dots     = [...document.querySelectorAll('.cd-dot')]
  const hint     = document.querySelector('.coll-hint')
  const viewport = track?.parentElement

  if (!tunnel || !track || !viewport) return

  const onMobile = window.matchMedia('(max-width: 768px)')

  if (onMobile.matches) {
    gsap.set([...track.children], { opacity: 1, x: 0 })
    if (dots[0]) dots[0].classList.add('active')

    let mobileHintGone = false
    viewport.addEventListener('scroll', () => {
      const cardW  = (track.children[0]?.offsetWidth ?? 280) + 3
      const active = Math.min(dots.length - 1, Math.round(viewport.scrollLeft / cardW))
      dots.forEach((d, i) => d.classList.toggle('active', i === active))
      if (!mobileHintGone && viewport.scrollLeft > 24 && hint) {
        hint.classList.add('hidden')
        mobileHintGone = true
      }
    }, { passive: true })

    // Tunnel header is inside sticky — reveal immediately via GSAP (no ScrollTrigger)
    gsap.to([...tunnel.querySelectorAll('.coll-header .reveal')], {
      opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out',
    })
    return
  }

  // ── Desktop: sticky tunnel + spring-physics lerp ─────────────────
  requestAnimationFrame(() => requestAnimationFrame(() => {
    function getTravel() { return Math.max(0, track.scrollWidth - viewport.offsetWidth) }

    function setTunnelHeight() {
      tunnel.style.height = `${window.innerHeight + getTravel()}px`
      ScrollTrigger.refresh()
    }

    setTunnelHeight()
    if ('ResizeObserver' in window) new ResizeObserver(setTunnelHeight).observe(track)
    window.addEventListener('resize', setTunnelHeight, { passive: true })

    let current  = 0
    let target   = 0
    let velocity = 0
    let hintGone = false

    window.addEventListener('scroll', () => {
      const tunnelTop = tunnel.getBoundingClientRect().top + window.scrollY
      const travel    = getTravel()
      const raw       = window.scrollY - tunnelTop
      target = Math.max(0, Math.min(travel, raw))
    }, { passive: true })

    // Card reveal — GSAP instead of silk-in class
    function revealVisibleCards() {
      const edge = viewport.offsetWidth + 80
      ;[...track.children].forEach(card => {
        if (!card.dataset.gsapIn && card.offsetLeft - current < edge) {
          card.dataset.gsapIn = '1'
          gsap.to(card, {
            opacity: 1, x: 0, rotateY: 0,
            duration: 1, ease: 'expo.out',
          })
        }
      })
    }

    function refreshDots() {
      if (!dots.length) return
      const travel = getTravel()
      const pct    = travel > 0 ? current / travel : 0
      const active = Math.min(dots.length - 1, Math.round(pct * (dots.length - 1)))
      dots.forEach((d, i) => d.classList.toggle('active', i === active))
    }

    let headerRevealed = false
    function maybeRevealHeader() {
      if (headerRevealed) return
      if (tunnel.getBoundingClientRect().top < window.innerHeight * 0.9) {
        gsap.to([...tunnel.querySelectorAll('.coll-header .reveal')], {
          opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out',
        })
        headerRevealed = true
      }
    }
    window.addEventListener('scroll', maybeRevealHeader, { passive: true })
    maybeRevealHeader()

    const SPRING  = 0.052
    const DAMPING = 0.84

    // Set 3D initial state on all cards (first card revealed immediately below)
    gsap.set([...track.children], { opacity: 0, x: 28, rotateY: 14, transformPerspective: 900 })

    ;(function tick() {
      const travel = getTravel()
      velocity  = velocity * DAMPING + (target - current) * SPRING
      current  += velocity
      current   = Math.max(0, Math.min(travel, current))

      if (Math.abs(velocity) > 0.04 || Math.abs(target - current) > 0.04) {
        track.style.transform = `translateX(-${current.toFixed(3)}px)`
      }

      revealVisibleCards()
      refreshDots()

      if (!hintGone && current > 36 && hint) {
        hint.classList.add('hidden')
        hintGone = true
      }

      requestAnimationFrame(tick)
    })()

    // First card always in immediately
    if (track.children[0]) {
      track.children[0].dataset.gsapIn = '1'
      gsap.to(track.children[0], { opacity: 1, x: 0, rotateY: 0, duration: 1, ease: 'expo.out' })
    }

  }))
}

// ─── Hero video ────────────────────────────────────────
function initVideo() {
  const video = document.getElementById('hero-video')
  if (!video) return
  const activate = () => {
    video.classList.add('loaded')
    document.getElementById('hero')?.classList.add('has-video')
  }
  if (video.readyState >= 3) { activate(); return }
  video.addEventListener('canplay', activate, { once: true })
}

// ─── Product images — fade in on load ─────────────────
function initProductImages() {
  document.querySelectorAll('.product-img').forEach(img => {
    const activate = () => img.classList.add('loaded')
    if (img.complete && img.naturalWidth > 0) {
      activate()
    } else {
      img.addEventListener('load',  activate, { once: true })
      img.addEventListener('error', () => {}, { once: true })
    }
  })
}

// ─── Custom cursor ─────────────────────────────────────
function initCursor() {
  const dot  = document.getElementById('cursor-dot')
  const ring = document.getElementById('cursor-ring')
  if (!dot || !ring || isTouch) return

  let mx = -200, my = -200
  let rx = -200, ry = -200

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY
    dot.style.left = mx + 'px'
    dot.style.top  = my + 'px'
  })

  ;(function tick() {
    rx += (mx - rx) * 0.115
    ry += (my - ry) * 0.115
    ring.style.left = rx + 'px'
    ring.style.top  = ry + 'px'
    requestAnimationFrame(tick)
  })()

  document.addEventListener('mouseover', e => {
    const t = e.target
    if (t.closest('a, button, input, select, textarea, label, .material-card')) {
      document.body.classList.add('cursor--hover')
    } else {
      document.body.classList.remove('cursor--hover')
    }
  })

  document.addEventListener('mousedown',  () => document.body.classList.add('cursor--press'))
  document.addEventListener('mouseup',    () => document.body.classList.remove('cursor--press'))
  document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0' })
  document.addEventListener('mouseenter', () => { dot.style.opacity = '';  ring.style.opacity = '' })
}

// ─── Scroll progress bar ───────────────────────────────
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress')
  if (!bar) return
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    bar.style.width = (window.scrollY / max * 100).toFixed(2) + '%'
  }, { passive: true })
}

// ─── Ambient gold dust ─────────────────────────────────
function initHeroParticles() {
  if (prefersReducedMotion) return
  const container = document.querySelector('.hero-particles')
  if (!container) return

  for (let i = 0; i < 20; i++) {
    const p    = document.createElement('span')
    const size = (0.8 + Math.random() * 1.6).toFixed(2)
    p.style.cssText = [
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `bottom:${(4 + Math.random() * 55).toFixed(1)}%`,
      `width:${size}px`,
      `height:${size}px`,
      `animation-delay:${(Math.random() * 11).toFixed(2)}s`,
      `animation-duration:${(8 + Math.random() * 10).toFixed(2)}s`,
    ].join(';')
    p.style.setProperty('--p-op', (0.07 + Math.random() * 0.22).toFixed(3))
    p.style.setProperty('--p-dx', `${(Math.random() * 40 - 20).toFixed(1)}px`)
    container.appendChild(p)
  }
}

// ─── 3D tilt on collection cards ──────────────────────
function initCardTilt() {
  if (prefersReducedMotion || isTouch) return

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect()
      const cx = (e.clientX - r.left)  / r.width  - 0.5
      const cy = (e.clientY - r.top)   / r.height - 0.5
      card.style.transform =
        `perspective(900px) rotateX(${(-cy * 5.5).toFixed(2)}deg) rotateY(${(cx * 5.5).toFixed(2)}deg) translateZ(16px)`
    })
    card.addEventListener('mouseleave', () => { card.style.transform = '' })
  })
}

// ─── Magnetic image hover — lerp RAF ──────────────────
//
// Each private card runs its own spring lerp loop on the image wrapper.
// CSS transition is stripped from .prv-img-wrap so only the lerp provides
// smoothness — no double-easing artifact.
function initMagneticCards() {
  if (prefersReducedMotion || isTouch) return

  document.querySelectorAll('.prv-card[data-magnetic]').forEach(card => {
    const wrap = card.querySelector('.prv-img-wrap')
    if (!wrap) return

    let tx = 0, ty = 0
    let cx = 0, cy = 0
    let active = false
    let rafId  = null

    function tick() {
      cx += (tx - cx) * 0.092
      cy += (ty - cy) * 0.092

      if (!active && Math.abs(cx) < 0.05 && Math.abs(cy) < 0.05) {
        wrap.style.transform = ''
        rafId = null
        return
      }

      wrap.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`
      rafId = requestAnimationFrame(tick)
    }

    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect()
      tx = ((e.clientX - (r.left + r.width  * 0.5)) / (r.width  * 0.5)) * 18
      ty = ((e.clientY - (r.top  + r.height * 0.5)) / (r.height * 0.5)) * 12
      active = true
      if (!rafId) rafId = requestAnimationFrame(tick)
    })

    card.addEventListener('mouseleave', () => {
      active = false; tx = 0; ty = 0
      if (!rafId) rafId = requestAnimationFrame(tick)
    })
  })
}

// ─── Magnetic nav links ────────────────────────────────
function initMagneticNav() {
  if (prefersReducedMotion || isTouch) return

  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('mousemove', e => {
      const r  = link.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2)
      const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2)
      link.style.transform = `translate(${(dx * 5).toFixed(1)}px, ${(dy * 4).toFixed(1)}px)`
    })
    link.addEventListener('mouseleave', () => { link.style.transform = '' })
  })
}

// ─── Navigation ────────────────────────────────────────
function initNav() {
  const nav = document.getElementById('nav')
  if (!nav) return
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 70)
  }, { passive: true })
}

// ─── Mobile menu ───────────────────────────────────────
function initMobileMenu() {
  const hamburger  = document.querySelector('.nav-hamburger')
  const mobileMenu = document.getElementById('mobile-menu')
  const close      = document.querySelector('.mobile-close')
  if (!hamburger || !mobileMenu || !close) return

  function openMenu() {
    mobileMenu.classList.add('open')
    hamburger.classList.add('active')
    hamburger.setAttribute('aria-expanded', 'true')
    document.body.style.overflow = 'hidden'
  }
  function closeMenu() {
    mobileMenu.classList.remove('open')
    hamburger.classList.remove('active')
    hamburger.setAttribute('aria-expanded', 'false')
    document.body.style.overflow = ''
  }

  hamburger.addEventListener('click', () =>
    mobileMenu.classList.contains('open') ? closeMenu() : openMenu()
  )
  close.addEventListener('click', closeMenu)

  // Expose closeMenu for smooth-scroll handler
  window._closeMenu = closeMenu
}

// ─── Smooth scroll + close mobile on anchor click ─────
//
// Anchor click → Lenis scrollTo for buttery weighted ride. Falls back
// to native scrollTo on reduce-motion (where Lenis isn't initialized).
function initSmoothScroll() {
  const nav = document.getElementById('nav')
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const id = anchor.getAttribute('href')
      if (id === '#') return
      const target = document.querySelector(id)
      if (!target) return
      e.preventDefault()
      window._closeMenu?.()
      const offset = (nav?.offsetHeight ?? 0) + 16
      const top = target.getBoundingClientRect().top + window.scrollY - offset

      if (window.__lenis) {
        window.__lenis.scrollTo(top, {
          duration: 1.2,
          // expo.inOut feels intentional — not slow, not abrupt
          easing: (x) => x === 0 ? 0 : x === 1 ? 1 :
            x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
        })
      } else {
        window.scrollTo({ top, behavior: 'smooth' })
      }
    })
  })
}

// ─── Footer ────────────────────────────────────────────
function initFooter() {
  const yearEl = document.getElementById('ft-year')
  if (yearEl) yearEl.textContent = new Date().getFullYear()

  document.getElementById('ft-top-btn')?.addEventListener('click', () => {
    if (window.__lenis) {
      window.__lenis.scrollTo(0, { duration: 1.4 })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  })
}

// ─── Enquiry form — sends to WhatsApp ─────────────────
function initForm() {
  const form   = document.getElementById('enquiry-form')
  const submit = document.getElementById('form-submit')
  if (!form || !submit) return

  form.addEventListener('submit', e => {
    e.preventDefault()

    const name    = form.querySelector('[name="name"]').value.trim()
    const phone   = form.querySelector('[name="phone"]').value.trim()
    const type    = form.querySelector('[name="interest"]').value
    const message = form.querySelector('[name="message"]').value.trim()

    let text = `${t('wa.intro')}\n\n`
    if (name)    text += `*${t('wa.name')}:* ${name}\n`
    if (phone)   text += `*${t('wa.phone')}:* ${phone}\n`
    if (type)    text += `*${t('wa.type')}:* ${type}\n`
    if (message) text += `*${t('wa.details')}:* ${message}`

    const url = `https://wa.me/972558829549?text=${encodeURIComponent(text.trim())}`
    window.open(url, '_blank', 'noopener,noreferrer')

    form.reset()
  })
}
