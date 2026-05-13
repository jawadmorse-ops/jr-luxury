import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Section enter FX — quiet, single-purpose reveal as each section
 * comes into view. No exit animations. No multi-phase drama.
 *
 * Active-Theory's elegance principle: a confident static baseline +
 * occasional intentional motion. NOT motion everywhere all the time.
 * Sections reveal once with one clean motion, then stay calm so the
 * content can actually be read.
 *
 * Motion: y(28px → 0) + opacity(0 → 1), gentle expo-out, 1.4s. No
 * blur (was reading as broken text), no scale (was busy), no exit
 * (was distracting noise). Each section's reveal has the same calm
 * vocabulary — feels intentional, consistent, refined.
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
      { y: 28, opacity: 0 },
      {
        y: 0, opacity: 1,
        duration: 1.4,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',  // play once, never reverse
        },
      }
    )
  })

  // Marquee — clip-path mask wipe (left → right). It's a horizontal
  // strip of moving text; a horizontal reveal matches its identity.
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

  // Testimonial quote mark — quiet scale + opacity. It's a decorative
  // SVG; one motion is plenty.
  const quote = document.querySelector('.quote-mark')
  if (quote) {
    gsap.fromTo(quote,
      { scale: 0.7, opacity: 0 },
      {
        scale: 1, opacity: 0.6,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: '#testimonials',
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      }
    )
  }
}
