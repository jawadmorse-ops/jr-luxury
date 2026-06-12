import './style.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { initServiceScenes }    from './service-scenes.js'
import { initBeamsBackground }  from './beams-background.js'
import { initHeroWebGL }        from './hero-webgl.js'
import { initAtelierScene }     from './atelier-scene.js'
import { initSectionEnterFX }   from './section-fx.js'
import { createElement }  from 'react'
import { createRoot }     from 'react-dom/client'
import { HeroGeometric }  from './components/HeroGeometric.jsx'
import { initI18n, t }   from './i18n.js'

gsap.registerPlugin(ScrollTrigger)

// Mobile-bug fix: iOS Safari + Chrome Android collapse/expand the URL bar
// while scrolling, which fires resize events. By default ScrollTrigger
// reacts to those by refreshing all triggers, which with scrub animations
// can snap-scroll the user back toward the top. ignoreMobileResize tells
// ScrollTrigger to skip refresh when only the viewport HEIGHT changed on
// touch devices — the typical URL bar behavior.
ScrollTrigger.config({ ignoreMobileResize: true })

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
  initAtelierScene(prefersReducedMotion)
  // Contact intentionally has no 3D backdrop — the form is the
  // moment of this section. The global beams provide ambient
  // atmosphere; adding more competed with the form's readability.
  initSectionEnterFX(prefersReducedMotion)
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

// ─── Refresh ScrollTrigger on width changes only ────────
//
// Previously this refreshed on EVERY resize event, which fires on iOS
// Safari + Chrome Android every time the URL bar collapses/expands as
// the user scrolls. Each refresh recalculates scrub positions, which
// could (with Lenis active) snap-scroll the user back near the hero.
// Multiple users reported this as "scrolling down sometimes shoots
// me back to the top."
//
// Fix: track lastWidth and only refresh when the WIDTH genuinely
// changed (real device-orientation flip, monitor switch, dev-tools
// open, etc.). URL bar collapse only changes height, so we ignore it.
function initResizeRefresh() {
  let timer
  let lastWidth = window.innerWidth
  window.addEventListener('resize', () => {
    const w = window.innerWidth
    if (w === lastWidth) return  // URL bar collapse / height-only — skip
    lastWidth = w
    clearTimeout(timer)
    timer = setTimeout(() => ScrollTrigger.refresh(), 200)
  }, { passive: true })
}

// ─── Preloader — GSAP timeline ─────────────────────────
function initPreloader() {
  const el = document.getElementById('preloader')
  if (!el) return

  // Set hero element initial states now — preloader covers them so no flash
  gsap.set('.hero-corner',     { width: 0, height: 0 })
  gsap.set('.hero-side-label', { opacity: 0, y: -24 })

  if (prefersReducedMotion) {
    el.style.display = 'none'
    document.body.style.overflow = ''
    heroEntrance()
    return
  }

  document.body.style.overflow = 'hidden'

  // Repeat visit within the same session: the brand moment already
  // played. Holding people at a splash screen twice reads as slow,
  // not premium — give them a half-second exit instead.
  let seen = false
  try { seen = sessionStorage.getItem('jr-seen') === '1' } catch (_) {}

  if (seen) {
    gsap.set(['.pl-tag', '.pl-bar'], { opacity: 0 })
    gsap.timeline({
      onComplete() { document.body.style.overflow = ''; heroEntrance() },
    })
      .fromTo('.pl-mono',
        { opacity: 0, letterSpacing: '0.7em' },
        { opacity: 1, letterSpacing: '0.55em', duration: 0.4, ease: 'power2.out' }
      )
      .to('#preloader', {
        yPercent: -105,
        duration: 0.55,
        ease: 'power3.in',
        delay: 0.1,
        onComplete() { el.style.display = 'none' },
      })
    return
  }
  try { sessionStorage.setItem('jr-seen', '1') } catch (_) {}

  gsap.timeline({
    onComplete() { document.body.style.overflow = ''; heroEntrance() },
  })
    .fromTo('.pl-mono',
      { opacity: 0, letterSpacing: '0.9em', filter: 'blur(18px)' },
      { opacity: 1, letterSpacing: '0.55em', filter: 'blur(0px)', duration: 1.25, ease: 'expo.out' }
    )
    .fromTo('.pl-tag',  { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.85')
    .fromTo('.pl-bar',  { opacity: 0 },        { opacity: 1, duration: 0.3 }, '-=0.45')
    .fromTo('.pl-fill', { scaleX: 0 },         { scaleX: 1, duration: 1.0, transformOrigin: 'left center', ease: 'power2.inOut' }, '<')
    .to('#preloader', {
      yPercent: -105,
      duration: 0.8,
      ease: 'power3.in',
      delay: 0.15,
      onComplete() { el.style.display = 'none' },
    })
}

// ─── Hero entrance — runs after preloader exits ────────
function heroEntrance() {
  if (prefersReducedMotion) {
    gsap.set('.hero-corner', { width: 42, height: 42 })
    gsap.set('.hero-side-label', { opacity: 1, y: 0 })
    return
  }

  gsap.timeline()
    .to('.hero-corner',     { width: 42, height: 42, duration: 0.85, stagger: 0.08, ease: 'expo.out' })
    .to('.hero-side-label', { opacity: 1, y: 0, duration: 1.2, stagger: 0.15, ease: 'expo.out' }, '-=0.5')
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

  // Hero exit — text scales up slightly, fades, and softens as the
  // user scrolls past. Reads as the camera diving forward through
  // the typography into the WebGL nebula behind it.
  // Range tuned: 25 → 75%. Text holds visible through the first
  // quarter of scroll (so it's not exiting the moment you start
  // scrolling), then fades over the middle half. By the time the
  // last quarter of hero is scrolled past, the text is gone but
  // the next section is already mostly in view — no dead air.
  gsap.to('#hero-react-root', {
    scale: 1.08,
    opacity: 0,
    filter: 'blur(6px)',
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start: '25% top',
      end: '75% top',
      scrub: 1,
    },
  })

  // (Section h2 kinetic reveal lives in initSectionEnterFX —
  // character-by-character rise-from-baseline in section-fx.js.)

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

  // Process steps — scroll-scrubbed stagger from left. Each step
  // travels in as its own row crosses the viewport, so the timing
  // feels organic, not like a single canned animation
  gsap.utils.toArray('.process-step').forEach((step, i) => {
    gsap.fromTo(step,
      { x: -80, opacity: 0 },
      {
        x: 0, opacity: 1, ease: 'none',
        scrollTrigger: {
          trigger: step,
          start: 'top 92%',
          end: 'top 65%',
          scrub: 1,
        },
      }
    )
  })

  // Process connectors scale in (vertical pipes between steps)
  gsap.from('.process-connector', {
    scaleY: 0, opacity: 0,
    duration: 0.6, stagger: 0.18, ease: 'power2.out',
    transformOrigin: 'top',
    scrollTrigger: { trigger: '.process-steps', start: 'top 72%' },
  })

  // ── Service cards — scroll-driven parallax floats ───────
  // Each card drifts at a different rate as it scrolls through
  // the viewport. Reads as depth without 3D — adds life to what
  // would otherwise be a static row of cards
  gsap.utils.toArray('.material-card').forEach((card, i) => {
    const offset = [-30, 0, -30][i] ?? 0
    gsap.fromTo(card,
      { y: 0 },
      {
        y: offset, ease: 'none',
        scrollTrigger: {
          trigger: '.materials-grid',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.4,
        },
      }
    )
  })

  // (Earlier I added a blur+letter-spacing scrub here; it left the
  // section headlines unreadable while mid-reveal. Removed — the
  // existing yPercent reveal upstream is plenty cinematic.)
}

// (Init functions for retired sections — private collection, silk
// gallery, hero video, product images, card tilt, magnetic cards —
// were removed along with their markup. See git history.)

// ─── Custom cursor — morphs based on what's hovered ─────
//
// Default: small dot + lerped ring
// Hover (link/button/input): dot + ring scale up
// CTA (data-cursor or .btn-primary/.btn-ghost/.nav-cta): cursor
//   morphs into a pill with action label (e.g., "Start", "View")
// Press: compressed
function initCursor() {
  const dot   = document.getElementById('cursor-dot')
  const ring  = document.getElementById('cursor-ring')
  const label = document.getElementById('cursor-label')
  const labelText = label?.querySelector('span')
  if (!dot || !ring || !label || isTouch) return

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
    ring.style.left  = rx + 'px'
    ring.style.top   = ry + 'px'
    // Label follows the lerped ring — feels intentional rather than
    // jittery; the small offset from cursor position reads as weight
    label.style.left = rx + 'px'
    label.style.top  = ry + 'px'
    requestAnimationFrame(tick)
  })()

  // Hover detection — three contexts control which class lands on body.
  // Priority: CTA > card > hover > none. Mutually exclusive.
  const CTA_SELECTOR  = '.btn-primary, .btn-ghost, .nav-cta, [data-cursor]'
  const CARD_SELECTOR = '.material-card, .prv-card, .product-card, img'
  const HOVER_SELECTOR = 'a, button, input, select, textarea, label'

  document.addEventListener('mouseover', e => {
    const t = e.target
    const cls = document.body.classList

    const cta = t.closest?.(CTA_SELECTOR)
    if (cta) {
      // Read label from data-cursor or fall back to short verb derived
      // from the element's own text. "Start a Project" → "Start"
      const explicit = cta.getAttribute('data-cursor')
      const text = explicit ?? (cta.textContent?.trim().split(/\s+/)[0] || 'View')
      if (labelText) labelText.textContent = text
      cls.add('cursor--cta')
      cls.remove('cursor--hover', 'cursor--card')
      return
    }

    const card = t.closest?.(CARD_SELECTOR)
    if (card) {
      cls.add('cursor--card')
      cls.remove('cursor--hover', 'cursor--cta')
      return
    }

    cls.remove('cursor--cta', 'cursor--card')
    if (t.closest?.(HOVER_SELECTOR)) {
      cls.add('cursor--hover')
    } else {
      cls.remove('cursor--hover')
    }
  })

  document.addEventListener('mousedown',  () => document.body.classList.add('cursor--press'))
  document.addEventListener('mouseup',    () => document.body.classList.remove('cursor--press'))
  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0'; ring.style.opacity = '0'; label.style.opacity = '0'
  })
  document.addEventListener('mouseenter', () => {
    dot.style.opacity = '';  ring.style.opacity = '';  label.style.opacity = ''
  })
}

// ─── Scroll progress bar ───────────────────────────────
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress')
  if (!bar) return
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (max <= 0) { bar.style.width = '0%'; return }
    bar.style.width = (Math.min(1, window.scrollY / max) * 100).toFixed(2) + '%'
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu()
  })

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

  const nameInput = form.querySelector('[name="name"]')

  // Clear the error state the moment the user starts fixing it
  nameInput.addEventListener('input', () => {
    nameInput.classList.remove('field-error')
  })

  form.addEventListener('submit', e => {
    e.preventDefault()

    const name    = nameInput.value.trim()
    const phone   = form.querySelector('[name="phone"]').value.trim()
    const type    = form.querySelector('[name="interest"]').value
    const message = form.querySelector('[name="message"]').value.trim()

    // Name is the one field we genuinely need — WhatsApp already
    // carries the sender's number. An empty submit used to open a
    // blank-ish chat; now it nudges instead.
    if (!name) {
      nameInput.classList.remove('field-error')
      // Force restart of the shake animation
      void nameInput.offsetWidth
      nameInput.classList.add('field-error')
      nameInput.focus()
      return
    }

    let text = `${t('wa.intro')}\n\n`
    text += `*${t('wa.name')}:* ${name}\n`
    if (phone)   text += `*${t('wa.phone')}:* ${phone}\n`
    if (type)    text += `*${t('wa.type')}:* ${type}\n`
    if (message) text += `*${t('wa.details')}:* ${message}`

    const url = `https://wa.me/972558829549?text=${encodeURIComponent(text.trim())}`
    window.open(url, '_blank', 'noopener,noreferrer')

    form.reset()
  })
}
