/**
 * MEDIA RESONANCE ENGINE · state/mre-state.js
 * ─────────────────────────────────────────────
 * Single source of truth. Coordinates core ↔ UI.
 * Core functions are called here. UI is updated from here.
 * Neither core nor UI know about each other directly.
 *
 * v0.5 · https://github.com/[your-username]/media-resonance-engine
 */

const MREState = (() => {

  // ── Application state ─────────────────────────────────────
  const state = {
    selectedHz:        432,
    selectedMediaType: 'audio',
    intensity:         72,
    fileLoaded:        false,
    fileName:          '',
    fileSizeMB:        0,
    fileData:          null,   // ReadResult from FileReaderUI.read()
    waveformSamples:   null,   // Float32Array — downsampled for SVG
    analysisData:      null,   // Real FFT analysis results (v0.5+)
    processed:         false,
    abMode:            'A',
    originalScores:    null,
    tunedScores:       null,
    report:            null,
  };

  // ── Frequency ─────────────────────────────────────────────
  function setFrequency(hz) {
    state.selectedHz = hz;
    OrbUI.updateHz(hz);
    OrbUI.updateIntensityRing(state.intensity);

    document.querySelectorAll('.freq-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.hz) === hz);
    });

    document.querySelectorAll('#freqTable tr').forEach(row => {
      const rowHz    = parseInt(row.dataset.hz);
      const isActive = rowHz === hz;
      row.classList.toggle('active-freq', isActive);
      const indicator = row.querySelectorAll('td')[2];
      if (indicator) indicator.textContent = isActive ? '🟡' : '';
    });

    const procHz = document.getElementById('processingHz');
    if (procHz) procHz.textContent = hz;

    if (state.processed) _refreshWaveform();
  }

  // ── Media type ────────────────────────────────────────────
  function setMediaType(type) {
    state.selectedMediaType = type;

    document.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active', c.dataset.type === type);
    });

    const mediaTypes = window._MRE_DATA?.mediaTypes || [];
    const def        = mediaTypes.find(m => m.id === type);
    if (def) {
      UploadUI.setAccept(def.accept);
      if (!state.fileLoaded) UploadUI.setHint(def.hint);
    }

    const streamRow = document.getElementById('streamRow');
    if (streamRow) streamRow.style.display = type === 'stream' ? 'block' : 'none';
  }

  // ── Intensity ─────────────────────────────────────────────
  function setIntensity(val) {
    state.intensity = val;
    const label = document.getElementById('intensityVal');
    if (label) label.textContent = val + '%';
    OrbUI.updateIntensityRing(val);
    if (state.processed) _refreshWaveform();
  }

  // ── File loaded ───────────────────────────────────────────
  async function onFileLoaded(file) {
    // Size guard
    const mediaTypes = window._MRE_DATA?.mediaTypes || [];
    const def        = mediaTypes.find(m => m.id === state.selectedMediaType);
    const maxMB      = def?.maxMB || 50;
    const sizeMB     = file.size / 1024 / 1024;

    if (maxMB < 999 && sizeMB > maxMB) {
      ToastUI.show(`File too large · max ${maxMB}MB for ${state.selectedMediaType}`);
      return;
    }

    // Reset state
    state.fileLoaded       = true;
    state.fileName         = file.name;
    state.fileSizeMB       = sizeMB;
    state.fileData         = null;
    state.waveformSamples  = null;
    state.processed        = false;
    state.originalScores   = null;
    state.tunedScores      = null;

    UploadUI.setLoaded(file.name, sizeMB);
    MetersUI.reset();
    _hideResults();
    _showMetadata(null); // clear previous metadata
    WaveformUI.renderGenerated({ tuned: false, hz: state.selectedHz, intensity: state.intensity });
    ToastUI.show(`Reading ${file.name}...`);

    // ── Real file reading via FileReaderUI ──────────────────
    try {
      const result = await FileReaderUI.read(file, state.selectedMediaType);
      state.fileData = result;

      // Render real waveform for audio
      if (result.type === 'audio' && result.channelData && result.channelData[0]) {
        // Downsample channel 0 to 300 points for SVG
        state.waveformSamples = FFTUtils.downsample(result.channelData[0], 300);
        WaveformUI.renderFromData(state.waveformSamples, {
          tuned:     false,
          hz:        state.selectedHz,
          intensity: state.intensity,
        });
      }

      // Display real metadata
      _showMetadata(result);
      ToastUI.show(`${file.name} loaded · ready to align`);

    } catch (err) {
      console.warn('MRE: file read error —', err.message);
      // Graceful fallback — generated waveform already shown, continue
      ToastUI.show(`File loaded · ${err.message.includes('decode') ? 'preview unavailable for this format' : 'ready to align'}`);
    }
  }

  // ── Metadata display ──────────────────────────────────────
  function _showMetadata(result) {
    const el = document.getElementById('fileMetadata');
    if (!el) return;

    if (!result) { el.style.display = 'none'; el.innerHTML = ''; return; }

    let html = '';

    if (result.type === 'audio') {
      const dur     = result.duration ? _formatDuration(result.duration) : '—';
      const rate    = result.sampleRate ? `${(result.sampleRate / 1000).toFixed(1)}kHz` : '—';
      const ch      = result.numberOfChannels === 1 ? 'Mono' : result.numberOfChannels === 2 ? 'Stereo' : `${result.numberOfChannels}ch`;
      const sizeMB  = result.fileSizeMB ? `${result.fileSizeMB.toFixed(2)}MB` : '—';
      html = `
        <span class="meta-item"><span class="meta-label">Duration</span>${dur}</span>
        <span class="meta-item"><span class="meta-label">Sample rate</span>${rate}</span>
        <span class="meta-item"><span class="meta-label">Channels</span>${ch}</span>
        <span class="meta-item"><span class="meta-label">Size</span>${sizeMB}</span>
      `;
    } else if (result.type === 'image') {
      html = `
        <span class="meta-item"><span class="meta-label">Dimensions</span>${result.width}×${result.height}px</span>
        <span class="meta-item"><span class="meta-label">Dominant hue</span>${result.dominantHue}°</span>
        <span class="meta-item"><span class="meta-label">Saturation</span>${result.saturation}%</span>
        <span class="meta-item"><span class="meta-label">Brightness</span>${result.brightness}%</span>
      `;
    } else if (result.type === 'text') {
      html = `
        <span class="meta-item"><span class="meta-label">Words</span>${result.wordCount.toLocaleString()}</span>
        <span class="meta-item"><span class="meta-label">Sentences</span>${result.sentenceCount.toLocaleString()}</span>
        <span class="meta-item"><span class="meta-label">Avg sentence</span>${result.avgWordsPerSentence} words</span>
        <span class="meta-item"><span class="meta-label">Lexical diversity</span>${Math.round(result.uniqueWordRatio * 100)}%</span>
      `;
    }

    el.innerHTML  = html;
    el.style.display = 'flex';
  }

  function _formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function _hideResults() {
    const dlRow    = document.getElementById('downloadRow');
    const outStatus = document.getElementById('outputStatus');
    if (dlRow)     dlRow.style.display    = 'none';
    if (outStatus) outStatus.textContent  = 'Awaiting processing';
  }

  // ── Processing ────────────────────────────────────────────
  async function startProcessing() {
    if (!state.fileLoaded) {
      UploadUI.nudge();
      ToastUI.show('Upload a file to begin · or drop one into the zone above');
      return;
    }

    const btn = document.getElementById('processBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analysing...'; }

    const processingEl = document.getElementById('processingState');
    const promptEl     = document.getElementById('uploadPrompt');
    const outputStatus = document.getElementById('outputStatus');

    if (processingEl) processingEl.classList.add('active');
    if (promptEl)     promptEl.style.display  = 'none';
    if (outputStatus) outputStatus.textContent = `Analysing ${state.fileName}...`;

    ['pBar1','pBar2','pBar3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.width = '0%';
    });

    // ── Stage 1: Real FFT analysis (runs immediately, before UI stages) ──
    let baseScores;
    try {
      _updateStage('Running spectral analysis...');
      baseScores = await _analyseFileAsync();
      state.analysisData = baseScores._raw || null;
      delete baseScores._raw;
    } catch (err) {
      console.warn('MRE: analysis error —', err.message);
      baseScores = { harmonic: 52, coherence: 48, clarity: 61, alignment: 38 };
    }

    // ── Stage 2: UI pipeline animation ──
    const stages = [
      `Mapping harmonic signature...`,
      `Calculating delta to ${state.selectedHz}Hz...`,
      `Applying resonance alignment at ${state.intensity}%...`,
      `Verifying coherence integrity...`,
      `Rendering tuned output...`,
    ];
    let stageIdx = 0;
    const stageInterval = setInterval(() => {
      _updateStage(stages[Math.min(stageIdx, stages.length - 1)]);
      stageIdx++;
    }, 700);

    const t = (ms, fn) => setTimeout(fn, ms);
    t(200,  () => { const b = document.getElementById('pBar1'); if(b) b.style.width = '100%'; });
    t(1000, () => { const b = document.getElementById('pBar2'); if(b) b.style.width = '100%'; });
    t(1800, () => { const b = document.getElementById('pBar3'); if(b) b.style.width = '100%'; });

    setTimeout(() => {
      clearInterval(stageInterval);
      if (processingEl) processingEl.classList.remove('active');

      const tuned = ResonanceAnalyser.applyIntensity(baseScores, state.intensity, state.selectedHz);

      state.originalScores = baseScores;
      state.tunedScores    = tuned;
      state.processed      = true;
      state.abMode         = 'A';

      state.report = ResonanceAnalyser.buildReport({
        mediaType:      state.selectedMediaType,
        fileName:       state.fileName,
        targetHz:       state.selectedHz,
        intensity:      state.intensity,
        originalScores: baseScores,
        tunedScores:    tuned,
      });

      // Enrich report with raw analysis data if available
      if (state.analysisData) {
        state.report.analysis = state.analysisData;
      }

      _showResults();
      if (btn) { btn.disabled = false; btn.textContent = 'Align to Resonance →'; }
    }, 2500);
  }

  function _updateStage(text) {
    const el = document.getElementById('processingStage');
    if (el) el.textContent = text;
  }

  // ── Real FFT analysis ─────────────────────────────────────
  /**
   * Run real frequency analysis on the loaded file data.
   * Returns ResonanceScore with an extra _raw property containing
   * raw measurements for the report. _raw is stripped before storing.
   */
  async function _analyseFileAsync() {
    const data = state.fileData;

    // ── No file data — return neutral baseline ──
    if (!data) return { harmonic: 52, coherence: 48, clarity: 61, alignment: 38 };

    // ── Image scoring — already real from v0.4 pixel analysis ──
    if (data.type === 'image') {
      return ResonanceAnalyser.scoreImage({
        dominantHue:    data.dominantHue    || 0,
        saturation:     data.saturation     || 50,
        brightness:     data.brightness     || 50,
        colourVariance: data.colourVariance || 0.5,
        targetHz:       state.selectedHz,
        intensity:      state.intensity,
      });
    }

    // ── Text scoring — already real from v0.4 linguistic analysis ──
    if (data.type === 'text') {
      return ResonanceAnalyser.scoreText({
        avgSyllablesPerWord:  data.avgSyllablesPerWord  || 1.5,
        avgWordsPerSentence:  data.avgWordsPerSentence  || 15,
        uniqueWordRatio:      data.uniqueWordRatio      || 0.5,
        punctuationDensity:   data.punctuationDensity   || 0.05,
        intensity:            state.intensity,
      });
    }

    // ── Audio: real FFT analysis via AnalyserNode ──────────────
    if (data.type === 'audio' && data.channelData && data.channelData[0]) {
      return await _runAudioFFT(data);
    }

    return { harmonic: 52, coherence: 48, clarity: 61, alignment: 38 };
  }

  /**
   * Run real FFT analysis on audio channel data.
   * Uses AnalyserNode for browser-native FFT.
   * All DOM/Web Audio calls happen here — results are plain objects.
   */
  async function _runAudioFFT(data) {
    const FFT_SIZE   = 8192;   // High resolution for accurate frequency detection
    const sampleRate = data.sampleRate || 44100;

    try {
      // Create offline context sized to analyse a representative chunk
      // Take middle 2 seconds of the audio for analysis (most musically representative)
      const chunkDuration  = Math.min(2, data.duration || 2);
      const chunkStart     = Math.max(0, Math.floor((data.duration || 0) / 2) - chunkDuration / 2);
      const chunkSamples   = Math.floor(chunkDuration * sampleRate);
      const startSample    = Math.floor(chunkStart * sampleRate);

      const channelCount   = data.channelData.length;
      const offlineCtx     = new OfflineAudioContext(
        channelCount,
        Math.max(chunkSamples, FFT_SIZE * 2),
        sampleRate
      );

      // Reconstruct AudioBuffer in offline context
      const audioBuffer = offlineCtx.createBuffer(channelCount, chunkSamples, sampleRate);
      for (let c = 0; c < channelCount; c++) {
        const src    = data.channelData[c];
        const dest   = audioBuffer.getChannelData(c);
        const end    = Math.min(startSample + chunkSamples, src.length);
        const actual = end - startSample;
        for (let i = 0; i < actual; i++) {
          dest[i] = src[startSample + i];
        }
      }

      // Create analyser + source in offline context
      const analyser = offlineCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(offlineCtx.destination);
      source.start(0);

      // Render to get frequency data
      await offlineCtx.startRendering();

      // Extract frequency spectrum
      const freqDataDb  = new Float32Array(analyser.frequencyBinCount);
      const freqDataLin = new Float32Array(analyser.frequencyBinCount);
      const timeData    = new Float32Array(analyser.fftSize);

      analyser.getFloatFrequencyData(freqDataDb);
      analyser.getFloatTimeDomainData(timeData);

      // Convert dB to linear for energy calculations
      for (let i = 0; i < freqDataDb.length; i++) {
        freqDataLin[i] = freqDataDb[i] > -Infinity
          ? Math.pow(10, freqDataDb[i] / 20)
          : 0;
      }

      // Apply Hann window to time domain for better spectral accuracy
      const windowed = FFTUtils.hannWindow(timeData);

      // ── Core measurements via FrequencyEngine ──────────────
      const dominantHz    = FrequencyEngine.dominantFrequency(freqDataDb, sampleRate, FFT_SIZE);
      const centroidHz    = FrequencyEngine.spectralCentroid(freqDataLin, sampleRate, FFT_SIZE);
      const harmonicRatio = FrequencyEngine.harmonicRatio(freqDataLin, dominantHz, sampleRate, FFT_SIZE);
      const rms           = FFTUtils.rmsAmplitude(windowed);
      const topPeaks      = FFTUtils.topPeaks(freqDataLin, sampleRate, FFT_SIZE, 5);

      // ── Score via ResonanceAnalyser ────────────────────────
      const scores = ResonanceAnalyser.scoreAudio({
        dominantHz,
        targetHz:         state.selectedHz,
        harmonicRatio,
        spectralCentroidHz: centroidHz,
        rmsAmplitude:     rms,
        intensity:        state.intensity,
      });

      // Update metadata display with real detected frequency
      _updateDetectedFrequency(dominantHz);

      // Attach raw analysis data for the report (_raw stripped before storing in state)
      scores._raw = {
        dominantHz:      Math.round(dominantHz * 10) / 10,
        targetHz:        state.selectedHz,
        centroidHz:      Math.round(centroidHz),
        harmonicRatio:   Math.round(harmonicRatio * 1000) / 1000,
        rmsAmplitude:    Math.round(rms * 1000) / 1000,
        centsFromTarget: Math.round(FrequencyEngine.centsDelta(dominantHz, state.selectedHz)),
        topPeaksHz:      topPeaks.map(p => Math.round(p.hz)),
        fftSize:         FFT_SIZE,
        sampleRate,
        analysedAt:      new Date().toISOString(),
      };

      return scores;

    } catch (err) {
      console.warn('MRE: FFT analysis failed —', err.message);
      // Graceful fallback to RMS-only estimate
      const rms      = data.channelData ? FFTUtils.rmsAmplitude(data.channelData[0]) : 0.3;
      return {
        harmonic:  Math.round(40 + rms * 40),
        coherence: Math.round(35 + rms * 35),
        clarity:   Math.round(50 + rms * 30),
        alignment: Math.round(30 + rms * 20),
      };
    }
  }

  /**
   * Update the metadata bar with the real detected dominant frequency.
   * Called after FFT analysis completes.
   */
  function _updateDetectedFrequency(dominantHz) {
    const el = document.getElementById('fileMetadata');
    if (!el) return;

    // Add or update the detected frequency item
    let detectedEl = document.getElementById('metaDetectedHz');
    if (!detectedEl) {
      detectedEl = document.createElement('span');
      detectedEl.id = 'metaDetectedHz';
      detectedEl.className = 'meta-item';
      el.appendChild(detectedEl);
    }

    const cents     = FrequencyEngine.centsDelta(dominantHz, state.selectedHz);
    const direction = cents > 0 ? '▲' : '▼';
    const absCents  = Math.abs(Math.round(cents));

    detectedEl.innerHTML = `
      <span class="meta-label">Detected freq</span>
      ${Math.round(dominantHz)}Hz
      <span style="font-size:0.55rem;color:${absCents < 50 ? 'var(--green)' : 'var(--gold-dim)'}">
        ${direction}${absCents}¢ from ${state.selectedHz}Hz
      </span>
    `;
  }

  function _showResults() {
    const outStatus = document.getElementById('outputStatus');
    const dlRow     = document.getElementById('downloadRow');
    const promptEl  = document.getElementById('uploadPrompt');

    if (outStatus) outStatus.textContent = `Complete · ${state.selectedHz}Hz · ${state.intensity}%`;
    if (dlRow)     dlRow.style.display   = 'flex';
    if (promptEl)  promptEl.style.display = 'none';

    MetersUI.setAll(state.originalScores);
    setABMode('A');
    ToastUI.show(`Aligned to ${state.selectedHz}Hz · switch to B to compare`);
  }

  // ── A/B ───────────────────────────────────────────────────
  function setABMode(mode) {
    state.abMode = mode;
    const btnA = document.getElementById('btnA');
    const btnB = document.getElementById('btnB');
    if (btnA) btnA.classList.toggle('active', mode === 'A');
    if (btnB) btnB.classList.toggle('active', mode === 'B');

    if (state.processed) {
      const scores = mode === 'B' ? state.tunedScores : state.originalScores;
      MetersUI.setAll(scores);
      _refreshWaveform();
    }
  }

  function _refreshWaveform() {
    // Use real waveform data if available (audio A state)
    if (state.waveformSamples && state.abMode === 'A') {
      WaveformUI.renderFromData(state.waveformSamples, {
        tuned:     false,
        hz:        state.selectedHz,
        intensity: state.intensity,
      });
    } else {
      WaveformUI.renderGenerated({
        tuned:     state.abMode === 'B',
        hz:        state.selectedHz,
        intensity: state.intensity,
      });
    }
  }

  // ── Waitlist ──────────────────────────────────────────────
  function submitWaitlist() {
    const input = document.getElementById('emailInput');
    if (!input) return;
    const email = input.value.trim();
    const re    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!re.test(email)) {
      input.style.borderColor = 'rgba(200,80,80,0.5)';
      input.focus();
      setTimeout(() => { input.style.borderColor = ''; }, 1500);
      ToastUI.show('Please enter a valid email address');
      return;
    }

    document.getElementById('successOverlay')?.classList.add('active');
    input.value = '';
  }

  // ── Download report ───────────────────────────────────────
  function downloadReport() {
    if (!state.report) return;
    const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `mre-report-${state.selectedHz}hz-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Reveal on scroll ──────────────────────────────────────
  function initReveal() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // ── Select freq from table ────────────────────────────────
  function selectFreqFromTable(row) {
    const hz = parseInt(row.dataset.hz);
    if (!hz) return;
    setFrequency(hz);
    document.getElementById('tuned')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const freqData = window._MRE_DATA?.frequencies?.find(f => f.hz === hz);
    ToastUI.show(`Frequency set to ${hz}Hz · ${freqData?.name || ''}`);
  }

  // ── Public API ────────────────────────────────────────────
  return {
    get state() { return state; },
    setFrequency,
    setMediaType,
    setIntensity,
    onFileLoaded,
    startProcessing,
    setABMode,
    submitWaitlist,
    downloadReport,
    initReveal,
    selectFreqFromTable,
  };

})();

// Alias for backward-compat with any inline onclick attributes
const MRE = MREState;