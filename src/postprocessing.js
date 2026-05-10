import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js'

/**
 * Cinematic post-processing pipeline used across all WebGL scenes.
 *
 * Pipeline (in order):
 *   RenderPass      → the underlying scene
 *   UnrealBloomPass → bright pixels glow / halate (the single biggest
 *                     "premium" lever; makes gold/rose pulses molten)
 *   ChromaticPass   → custom RGB-shift radiating from center
 *                     (Active Theory signature — barely perceptible
 *                     consciously, hugely felt subconsciously)
 *   FilmGrainPass   → animated luminance noise + slight scanline tint
 *                     (kills banding on dark gradients on cheap panels)
 *   OutputPass      → tone-map to sRGB, color-managed final image
 *
 * Use the `pipeline` option to scale intensity per scene:
 *   'hero'       — full strength (the showpiece)
 *   'subtle'     — quieter bloom, no chroma, faint grain (service
 *                  scenes, philosophy ring)
 *   'background' — bloom only (background canvases that shouldn't
 *                  pull focus)
 */

// ── ChromaticAberrationShader ────────────────────────────────────────
// Radial RGB shift — channels separate as you move away from center.
// AT-tier signature: subtle on hero, basically unnoticeable but lifts
// the whole image into "cinema render" territory.
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uStrength:  { value: 0.0024 },
    uPower:     { value: 1.6 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uPower;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - 0.5;
      // Radial strength — heavier near edges
      float d = length(dir);
      float k = pow(d, uPower) * uStrength;
      vec2 off = normalize(dir + 1e-6) * k;
      // Sample R, G, B at slightly offset coords
      float r = texture2D(tDiffuse, vUv + off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - off).b;
      float a = texture2D(tDiffuse, vUv).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `,
}

// ── FilmGrainShader ──────────────────────────────────────────────────
// Animated luminance noise to break up flat dark regions. Keeps the
// gold-on-black gradients from banding on cheap displays.
const FilmGrainShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uTime:      { value: 0 },
    uIntensity: { value: 0.045 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      // Per-frame jittered hash — fast pseudo-noise with no texture lookup
      float n = rand(vUv * 1024.0 + uTime * 60.0) - 0.5;
      // Apply more grain in the dark areas, less in the bright (matches
      // how real film grain behaves — shadows are noisier)
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      float strength = uIntensity * (1.2 - lum * 0.7);
      col.rgb += n * strength;
      gl_FragColor = col;
    }
  `,
}

const PRESETS = {
  hero: {
    bloomStrength:  0.85,
    bloomRadius:    0.8,
    bloomThreshold: 0.32,
    // Aggressive grain + chroma was reading as "old-TV pixelation" on
    // high-DPI screens. Scaled back to a tasteful film texture: the
    // grain is now a hint, not a layer; chroma is on the edge of
    // perceptibility (sub-pixel offset for the rich color edges).
    chromaStrength: 0.0012,
    grainIntensity: 0.014,
    enableChroma:   true,
    enableGrain:    true,
  },
  subtle: {
    bloomStrength:  0.6,
    bloomRadius:    0.55,
    // Higher threshold so only the silhouette rim blooms — keeps the
    // geometry's facets and displacement legible underneath
    bloomThreshold: 0.78,
    chromaStrength: 0,
    grainIntensity: 0,        // service mini-scenes: no grain — too small
    enableChroma:   false,
    enableGrain:    false,
  },
  background: {
    bloomStrength:  0.7,
    bloomRadius:    1.0,
    bloomThreshold: 0.1,
    chromaStrength: 0,
    grainIntensity: 0,
    enableChroma:   false,
    enableGrain:    false,
  },
}

export function buildComposer(renderer, scene, camera, { pipeline = 'hero' } = {}) {
  const cfg = PRESETS[pipeline] ?? PRESETS.hero
  const size = renderer.getSize(new THREE.Vector2())

  const composer = new EffectComposer(renderer)
  composer.setSize(size.x, size.y)
  composer.setPixelRatio(renderer.getPixelRatio())

  // 1. Underlying scene
  composer.addPass(new RenderPass(scene, camera))

  // 2. Bloom — UnrealBloomPass takes (resolution, strength, radius, threshold)
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    cfg.bloomStrength,
    cfg.bloomRadius,
    cfg.bloomThreshold,
  )
  composer.addPass(bloom)

  // 3. Chromatic aberration (optional)
  let chroma = null
  if (cfg.enableChroma) {
    chroma = new ShaderPass(ChromaticAberrationShader)
    chroma.uniforms.uStrength.value = cfg.chromaStrength
    composer.addPass(chroma)
  }

  // 4. Film grain (optional)
  let grain = null
  if (cfg.enableGrain) {
    grain = new ShaderPass(FilmGrainShader)
    grain.uniforms.uIntensity.value = cfg.grainIntensity
    composer.addPass(grain)
  }

  // 5. Output / tone map / sRGB
  composer.addPass(new OutputPass())

  return {
    composer,
    bloom,
    chroma,
    grain,
    setSize(w, h) {
      composer.setSize(w, h)
      bloom.setSize(w, h)
    },
    setGrainTime(t) {
      if (grain) grain.uniforms.uTime.value = t
    },
    dispose() {
      composer.dispose?.()
      bloom.dispose?.()
    },
  }
}
