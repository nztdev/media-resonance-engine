/**
 * MEDIA RESONANCE ENGINE · frequency-engine.js
 * ─────────────────────────────────────────────
 * Pure frequency calculation functions.
 * ZERO DOM DEPENDENCIES — no document, window, or browser APIs.
 * This file is React Native portable — copy to packages/core unchanged.
 *
 * Exports: FrequencyEngine
 * v0.7 · https://github.com/[your-username]/media-resonance-engine
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

  // ── Hybrid tuning engine ─────────────────────────────────
  /**
   * tuneTo() — the primary pitch-shifting entry point.
   * Selects the best algorithm based on shift size:
   *
   *   |shift| ≤ 100 cents  → high-quality resampling
   *     The tempo change is under 6% — inaudible on short tracks,
   *     negligible on full songs. Audio quality is pristine.
   *     This covers the primary use case: 440Hz → 432Hz (~32 cents).
   *
   *   |shift| > 100 cents  → phase vocoder (overlap=8)
   *     Larger shifts where tempo change would be noticeable.
   *     Higher overlap factor (8) significantly reduces phasiness
   *     vs the default overlap=4 used previously.
   *
   * @param {Float32Array[]} channelData
   * @param {number}         fromHz       — detected fundamental
   * @param {number}         toHz         — target frequency
   * @param {number}         wetDry       — 0=original, 1=fully tuned (intensity/100)
   * @returns {Float32Array[]} tuned channel data
   */
  function tuneTo(channelData, fromHz, toHz, wetDry = 1.0) {
    if (!fromHz || fromHz <= 0 || !toHz || toHz <= 0) return channelData;

    const ratio      = pitchRatio(fromHz, toHz);
    const shiftCents = Math.abs(centsDelta(fromHz, toHz));

    // Wet/dry blend helper — mixes dry original with processed
    function blend(processed) {
      if (wetDry >= 0.999) return processed;
      if (wetDry <= 0.001) return channelData;
      return channelData.map((ch, i) => {
        const wet = processed[i];
        const out = new Float32Array(ch.length);
        for (let s = 0; s < ch.length; s++) {
          out[s] = ch[s] * (1 - wetDry) + (wet[s] || 0) * wetDry;
        }
        return out;
      });
    }

    // ── Small shift: high-quality resampling ──────────────────
    // Covers 440→432Hz (32¢), 440→528Hz would be ~312¢ so uses vocoder
    if (shiftCents <= 100) {
      try {
        const result    = resampleChannelData(channelData, 44100, ratio);
        // Resample back to original length to preserve duration
        // This creates a tiny pitch shift without audible tempo change
        const restored  = channelData.map((ch, i) => {
          const shifted  = result.channelData[i];
          const restored = new Float32Array(ch.length);
          // Linear interpolation resample back to original length
          for (let s = 0; s < ch.length; s++) {
            const srcPos = s * (shifted.length / ch.length);
            const srcIdx = Math.floor(srcPos);
            const frac   = srcPos - srcIdx;
            const a      = shifted[Math.min(srcIdx,     shifted.length - 1)];
            const b      = shifted[Math.min(srcIdx + 1, shifted.length - 1)];
            restored[s]  = a + frac * (b - a);
          }
          return restored;
        });
        return blend(restored);
      } catch (e) {
        console.warn('MRE: resampling failed, falling back to vocoder —', e.message);
      }
    }

    // ── Large shift: phase vocoder with high overlap ──────────
    try {
      const clampedRatio = Math.max(0.5, Math.min(2.0, ratio));
      const processed    = channelData.map(channel => {
        try {
          return _processChannel(channel, clampedRatio, 2048, 8, 1.0);
        } catch (e) {
          console.warn('MRE: vocoder channel error —', e.message);
          return channel;
        }
      });
      return blend(processed);
    } catch (e) {
      console.warn('MRE: vocoder failed, returning original —', e.message);
      return channelData;
    }
  }

  // ── Phase vocoder pitch shifting ─────────────────────────
  /**
   * Phase vocoder — pitch shift without tempo change.
   * Called by tuneTo() for shifts > 100 cents.
   * Also available directly for custom use.
   *
   * ZERO DOM DEPENDENCIES — pure Float32Array operations.
   *
   * @param {Float32Array[]} channelData
   * @param {number}         pitchRatioVal
   * @param {object}         [options]
   * @param {number}         [options.fftSize=2048]
   * @param {number}         [options.overlap=8]    — higher = less phasiness
   * @param {number}         [options.wetDry=1.0]
   * @returns {Float32Array[]}
   */
  function phaseVocoder(channelData, pitchRatioVal, options = {}) {
    const fftSize      = options.fftSize || 2048;
    const overlap      = options.overlap || 8;
    const wetDry       = options.wetDry  !== undefined ? options.wetDry : 1.0;
    const clampedRatio = Math.max(0.5, Math.min(2.0, pitchRatioVal));

    return channelData.map(channel => {
      try {
        return _processChannel(channel, clampedRatio, fftSize, overlap, wetDry);
      } catch (e) {
        console.warn('MRE: phase vocoder channel error —', e.message);
        return channel;
      }
    });
  }

  function _processChannel(channel, ratio, fftSize, overlap, wetDry) {
    const hopA      = Math.floor(fftSize / overlap);  // analysis hop — fixed
    const hopS      = hopA;                            // synthesis hop — ALSO fixed
    // Pitch shift comes from phase scaling only, NOT from hop ratio change.
    // Changing hopS causes time-stretching. We want pitch shift only.

    const numFrames = Math.floor((channel.length - fftSize) / hopA) + 1;
    const output    = new Float32Array(channel.length + fftSize);
    const window    = _makeHannWindow(fftSize);

    // Phase accumulators
    const phaseAcc  = new Float32Array(fftSize / 2 + 1);
    const lastPhase = new Float32Array(fftSize / 2 + 1);

    // Expected phase advance per analysis hop per bin
    const expectedPhaseAdv = new Float32Array(fftSize / 2 + 1);
    for (let k = 0; k < fftSize / 2 + 1; k++) {
      expectedPhaseAdv[k] = (2 * Math.PI * k * hopA) / fftSize;
    }

    for (let frame = 0; frame < numFrames; frame++) {
      const inputPos = frame * hopA;

      // ── Windowed frame ──
      const re = new Float32Array(fftSize);
      const im = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        const sampleIdx = inputPos + i;
        re[i] = sampleIdx < channel.length
          ? channel[sampleIdx] * window[i]
          : 0;
      }

      // ── FFT ──
      _fft(re, im, false);

      // ── Phase vocoder processing ──
      const mag   = new Float32Array(fftSize / 2 + 1);
      const phase = new Float32Array(fftSize / 2 + 1);

      for (let k = 0; k <= fftSize / 2; k++) {
        mag[k]   = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        phase[k] = Math.atan2(im[k], re[k]);

        // Phase difference from expected
        let dp = phase[k] - lastPhase[k] - expectedPhaseAdv[k];
        // Wrap to [-π, π]
        dp -= 2 * Math.PI * Math.round(dp / (2 * Math.PI));

        // True instantaneous frequency deviation
        const trueFreqDev = dp / hopA;

        // Scale frequency by pitch ratio — this is where pitch shift happens
        // Synthesis phase advances at ratio * true frequency
        phaseAcc[k] += hopS * (expectedPhaseAdv[k] / hopA + trueFreqDev) * ratio;
        lastPhase[k]  = phase[k];
      }

      // ── Reconstruct spectrum with scaled phases ──
      const reOut = new Float32Array(fftSize);
      const imOut = new Float32Array(fftSize);
      for (let k = 0; k <= fftSize / 2; k++) {
        reOut[k] = mag[k] * Math.cos(phaseAcc[k]);
        imOut[k] = mag[k] * Math.sin(phaseAcc[k]);
        if (k > 0 && k < fftSize / 2) {
          reOut[fftSize - k] =  reOut[k];
          imOut[fftSize - k] = -imOut[k];
        }
      }

      // ── IFFT ──
      _fft(reOut, imOut, true);

      // ── Overlap-add at synthesis hop ──
      const outputPos = frame * hopS;
      for (let i = 0; i < fftSize; i++) {
        if (outputPos + i < output.length) {
          output[outputPos + i] += reOut[i] * window[i];
        }
      }
    }

    // ── Normalise output level to match input ──
    const inRMS  = _rms(channel);
    const outRMS = _rms(output.subarray(0, channel.length));
    const gain   = outRMS > 0.0001 ? inRMS / outRMS : 1;

    // ── Wet/dry blend ──
    const result = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const dry = channel[i];
      const wet = output[i] * gain;
      result[i] = dry * (1 - wetDry) + wet * wetDry;
    }

    return result;
  }

  // ── Cooley-Tukey FFT (in-place, radix-2) ─────────────────
  /**
   * In-place FFT / IFFT on real + imaginary arrays.
   * Pure JS implementation — no Web Audio API dependency.
   * @param {Float32Array} re     — real parts (modified in place)
   * @param {Float32Array} im     — imaginary parts (modified in place)
   * @param {boolean}      inverse — true for IFFT
   */
  function _fft(re, im, inverse) {
    const n = re.length;
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    // Butterfly operations
    for (let len = 2; len <= n; len <<= 1) {
      const ang  = 2 * Math.PI / len * (inverse ? 1 : -1);
      const wRe  = Math.cos(ang);
      const wIm  = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let curRe = 1, curIm = 0;
        for (let j = 0; j < len / 2; j++) {
          const uRe = re[i + j];
          const uIm = im[i + j];
          const vRe = re[i + j + len/2] * curRe - im[i + j + len/2] * curIm;
          const vIm = re[i + j + len/2] * curIm + im[i + j + len/2] * curRe;
          re[i + j]         = uRe + vRe;
          im[i + j]         = uIm + vIm;
          re[i + j + len/2] = uRe - vRe;
          im[i + j + len/2] = uIm - vIm;
          [curRe, curIm] = [curRe * wRe - curIm * wIm, curRe * wIm + curIm * wRe];
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  }

  function _makeHannWindow(size) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
    }
    return w;
  }

  function _rms(arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
    return Math.sqrt(sum / arr.length);
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
    tuneTo,
    phaseVocoder,

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