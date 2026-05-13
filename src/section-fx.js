import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Section enter/exit FX — every major section now has a full
 * cinematic lifecycle:
 *
 *   ENTER (0 → 25% of timeline):
 *     y: 70 → 0,  opacity: 0.6 → 1,  filter: blur(12px) → blur(0)
 *
 *   HOLD (25 → 70%):
 *     stays clean, content readable
 *
 *   EXIT (70 → 100%):
 *     y: 0 → -70,  opacity: 1 → 0.4,  filter: blur(0) → blur(8px)
 *     scale slightly down 1 → 0.95 — feels like the section is
 *     receding into depth as user scrolls past, matching the hero exit
 *
 * Timeline range: trigger 'top bottom' → 'bottom top' (the entire
 * span where the section is visible). With scrub: 1.2 the user has
 * tactile control over each phase.
 *
 * Targets WRAPPERS not sections — section backdrops (atelier-canvas,
 * contact-canvas, etc.) stay visible at all times. Only the text
 * content breathes in/out.
 */
export function initSectionEnterFX(prefersReducedMotion) {
  if (prefersReducedMotion) return

  const wrappers = [
    '#philosophy .philosophy-inner',
    '#materials .container',
    '#atelier .container',
    '#testimonials .testimonial-inner',
    '#contact .container',
  ]

  wrappers.forEach(selector => {
    const el = document.querySelector(selector)
    if (!el) return

    // Pre-set the starting state so the element doesn't flash at full
    // opacity for a frame before the timeline takes over
    gsap.set(el, { y: 70, opacity: 0.6, filter: 'blur(12px)', scale: 0.96 })

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2,
      },
    })

    // Enter phase (first 25% of scroll-through)
    tl.to(el, {
      y: 0, opacity: 1, filter: 'blur(0px)', scale: 1,
      ease: 'none', duration: 0.25,
    })
    // Hold phase (middle 45%) — clean and readable
    .to(el, {
      y: 0, opacity: 1, filter: 'blur(0px)', scale: 1,
      ease: 'none', duration: 0.45,
    })
    // Exit phase (last 30%) — receding into depth, matches hero exit feel
    .to(el, {
      y: -70, opacity: 0.4, filter: 'blur(8px)', scale: 0.96,
      ease: 'none', duration: 0.30,
    })
  })

  // Marquee — clip-path mask wipe on enter only (no exit; it's a short
  // strip and a wipe-out on exit looks weird mid-scroll)
  const marquee = document.querySelector('.marquee-wrapper')
  if (marquee) {
    gsap.fromTo(marquee,
      { clipPath: 'inset(0 100% 0 0)', opacity: 0.4 },
      {
        clipPath: 'inset(0 0% 0 0)',
        opacity: 1,
        ease: 'power2.out',
        duration: 1.2,
        scrollTrigger: {
          trigger: marquee,
          start: 'top 92%',
          toggleActions: 'play none none reverse',
        },
      }
    )
  }

  // Testimonial quote mark — scrub-scales up + rotates into place
  // alongside the section's content reveal
  const quote = document.querySelector('.quote-mark')
  if (quote) {
    gsap.fromTo(quote,
      { scale: 0.4, rotate: -10, opacity: 0 },
      {
        scale: 1, rotate: 0, opacity: 0.6,
        ease: 'none',
        scrollTrigger: {
          trigger: '#testimonials',
          start: 'top 85%',
          end: 'top 30%',
          scrub: 1.2,
        },
      }
    )
  }

  // Footer — softer treatment than mid-page sections. It IS the end
  // of the page; should fade in and stay.
  const footer = document.getElementById('footer')
  if (footer) {
    gsap.fromTo(footer,
      { opacity: 0.4, y: 30 },
      {
        opacity: 1, y: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: footer,
          start: 'top 95%',
          end: 'top 60%',
          scrub: 1,
        },
      }
    )
  }
}
