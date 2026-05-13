import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Section enter effects — each major section's inner wrapper gets a
 * cinematic scrub reveal as it enters the viewport.
 *
 * Why target wrappers, not sections:
 *   The section element itself contains its WebGL backdrop canvas
 *   (atelier-canvas, contact-canvas, philosophy-canvas, etc.) which
 *   needs to remain visible at all times — animating the section would
 *   blink the backdrop in/out unpleasantly.
 *
 *   The inner wrappers (.container, .philosophy-inner, .testimonial-inner)
 *   hold the text content — animating those gives the cinematic reveal
 *   feel without touching the backdrops.
 *
 *   We also use opacity 0.65 → 1 (not 0 → 1) so any .reveal children
 *   that snap-fire during the scrub don't jarringly blink against an
 *   invisible parent.
 *
 * Marquee strip: clip-path reveal — feels right for a horizontal
 * text strip (mask wipe matches its scrolling-text nature).
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
    gsap.fromTo(el,
      { y: 60, opacity: 0.65, filter: 'blur(8px)' },
      {
        y: 0, opacity: 1, filter: 'blur(0px)',
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top 95%',
          end: 'top 55%',
          scrub: 1.4,
        },
      }
    )
  })

  // Marquee strip — clip-path reveal sweeps left → right as it enters
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

  // Testimonial quote mark — scroll-driven scale pulse on top of the
  // existing snap reveal. Adds presence to the otherwise small SVG.
  const quote = document.querySelector('.quote-mark')
  if (quote) {
    gsap.fromTo(quote,
      { scale: 0.4, rotate: -8 },
      {
        scale: 1, rotate: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#testimonials',
          start: 'top 88%',
          end: 'top 35%',
          scrub: 1.2,
        },
      }
    )
  }

  // Footer — gentle scrub-fade as user reaches the bottom of the page
  const footer = document.getElementById('footer')
  if (footer) {
    gsap.fromTo(footer,
      { opacity: 0.5 },
      {
        opacity: 1,
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
