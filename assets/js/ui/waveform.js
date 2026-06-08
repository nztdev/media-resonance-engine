/**
 * MEDIA RESONANCE ENGINE · ui/waveform.js
 * ─────────────────────────────────────────
 * SVG waveform renderer.
 * DOM layer only. Accepts plain data arrays from core/fft-utils.js.
 *
 * v0.3 · https://github.com/[your-username]/media-resonance-engine
 */

const WaveformUI = (() => {

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const W      = 400;
  const H      = 80;

  // ── Clear and reset ───────────────────────────────────────
  function _clear(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width',  W);
    bg.setAttribute('height', H);
    bg.setAttribute('fill',   'rgba(255,255,255,0.02)');
    bg.setAttribute('rx',     '4');
    svg.appendChild(bg);
  }

  // ── Empty state ───────────────────────────────────────────
  function renderEmpty(svgId = 'waveformSvg') {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    _clear(svg);

    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x',                 W / 2);
    txt.setAttribute('y',                 H / 2 + 3);
    txt.setAttribute('text-anchor',       'middle');
    txt.setAttribute('dominant-baseline', 'middle');
    txt.setAttribute('font-family',       'DM Mono');
    txt.setAttribute('font-size',         '8');
    txt.setAttribute('letter-spacing',    '3');
    txt.setAttribute('fill',              'rgba(201,169,110,0.25)');
    txt.textContent = 'UPLOAD MEDIA TO SEE WAVEFORM';
    svg.appendChild(txt);
  }

  // ── Render from real Float32Array data ────────────────────
  /**
   * Render a waveform from downsampled channel data.
   * @param {Float32Array} samples   — normalised 0–1 amplitude values
   * @param {object}       options
   * @param {boolean}      options.tuned     — true = gold stroke
   * @param {number}       options.hz        — displayed in label if tuned
   * @param {number}       options.intensity — displayed in label if tuned
   * @param {string}       options.svgId     — target SVG element id
   */
  function renderFromData(samples, { tuned = false, hz = 432, intensity = 72, svgId = 'waveformSvg' } = {}) {
    const svg = document.getElementById(svgId);
    if (!svg || !samples || !samples.length) return;
    _clear(svg);

    const step  = W / samples.length;
    let   d     = `M 0 ${H / 2}`;

    for (let i = 0; i < samples.length; i++) {
      const x = i * step;
      const y = H / 2 - samples[i] * (H / 2 - 4) * (tuned ? 0.85 : 1);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    // Mirror — negative half
    for (let i = samples.length - 1; i >= 0; i--) {
      const x = i * step;
      const y = H / 2 + samples[i] * (H / 2 - 4) * (tuned ? 0.85 : 1);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    d += ' Z';

    const fill = document.createElementNS(SVG_NS, 'path');
    fill.setAttribute('d',    d);
    fill.setAttribute('fill', tuned ? 'rgba(201,169,110,0.08)' : 'rgba(201,169,110,0.04)');
    svg.appendChild(fill);

    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('d',            `M 0 ${H/2} ${samples.map((s,i) => `L ${(i*step).toFixed(1)} ${(H/2 - s*(H/2-4)*(tuned?0.85:1)).toFixed(1)}`).join(' ')}`);
    line.setAttribute('fill',         'none');
    line.setAttribute('stroke',       tuned ? '#C9A96E' : 'rgba(201,169,110,0.45)');
    line.setAttribute('stroke-width', tuned ? '1.5' : '1');
    svg.appendChild(line);

    if (tuned) {
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x',            W - 8);
      label.setAttribute('y',            13);
      label.setAttribute('text-anchor',  'end');
      label.setAttribute('font-family',  'DM Mono');
      label.setAttribute('font-size',    '8');
      label.setAttribute('letter-spacing', '2');
      label.setAttribute('fill',         'rgba(201,169,110,0.55)');
      label.textContent = `${hz} HZ · ALIGNED · ${intensity}%`;
      svg.appendChild(label);
    }
  }

  // ── Render generated (mathematical) waveform ─────────────
  /**
   * Render a mathematically generated waveform — used before real file data
   * is available, and for the processing simulation state.
   * @param {object} options
   * @param {boolean} options.tuned
   * @param {number}  options.hz
   * @param {number}  options.intensity
   * @param {string}  options.svgId
   */
  function renderGenerated({ tuned = false, hz = 432, intensity = 72, svgId = 'waveformSvg' } = {}) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    _clear(svg);

    const freqRatio    = hz / 440;
    const intensityFac = intensity / 100;
    let   d            = `M 0 ${H / 2}`;

    for (let x = 0; x <= W; x++) {
      const amp = tuned
        ? 18 * intensityFac
        : 26 * (0.7 + Math.sin(x * 0.03) * 0.3);
      const noise = tuned ? 0 : (Math.random() - 0.5) * 5;
      const y     = H / 2
        + Math.sin(x * 0.07 * (tuned ? freqRatio : 1)) * amp * Math.sin(x * 0.014)
        + noise;
      d += ` L ${x} ${y.toFixed(2)}`;
    }

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d',            d);
    path.setAttribute('fill',         'none');
    path.setAttribute('stroke',       tuned ? '#C9A96E' : 'rgba(201,169,110,0.4)');
    path.setAttribute('stroke-width', tuned ? '1.5' : '1');
    svg.appendChild(path);

    if (tuned) {
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x',             W - 8);
      label.setAttribute('y',             13);
      label.setAttribute('text-anchor',   'end');
      label.setAttribute('font-family',   'DM Mono');
      label.setAttribute('font-size',     '8');
      label.setAttribute('letter-spacing','2');
      label.setAttribute('fill',          'rgba(201,169,110,0.55)');
      label.textContent = `${hz} HZ · ALIGNED · ${intensity}%`;
      svg.appendChild(label);
    }
  }

  // ── Public API ────────────────────────────────────────────
  return {
    renderEmpty,
    renderFromData,
    renderGenerated,
  };

})();
