/**
 * Active WebGL functionality test.
 *
 * Browsers like Brave with strict fingerprinting protection
 * (and some hardened privacy extensions) create WebGL contexts
 * that LOOK functional — getContext() returns non-null, no
 * exceptions thrown — but silently render blank/zero pixels or
 * randomized garbage. A try/catch around new WebGLRenderer()
 * won't catch this because nothing throws.
 *
 * The reliable test: clear a tiny offscreen canvas to a known
 * non-black color, read one pixel back, verify the readback
 * matches. If it doesn't, WebGL is being silently neutralized
 * and the caller should hide its canvas + rely on CSS fallback.
 *
 * Memoized — runs once per page load, costs ~0.5ms.
 */
let _cached = null

export function isWebGLFunctional() {
  if (_cached !== null) return _cached
  try {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 4
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) { _cached = false; return false }

    // Clear to a distinctive non-black color (orange)
    gl.clearColor(0.95, 0.55, 0.10, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Read back one pixel
    const pixels = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    // If WebGL is functional we should get back something near orange.
    // Brave's strict shield typically returns all-zero or random data.
    // Tolerance is wide so legitimate variations (Brave standard, color
    // space differences, software rendering) still pass.
    const r = pixels[0], g = pixels[1], b = pixels[2]
    const looksOrange = r > 200 && g > 100 && g < 180 && b < 60
    _cached = looksOrange

    // Best-effort cleanup
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()

    return _cached
  } catch (err) {
    _cached = false
    return false
  }
}
