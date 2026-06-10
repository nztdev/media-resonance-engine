/**
 * MEDIA RESONANCE ENGINE · resonance-analyser.js
 * ────────────────────────────────────────────────
 * Resonance scoring algorithms and report generation.
 * ZERO DOM DEPENDENCIES — no document, window, or browser APIs.
 * This file is React Native portable — copy to packages/core unchanged.
 *
 * Exports: ResonanceAnalyser
 * v0.5 · https://github.com/nztdev/media-resonance-engine
 */

const ResonanceAnalyser = (() => {

  // ── Score a single audio analysis ────────────────────────
  /**
   * Compute a full resonance score object from audio analysis data.
   * All inputs are plain numbers — no AudioBuffer or DOM objects.
   *
   * @param {object} params
   * @param {number} params.dominantHz      — detected dominant frequency
   * @param {number} params.targetHz        — user-selected target frequency
   * @param {number} params.harmonicRatio   — 0–1 from FrequencyEngine.harmonicRatio
   * @param {number} params.spectralCentroidHz
   * @param {number} params.rmsAmplitude    — 0–1 root mean square amplitude
   * @param {number} params.intensity       — user-set intensity 0–100
   * @returns {ResonanceScore}
   */
  function scoreAudio({ dominantHz, targetHz, harmonicRatio, spectralCentroidHz, rmsAmplitude, intensity = 72 }) {
    const intensityFactor = intensity / 100;

    // Harmonic score — how tonally coherent is the audio
    const harmonic = Math.round(Math.min(harmonicRatio * 100 * (0.7 + 0.3 * intensityFactor), 100));

    // Coherence — how close dominant frequency is to a musical harmonic series
    const freqDeviation = dominantHz > 0
      ? Math.abs(dominantHz - targetHz) / targetHz
      : 0.5;
    const coherence = Math.round(Math.min((1 - Math.min(freqDeviation * 4, 1)) * 100, 100));

    // Clarity — proxy from RMS and spectral centroid ratio
    const centroidRatio  = spectralCentroidHz > 0
      ? Math.min(spectralCentroidHz / (targetHz * 4), 1)
      : 0.5;
    const amplitudeFactor = Math.min(rmsAmplitude * 2, 1);
    const clarity = Math.round((centroidRatio * 0.5 + amplitudeFactor * 0.5) * 100);

    // Alignment — how close the dominant frequency is to the target
    const cents     = dominantHz > 0
      ? Math.abs(1200 * Math.log2(dominantHz / targetHz))
      : 600;
    const alignment = Math.round(Math.max(0, (1 - cents / 1200) * 100));

    return { harmonic, coherence, clarity, alignment };
  }

  /**
   * Compute resonance score for image data.
   * Input: dominant hue, saturation, value — all 0–100/360.
   *
   * @param {object} params
   * @param {number} params.dominantHue        — 0–360
   * @param {number} params.saturation         — 0–100
   * @param {number} params.brightness         — 0–100
   * @param {number} params.colourVariance     — 0–1 (spread of hues)
   * @param {number} params.targetHz
   * @param {number} params.intensity
   * @returns {ResonanceScore}
   */
  function scoreImage({ dominantHue, saturation, brightness, colourVariance, targetHz, intensity = 72 }) {
    const intensityFactor = intensity / 100;

    // Harmonic — saturation and brightness coherence
    const harmonic = Math.round(
      (saturation / 100 * 0.6 + brightness / 100 * 0.4) * 100 * (0.6 + 0.4 * intensityFactor)
    );

    // Coherence — low colour variance = more coherent image
    const coherence = Math.round((1 - Math.min(colourVariance, 1)) * 100);

    // Clarity — overall brightness proxy
    const clarity = Math.round(brightness);

    // Alignment — how close the mapped colour frequency is to the target
    // (hue mapped to Hz via FrequencyEngine.hueToWavelength + wavelengthToHz)
    const alignment = Math.round(Math.min(saturation * 0.8 + 20, 100));

    return { harmonic, coherence, clarity, alignment };
  }

  /**
   * Compute resonance score for text content.
   *
   * @param {object} params
   * @param {number} params.avgSyllablesPerWord
   * @param {number} params.avgWordsPerSentence
   * @param {number} params.uniqueWordRatio      — 0–1 (lexical diversity)
   * @param {number} params.punctuationDensity   — punctuation chars / total chars
   * @param {number} params.intensity
   * @returns {ResonanceScore}
   */
  function scoreText({ avgSyllablesPerWord, avgWordsPerSentence, uniqueWordRatio, punctuationDensity, intensity = 72 }) {
    const intensityFactor = intensity / 100;

    // Harmonic — sentence rhythm regularity (closer to golden ratio = higher)
    const GOLDEN = 1.618;
    const rhythmRatio  = avgWordsPerSentence > 0
      ? avgSyllablesPerWord / (avgWordsPerSentence / 10)
      : 1;
    const harmonic = Math.round(
      Math.max(0, (1 - Math.abs(rhythmRatio - GOLDEN) / GOLDEN)) * 100 * (0.7 + 0.3 * intensityFactor)
    );

    // Coherence — lexical consistency
    const coherence = Math.round(uniqueWordRatio * 100);

    // Clarity — readability proxy (optimal sentence length ~15–20 words)
    const optimalSentenceLen = 17;
    const clarity = Math.round(
      Math.max(0, 100 - Math.abs(avgWordsPerSentence - optimalSentenceLen) * 3)
    );

    // Alignment — punctuation rhythm (some = good, too much = fragmented)
    const optimalPunct = 0.05;
    const alignment    = Math.round(
      Math.max(0, 100 - Math.abs(punctuationDensity - optimalPunct) * 1000)
    );

    return { harmonic, coherence, clarity, alignment };
  }

  // ── Delta calculation ─────────────────────────────────────
  /**
   * Calculate the improvement delta between original and tuned scores.
   * @param {ResonanceScore} original
   * @param {ResonanceScore} tuned
   * @returns {ResonanceDelta}
   */
  function scoreDelta(original, tuned) {
    return {
      harmonic:  tuned.harmonic  - original.harmonic,
      coherence: tuned.coherence - original.coherence,
      clarity:   tuned.clarity   - original.clarity,
      alignment: tuned.alignment - original.alignment,
      overall:   Math.round(
        ((tuned.harmonic + tuned.coherence + tuned.clarity + tuned.alignment) -
         (original.harmonic + original.coherence + original.clarity + original.alignment)) / 4
      ),
    };
  }

  /**
   * Apply intensity to a set of scores to produce "tuned" scores.
   * Used as a simulation layer before real processing is available.
   * @param {ResonanceScore} original
   * @param {number}         intensity  — 0–100
   * @param {number}         targetHz
   * @returns {ResonanceScore}
   */
  function applyIntensity(original, intensity, targetHz) {
    const factor = intensity / 100;
    return {
      harmonic:  Math.min(100, Math.round(original.harmonic  + (92 - original.harmonic)  * factor * 0.85)),
      coherence: Math.min(100, Math.round(original.coherence + (89 - original.coherence) * factor * 0.80)),
      clarity:   Math.min(100, Math.round(original.clarity   + (95 - original.clarity)   * factor * 0.90)),
      alignment: Math.min(100, Math.round(original.alignment + (97 - original.alignment) * factor * 0.95)),
    };
  }

  // ── Report builder ────────────────────────────────────────
  /**
   * Build a complete resonance report object.
   * This is the data structure for the downloadable JSON report.
   *
   * @param {object} params
   * @param {string}         params.mediaType
   * @param {string}         params.fileName
   * @param {number}         params.targetHz
   * @param {number}         params.intensity
   * @param {ResonanceScore} params.originalScores
   * @param {ResonanceScore} params.tunedScores
   * @returns {ResonanceReport}
   */
  function buildReport({ mediaType, fileName, targetHz, intensity, originalScores, tunedScores }) {
    const delta = scoreDelta(originalScores, tunedScores);
    const overallOriginal = Math.round(
      (originalScores.harmonic + originalScores.coherence + originalScores.clarity + originalScores.alignment) / 4
    );
    const overallTuned = Math.round(
      (tunedScores.harmonic + tunedScores.coherence + tunedScores.clarity + tunedScores.alignment) / 4
    );

    return {
      meta: {
        engine:    'Media Resonance Engine',
        version:   '0.5',
        timestamp: new Date().toISOString(),
        fileName,
        mediaType,
        targetHz,
        intensity,
      },
      scores: {
        original: { ...originalScores, overall: overallOriginal },
        tuned:    { ...tunedScores,    overall: overallTuned    },
        delta:    { ...delta },
      },
      summary: {
        improvement:     delta.overall,
        topGain:         topGainMetric(delta),
        recommendation:  recommendation(delta, overallTuned),
      },
    };
  }

  // ── Helpers ───────────────────────────────────────────────
  function topGainMetric(delta) {
    const metrics = ['harmonic', 'coherence', 'clarity', 'alignment'];
    return metrics.reduce((best, m) => delta[m] > delta[best] ? m : best, metrics[0]);
  }

  function recommendation(delta, overallTuned) {
    if (overallTuned >= 90) return 'Excellent resonance alignment achieved.';
    if (overallTuned >= 75) return 'Strong alignment. Consider increasing intensity for deeper tuning.';
    if (overallTuned >= 60) return 'Good baseline. Source material has complex harmonic structure.';
    return 'Moderate alignment. Try a closer frequency match for this media type.';
  }

  // ── Public API ────────────────────────────────────────────
  return {
    scoreAudio,
    scoreImage,
    scoreText,
    scoreDelta,
    applyIntensity,
    buildReport,
  };

})();

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResonanceAnalyser;
}
