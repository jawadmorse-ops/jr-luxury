import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Section signature moments — every major section gets one
 * intentional, distinct cinematic gesture as it enters view.
 * The headline is treated as the moment.
 *
 * The vocabulary: each character of the section headline is wrapped
 * in an overflow:hidden parent. On scroll-trigger, the inner spans
 * translate from y:100% → y:0% with a tight stagger — letters
 * "rise from below the baseline" into the line. AT signature.
 *
 * Why characters and not just words:
 *   • Words feel mechanical and short-distance
 *   • Characters feel like the text is *being typed* into existence
 *   • Stagger creates a sense of rhythm matched to reading pace
 *
 * Each section's <em> emphasis (italic) gets a tiny extra delay so
 * the visual contrast lands with intention rather than coinciding.
 *
 * The quote-mark + marquee retain their existing simple animations
 * (clip-path wipe, scale fade) — they're decorative SVG, not
 * typography that benefits from char splits.
 */

// ── Helper: recursively split text-node characters into spans ────
//
// Preserves inline element structure (<em>, <br>) — only text nodes
// get split. <br> is left untouched so line breaks survive.
function splitChars(node) {
  const charSpans = []

  function walk(n) {
    // Snapshot children — we mutate the live list as we go
    const children = Array.from(n.childNodes)
    children.forEach(c => {
      if (c.nodeType === Node.TEXT_NODE) {
        const text = c.textContent
        if (!text) return
        const frag = document.createDocumentFragment()
        for (const ch of text) {
          const wrap = document.createElement('span')
          wrap.style.display = 'inline-block'
          wrap.style.overflow = 'hidden'
          wrap.style.verticalAlign = 'baseline'
          wrap.style.lineHeight = 'inherit'
          // Preserve actual whitespace using nbsp so split doesn't
          // collapse spaces between words
          const inner = document.createElement('span')
          inner.style.display = 'inline-block'
          inner.style.willChange = 'transform'
          inner.textContent = ch === ' ' ? ' ' : ch
          wrap.appendChild(inner)
          frag.appendChild(wrap)
          charSpans.push(inner)
        }
        n.replaceChild(frag, c)
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        if (c.tagName === 'BR') return  // leave <br> alone
        walk(c)
      }
    })
  }

  walk(node)
  return charSpans
}

// ── Helper: split visible *words* (cheaper than chars for long bodies)
function splitWords(node) {
  const wordSpans = []
  const text = node.textContent
  node.textContent = ''
  const words = text.split(/(\s+)/)
  words.forEach(piece => {
    if (!piece) return
    if (/^\s+$/.test(piece)) {
      // Preserve whitespace exactly
      node.appendChild(document.createTextNode(piece))
      return
    }
    const wrap = document.createElement('span')
    wrap.style.display = 'inline-block'
    wrap.style.overflow = 'hidden'
    wrap.style.verticalAlign = 'baseline'
    const inner = document.createElement('span')
    inner.style.display = 'inline-block'
    inner.style.willChange = 'transform'
    inner.textContent = piece
    wrap.appendChild(inner)
    node.appendChild(wrap)
    wordSpans.push(inner)
  })
  return wordSpans
}

// ── Reveal a char-array with the AT-signature rise-from-below stagger
function revealChars(chars, trigger, opts = {}) {
  if (!chars.length) return
  gsap.set(chars, { yPercent: 110, opacity: 1 })
  gsap.to(chars, {
    yPercent: 0,
    duration: opts.duration ?? 1.0,
    ease: opts.ease ?? 'expo.out',
    stagger: opts.stagger ?? 0.018,
    scrollTrigger: {
      trigger,
      start: opts.start ?? 'top 85%',
      toggleActions: 'play none none none',
    },
  })
}

export function initSectionEnterFX(prefersReducedMotion) {
  if (prefersReducedMotion) return

  // ── Section headlines: char-stagger rise ─────────────────────
  // Targets: every major section's main h2. Each headline is the
  // section's "moment" — the text materializes into existence.
  const headingSelectors = [
    { sel: '#philosophy h2',                  start: 'top 80%' },
    { sel: '#materials .section-header h2',    start: 'top 80%' },
    { sel: '#atelier .section-header h2',      start: 'top 80%' },
    { sel: '#contact h2',                      start: 'top 80%' },
  ]
  headingSelectors.forEach(({ sel, start }) => {
    const h = document.querySelector(sel)
    if (!h) return
    const chars = splitChars(h)
    revealChars(chars, h, { start, stagger: 0.022, duration: 1.1 })
  })

  // ── Testimonial quote body: word-stagger (chars would be too many)
  const quotePara = document.querySelector('.testimonial-inner blockquote p')
  if (quotePara) {
    const words = splitWords(quotePara)
    if (words.length) {
      gsap.set(words, { yPercent: 100, opacity: 1 })
      gsap.to(words, {
        yPercent: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.035,
        scrollTrigger: {
          trigger: '#testimonials',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      })
    }
  }

  // ── Quote mark — quiet scale + fade alongside the text reveal
  const quote = document.querySelector('.quote-mark')
  if (quote) {
    gsap.fromTo(quote,
      { scale: 0.7, opacity: 0 },
      {
        scale: 1, opacity: 0.6,
        duration: 1.0,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: '#testimonials',
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      }
    )
  }

  // ── Marquee — horizontal clip-path wipe on enter
  const marquee = document.querySelector('.marquee-wrapper')
  if (marquee) {
    gsap.fromTo(marquee,
      { clipPath: 'inset(0 100% 0 0)' },
      {
        clipPath: 'inset(0 0% 0 0)',
        ease: 'expo.out',
        duration: 1.2,
        scrollTrigger: {
          trigger: marquee,
          start: 'top 92%',
          toggleActions: 'play none none none',
        },
      }
    )
  }

  // ── Supporting copy + CTAs: subtle fade+rise after the headline.
  //    Body paragraphs only — section-eyebrows are already handled
  //    by initKineticType's slide-from-left treatment in main.js.
  const supportingSelectors = [
    '#philosophy .philosophy-text p',
    '#philosophy .philosophy-text .btn-text',
    '#contact .contact-text p',
  ]
  supportingSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      gsap.fromTo(el,
        { y: 20, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 1.0,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            toggleActions: 'play none none none',
          },
        }
      )
    })
  })
}
