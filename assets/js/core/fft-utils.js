/**
 * MEDIA RESONANCE ENGINE · fft-utils.js
 * ────────────────────────────────────────
 * FFT helper functions and spectrum utilities.
 * ZERO DOM DEPENDENCIES.
 * React Native portable — copy to packages/core unchanged.
 *
 * Note: The Web Audio API's AnalyserNode provides FFT data in the browser.
 * In React Native, these utilities are used with a custom DSP implementation.
 * The functions here operate on plain Float32Array data regardless of source.
 *
 * v0.3 · https://github.com/[your-username]/media-resonance-engine
 */

const FFTUtils = (() => {

  /**
   * Convert dB magnitude spectrum to linear magnitudes.
   * Web Audio API returns dB values; many algorithms need linear.
   * @param {Float32Array} dbSpectrum
   * @returns {Float32Array} linearSpectrum
   */
  function dbToLinear(dbSpectrum) {
    const linear = new Float32Array(dbSpectrum.length);
    for (let i = 0; i < dbSpectrum.length; i++) {
      linear[i] = Math.pow(10, dbSpectrum[i] / 20);
    }
    return linear;
  }

  /**
   * Convert linear magnitude spectrum to dB.
   * @param {Float32Array} linearSpectrum
   * @returns {Float32Array} dbSpectrum
   */
  function linearToDb(linearSpectrum) {
    const db = new Float32Array(linearSpectrum.length);
    for (let i = 0; i < linearSpectrum.length; i++) {
      db[i] = linearSpectrum[i] > 0
        ? 20 * Math.log10(linearSpectrum[i])
        : -Infinity;
    }
    return db;
  }

  /**
   * Calculate RMS (root mean square) amplitude of a time-domain signal.
   * Returns 0–1 approximate loudness value.
   * @param {Float32Array} timeDomainData
   * @returns {number} rms 0–1
   */
  function rmsAmplitude(timeDomainData) {
    let sum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      sum += timeDomainData[i] * timeDomainData[i];
    }
    return Math.sqrt(sum / timeDomainData.length);
  }

  /**
   * Downsample a waveform array to a target number of points.
   * Used to render waveforms in SVG without processing every sample.
   * @param {Float32Array} channelData  — raw audio samples
   * @param {number}       targetPoints — number of output points
   * @returns {Float32Array} downsampled
   */
  function downsample(channelData, targetPoints) {
    const blockSize = Math.floor(channelData.length / targetPoints);
    const output    = new Float32Array(targetPoints);

    for (let i = 0; i < targetPoints; i++) {
      const start = i * blockSize;
      let   sum   = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      output[i] = sum / blockSize;
    }

    // Normalise to 0–1
    const max = Math.max(...output, 0.001);
    for (let i = 0; i < output.length; i++) {
      output[i] = output[i] / max;
    }

    return output;
  }

  /**
   * Apply a Hann window to a time-domain buffer.
   * Reduces spectral leakage before FFT analysis.
   * @param {Float32Array} buffer
   * @returns {Float32Array} windowed
   */
  function hannWindow(buffer) {
    const windowed = new Float32Array(buffer.length);
    const N        = buffer.length;
    for (let i = 0; i < N; i++) {
      const w      = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
      windowed[i]  = buffer[i] * w;
    }
    return windowed;
  }

  /**
   * Find the top N frequency peaks in a magnitude spectrum.
   * Useful for multi-harmonic analysis.
   * @param {Float32Array} magnitudeSpectrum — linear
   * @param {number}       sampleRate
   * @param {number}       fftSize
   * @param {number}       n                — number of peaks to find
   * @param {number}       minHz            — ignore below this (default 20Hz)
   * @returns {Array<{hz: number, magnitude: number}>}
   */
  function topPeaks(magnitudeSpectrum, sampleRate, fftSize, n = 5, minHz = 20) {
    const binHz  = sampleRate / fftSize;
    const minBin = Math.ceil(minHz / binHz);
    const peaks  = [];

    for (let i = minBin + 1; i < magnitudeSpectrum.length - 1; i++) {
      if (
        magnitudeSpectrum[i] > magnitudeSpectrum[i - 1] &&
        magnitudeSpectrum[i] > magnitudeSpectrum[i + 1]
      ) {
        peaks.push({ hz: i * binHz, magnitude: magnitudeSpectrum[i] });
      }
    }

    return peaks
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, n);
  }

  return {
    dbToLinear,
    linearToDb,
    rmsAmplitude,
    downsample,
    hannWindow,
    topPeaks,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FFTUtils;
}
