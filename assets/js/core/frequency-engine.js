/**
 * MEDIA RESONANCE ENGINE · frequency-engine.js
 * ─────────────────────────────────────────────
 * Pure frequency calculation functions.
 * ZERO DOM DEPENDENCIES — no document, window, or browser APIs.
 * This file is React Native portable — copy to packages/core unchanged.
 *
 * Exports: FrequencyEngine
 * v0.6 · https://github.com/[your-username]/media-resonance-engine
 */

const FrequencyEngine = (() => {

  // ── Constants ──────────────────────────────────────────────
  const STANDARD_TUNING  = 440;   // Hz — concert A
  const SCHUMANN         = 7.83;  // Hz — Earth resonance fundamental
  const SEMITONE_RATIO   = Math.pow(2, 1 / 12);

  // ── Pitch ratio ────────────────────────────────────────────
  /**
   * Calculate the ratio needed to shift from one frequency to another.
   * Used as the resampling multiplier.
   * @param {number} fromHz  — source frequency
   * @param {number} toHz    — target frequency
   * @returns {number} ratio — multiply sample rate by this value
   */
  function pitchRatio(fromHz, toHz) {
    if (!fromHz || fromHz <= 0) return 1;
    return toHz / fromHz;
  }

  /**
   * Calculate how many cents separate two frequencies.
   * 100 cents = 1 semitone. Used for reporting.
   * @param {number} fromHz
   * @param {number} toHz
   * @returns {number} cents (positive = sharp, negative = flat)
   */
  function centsDelta(fromHz, toHz) {
    if (!fromHz || fromHz <= 0) return 0;
    return 1200 * Math.log2(toHz / fromHz);
  }

  /**
   * Convert a frequency in Hz to the nearest MIDI note number.
   * @param {number} hz
   * @returns {number} midiNote
   */
  function hzToMidi(hz) {
    return Math.round(69 + 12 * Math.log2(hz / STANDARD_TUNING));
  }

  /**
   * Convert a MIDI note number to Hz using a given tuning reference.
   * @param {number} midi
   * @param {number} tuningHz — reference A frequency (default 440)
   * @returns {number} hz
   */
  function midiToHz(midi, tuningHz = STANDARD_TUNING) {
    return tuningHz * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Snap a frequency to the nearest harmonic of a target frequency.
   * Finds the octave multiple of targetHz closest to inputHz.
   * @param {number} inputHz
   * @param {number} targetHz
   * @returns {number} snappedHz
   */
  function snapToHarmonic(inputHz, targetHz) {
    if (!inputHz || inputHz <= 0 || !targetHz || targetHz <= 0) return targetHz;
    const ratio = inputHz / targetHz;
    const octave = Math.round(Math.log2(ratio));
    return targetHz * Math.pow(2, octave);
  }

  // ── Frequency analysis ────────────────────────────────────
  /**
   * Find the dominant frequency bin in a magnitude spectrum.
   * Works with the output of an FFT (e.g., AnalyserNode.getFloatFrequencyData).
   * @param {Float32Array} magnitudeSpectrum — dB values from FFT
   * @param {number}       sampleRate        — audio sample rate
   * @param {number}       fftSize           — FFT window size
   * @returns {number} dominantFrequencyHz
   */
  function dominantFrequency(magnitudeSpectrum, sampleRate, fftSize) {
    let maxMag = -Infinity;
    let maxIdx = 0;
    const binCount = magnitudeSpectrum.length;

    for (let i = 1; i < binCount; i++) {
      if (magnitudeSpectrum[i] > maxMag) {
        maxMag = magnitudeSpectrum[i];
        maxIdx = i;
      }
    }

    // Parabolic interpolation for sub-bin accuracy
    if (maxIdx > 0 && maxIdx < binCount - 1) {
      const alpha = magnitudeSpectrum[maxIdx - 1];
      const beta  = magnitudeSpectrum[maxIdx];
      const gamma = magnitudeSpectrum[maxIdx + 1];
      const offset = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
      maxIdx += offset;
    }

    return (maxIdx * sampleRate) / fftSize;
  }

  /**
   * Find the fundamental (lowest significant) frequency in a spectrum.
   * Unlike dominantFrequency() which finds the highest energy bin,
   * this finds the lowest peak with energy above a significance threshold.
   * More accurate for pitched material like music and voice.
   *
   * @param {Float32Array} magnitudeSpectrum — linear magnitudes
   * @param {number}       sampleRate
   * @param {number}       fftSize
   * @param {number}       minHz             — ignore below this (default 60Hz)
   * @param {number}       maxHz             — ignore above this (default 2000Hz)
   * @param {number}       threshold         — min magnitude relative to peak (default 0.05)
   * @returns {number} fundamentalFrequencyHz
   */
  function fundamentalFrequency(magnitudeSpectrum, sampleRate, fftSize,
    minHz = 60, maxHz = 2000, threshold = 0.05) {

    const binHz  = sampleRate / fftSize;
    const minBin = Math.ceil(minHz / binHz);
    const maxBin = Math.min(Math.floor(maxHz / binHz), magnitudeSpectrum.length - 1);

    // Find peak magnitude for relative threshold
    let peakMag = 0;
    for (let i = minBin; i <= maxBin; i++) {
      if (magnitudeSpectrum[i] > peakMag) peakMag = magnitudeSpectrum[i];
    }
    const minMag = peakMag * threshold;

    // Find lowest local peak above threshold
    for (let i = minBin + 1; i < maxBin - 1; i++) {
      const m = magnitudeSpectrum[i];
      if (m >= minMag &&
          m > magnitudeSpectrum[i - 1] &&
          m > magnitudeSpectrum[i + 1]) {

        // Parabolic interpolation for sub-bin accuracy
        const alpha  = magnitudeSpectrum[i - 1];
        const beta   = m;
        const gamma  = magnitudeSpectrum[i + 1];
        const denom  = alpha - 2 * beta + gamma;
        const offset = denom !== 0 ? 0.5 * (alpha - gamma) / denom : 0;
        return (i + offset) * binHz;
      }
    }

    // Fallback to dominant if no fundamental found in range
    return dominantFrequency(magnitudeSpectrum, sampleRate, fftSize);
  }

  /**
   * Compute spectral centroid — the "centre of mass" of the spectrum.
   * A higher centroid = brighter, more high-frequency content.
   * @param {Float32Array} magnitudeSpectrum — linear magnitudes (not dB)
   * @param {number}       sampleRate
   * @param {number}       fftSize
   * @returns {number} spectralCentroidHz
   */
  function spectralCentroid(magnitudeSpectrum, sampleRate, fftSize) {
    let weightedSum = 0;
    let magnitudeSum = 0;
    const binHz = sampleRate / fftSize;

    for (let i = 0; i < magnitudeSpectrum.length; i++) {
      const mag = Math.abs(magnitudeSpectrum[i]);
      weightedSum  += i * binHz * mag;
      magnitudeSum += mag;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * Calculate the harmonic ratio — proportion of energy in harmonic
   * partials vs total energy. Proxy for tonal coherence.
   * @param {Float32Array} magnitudeSpectrum — linear
   * @param {number}       fundamentalHz
   * @param {number}       sampleRate
   * @param {number}       fftSize
   * @param {number}       harmonicsToCheck  — default 8
   * @returns {number} ratio 0–1 (1 = perfectly harmonic)
   */
  function harmonicRatio(magnitudeSpectrum, fundamentalHz, sampleRate, fftSize, harmonicsToCheck = 8) {
    const binHz = sampleRate / fftSize;
    let harmonicEnergy = 0;
    let totalEnergy    = 0;

    for (let i = 0; i < magnitudeSpectrum.length; i++) {
      const energy = magnitudeSpectrum[i] * magnitudeSpectrum[i];
      totalEnergy += energy;

      const freqHz     = i * binHz;
      const nearestN   = Math.round(freqHz / fundamentalHz);
      if (nearestN >= 1 && nearestN <= harmonicsToCheck) {
        const deviation = Math.abs(freqHz - nearestN * fundamentalHz);
        const tolerance = fundamentalHz * 0.1;
        if (deviation <= tolerance) harmonicEnergy += energy;
      }
    }

    return totalEnergy > 0 ? Math.min(harmonicEnergy / totalEnergy, 1) : 0;
  }

  // ── Pitch shifting (resampling approach) ─────────────────
  /**
   * Resample an AudioBuffer to achieve pitch shifting.
   * Simple and fast — changes pitch AND tempo slightly.
   * Used as the v0.6 Phase 1 approach before phase vocoder.
   *
   * NOTE: This function accepts and returns plain data objects,
   * not AudioBuffer instances, to remain DOM-free.
   * The UI layer handles AudioBuffer creation/decoding.
   *
   * @param {Float32Array[]} channelData   — array of channel data arrays
   * @param {number}         originalRate  — source sample rate
   * @param {number}         pitchRatioVal — from pitchRatio()
   * @returns {{ channelData: Float32Array[], newSampleRate: number }}
   */
  function resampleChannelData(channelData, originalRate, pitchRatioVal) {
    const newSampleRate = Math.round(originalRate * pitchRatioVal);
    const result = channelData.map(channel => {
      const originalLength = channel.length;
      const newLength      = Math.round(originalLength / pitchRatioVal);
      const resampled      = new Float32Array(newLength);

      for (let i = 0; i < newLength; i++) {
        const srcPos  = i * pitchRatioVal;
        const srcIdx  = Math.floor(srcPos);
        const frac    = srcPos - srcIdx;

        const s0 = channel[Math.min(srcIdx,     originalLength - 1)];
        const s1 = channel[Math.min(srcIdx + 1, originalLength - 1)];

        // Linear interpolation
        resampled[i] = s0 + frac * (s1 - s0);
      }

      return resampled;
    });

    return { channelData: result, newSampleRate };
  }

  // ── Alignment score ───────────────────────────────────────
  /**
   * Calculate how closely aligned a frequency is to a target.
   * Returns 0–100 where 100 = perfect alignment.
   * @param {number} detectedHz
   * @param {number} targetHz
   * @param {number} toleranceCents — acceptable deviation (default 50c = quarter tone)
   * @returns {number} alignmentScore 0–100
   */
  function alignmentScore(detectedHz, targetHz, toleranceCents = 50) {
    const cents = Math.abs(centsDelta(detectedHz, targetHz));
    if (cents >= toleranceCents) return 0;
    return Math.round((1 - cents / toleranceCents) * 100);
  }

  // ── Colour frequency mapping ──────────────────────────────
  /**
   * Map a visible light wavelength (nm) to an equivalent audio frequency (Hz).
   * Maps the visible spectrum (380–700nm) to the solfège frequency range (396–963Hz).
   * Pure mathematical mapping — no scientific claim.
   * @param {number} wavelengthNm — 380 (violet) to 700 (red)
   * @returns {number} mappedHz
   */
  function wavelengthToHz(wavelengthNm) {
    const minWl = 380, maxWl = 700;
    const minHz = 963, maxHz = 396; // inverted: short wavelength = high freq

    const normalized = (wavelengthNm - minWl) / (maxWl - minWl);
    return Math.round(minHz + normalized * (maxHz - minHz));
  }

  /**
   * Convert HSL hue (0–360) to approximate wavelength (nm).
   * Hue 0/360 = red, 120 = green, 240 = blue.
   * @param {number} hue — 0 to 360
   * @returns {number} wavelengthNm
   */
  function hueToWavelength(hue) {
    // Approximate mapping: hue 0=red(700nm), 60=yellow(580nm),
    // 120=green(530nm), 180=cyan(490nm), 240=blue(450nm), 300=violet(400nm)
    const hueMapped = hue % 360;
    return Math.round(700 - (hueMapped / 360) * 320);
  }

  // ── Public API ────────────────────────────────────────────
  return {
    // Constants
    STANDARD_TUNING,
    SCHUMANN,
    SEMITONE_RATIO,

    // Pitch
    pitchRatio,
    centsDelta,
    hzToMidi,
    midiToHz,
    snapToHarmonic,

    // Analysis
    dominantFrequency,
    fundamentalFrequency,
    spectralCentroid,
    harmonicRatio,

    // Processing
    resampleChannelData,

    // Scoring
    alignmentScore,

    // Colour mapping
    wavelengthToHz,
    hueToWavelength,
  };

})();

// Export for module environments (React Native / Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FrequencyEngine;
}