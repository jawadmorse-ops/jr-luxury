"use client";

import { motion } from "framer-motion";
import { Circle } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      style={{ position: "absolute" }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ width, height, position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            border: "2px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 32px 0 rgba(255,255,255,0.10)",
            background: gradientToCss(gradient),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.20), transparent 70%)",
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function gradientToCss(tailwindGradient) {
  const map = {
    "from-indigo-500/[0.15]": "linear-gradient(to right, rgba(99,102,241,0.15), transparent)",
    "from-rose-500/[0.15]":   "linear-gradient(to right, rgba(244,63,94,0.15), transparent)",
    "from-violet-500/[0.15]": "linear-gradient(to right, rgba(139,92,246,0.15), transparent)",
    "from-amber-500/[0.15]":  "linear-gradient(to right, rgba(245,158,11,0.15), transparent)",
    "from-cyan-500/[0.15]":   "linear-gradient(to right, rgba(6,182,212,0.15), transparent)",
  };
  return map[tailwindGradient] ?? "linear-gradient(to right, rgba(255,255,255,0.08), transparent)";
}

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
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#030303",
      }}
    >
      {/* Ambient gradient — bg-gradient-to-br from-indigo-500/[0.05] to-rose-500/[0.05] blur-3xl */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom right, rgba(99,102,241,0.05), transparent, rgba(244,63,94,0.05))",
          filter: "blur(72px)",
          pointerEvents: "none",
        }}
      />

      {/* 5 ElegantShapes */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <ElegantShape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          gradient="from-indigo-500/[0.15]"
          className="hero-shape-1"
        />
        <ElegantShape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          gradient="from-rose-500/[0.15]"
          className="hero-shape-2"
        />
        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          gradient="from-violet-500/[0.15]"
          className="hero-shape-3"
        />
        <ElegantShape
          delay={0.6}
          width={200}
          height={60}
          rotate={20}
          gradient="from-amber-500/[0.15]"
          className="hero-shape-4"
        />
        <ElegantShape
          delay={0.7}
          width={150}
          height={40}
          rotate={-25}
          gradient="from-cyan-500/[0.15]"
          className="hero-shape-5"
        />
      </div>

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
            <h1
              style={{
                fontFamily: "'Syne', system-ui, sans-serif",
                fontWeight: 800,
                fontSize: "clamp(3.5rem, 10vw, 10rem)",
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

      {/* Bottom/top fade overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, #030303 0%, transparent 50%, rgba(3,3,3,0.80) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
