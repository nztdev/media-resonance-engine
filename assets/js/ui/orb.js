/**
 * MEDIA RESONANCE ENGINE · ui/orb.js
 * ─────────────────────────────────────
 * Frequency orb SVG renderer and intensity ring updater.
 * DOM layer only — reads from MREState, never calls core directly.
 *
 * v0.3 · https://github.com/[your-username]/media-resonance-engine
 */

const OrbUI = (() => {

  // ── Render intensity ring ─────────────────────────────────
  /**
   * Update the orb's intensity ring based on current intensity value.
   * @param {number} intensity — 0 to 100
   */
  function updateIntensityRing(intensity) {
    const ring = document.getElementById('intensityRing');
    if (!ring) return;

    const radius       = 120;
    const circumference = 2 * Math.PI * radius;
    const filled       = (intensity / 100) * circumference;
    const offset       = circumference - filled;

    ring.setAttribute('stroke-dasharray',  circumference.toFixed(1));
    ring.setAttribute('stroke-dashoffset', offset.toFixed(1));
    ring.setAttribute('opacity', (0.25 + (intensity / 100) * 0.55).toFixed(2));
  }

  // ── Update Hz display ─────────────────────────────────────
  /**
   * Animate the Hz number in the orb centre changing to a new value.
   * @param {number} hz
   */
  function updateHz(hz) {
    const el = document.getElementById('orbHz');
    if (!el) return;

    el.style.transition = 'opacity 0.15s';
    el.style.opacity    = '0';

    setTimeout(() => {
      el.textContent  = hz;
      el.style.opacity = '1';
    }, 150);
  }

  // ── Public API ────────────────────────────────────────────
  return {
    updateIntensityRing,
    updateHz,
  };

})();
