"use client";

// Visual takeover — the elegant blurred-div shapes that used to live
// here have been replaced by a full-screen WebGL fragment shader
// (see src/hero-webgl.js). This component now owns ONLY the text +
// CTA layout; the WebGL canvas is mounted independently into the
// `<canvas class="hero-webgl-canvas">` element in index.html.

import { motion } from "framer-motion";
import { Circle } from "lucide-react";

export function HeroGeometric({
  badge    = "Design Collective",
  title1   = "Elevate Your",
  title2   = "Digital Vision",
  subtitle = "Crafting exceptional digital experiences through<br>innovative design and cutting-edge technology.",
  cta1     = "Our Services",
  cta2     = "Start a Project",
}) {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  return (
    <div
      style={{
        position: "relative",
        // Fill the parent #hero exactly (which is now 100svh) instead
        // of expanding past it — the old minHeight:100vh was the cause
        // of the gap visible after the headline scroll-out
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // No background — the WebGL canvas behind handles it
        background: "transparent",
      }}
    >
      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "6rem 1.5rem 5rem",
        }}
      >
        <div style={{ maxWidth: "72rem", margin: "0 auto", textAlign: "center" }}>

          {/* Badge */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: "2rem",
            }}
          >
            <Circle
              style={{
                width: "8px",
                height: "8px",
                fill: "rgba(244,63,94,0.80)",
                color: "rgba(244,63,94,0.80)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.60)",
                letterSpacing: "0.05em",
              }}
            >
              {badge}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Size lives in CSS (.hero-h1) — phones need a media query
                (measured: "Elevate Your" fits one line only ≤8.7vw there),
                and inline styles can't express that. */}
            <h1
              className="hero-h1"
              style={{
                fontFamily: "'Syne', system-ui, sans-serif",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: "2rem",
                overflow: "visible",
                padding: "0.05em 0",
              }}
            >
              <span
                style={{
                  background: "linear-gradient(to bottom, #ffffff, rgba(255,255,255,0.80))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  display: "block",
                  overflow: "visible",
                  padding: "0.05em 0.12em",
                  margin: "0 -0.12em",
                }}
              >
                {title1}
              </span>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontStyle: "italic",
                  fontWeight: 300,
                  background:
                    "linear-gradient(to right, #a5b4fc, rgba(255,255,255,0.90), #fda4af)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  color: "transparent",
                  display: "block",
                  overflow: "visible",
                  padding: "0 0.12em 0.08em",
                  margin: "0 -0.12em",
                }}
              >
                {title2}
              </span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.div
            custom={2}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
          >
            <p
              style={{
                fontSize: "clamp(1rem, 2vw, 1.25rem)",
                color: "rgba(255,255,255,0.40)",
                marginBottom: "2.5rem",
                lineHeight: 1.625,
                fontWeight: 300,
                letterSpacing: "0.05em",
                maxWidth: "36rem",
                margin: "0 auto 2.5rem",
                padding: "0 1rem",
              }}
              dangerouslySetInnerHTML={{ __html: subtitle }}
            />
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            custom={3}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.4rem",
              flexWrap: "wrap",
            }}
          >
            <a href="#materials" className="btn-primary"><span>{cta1}</span></a>
            <a href="#contact"   className="btn-ghost">{cta2}</a>
          </motion.div>
        </div>
      </div>

      {/* Bottom/top fade overlay — keeps text legible against the
          WebGL field's varying brightness, and bridges into the next
          section's solid black */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, #030303 0%, transparent 30%, rgba(3,3,3,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
