/**
 * MEDIA RESONANCE ENGINE · state/mre-state.js
 * ─────────────────────────────────────────────
 * Single source of truth. Coordinates core ↔ UI.
 * Core functions are called here. UI is updated from here.
 * Neither core nor UI know about each other directly.
 *
 * v0.3 · https://github.com/[your-username]/media-resonance-engine
 */

const MREState = (() => {

  // ── Application state ─────────────────────────────────────
  const state = {
    selectedHz:       432,
    selectedMediaType:'audio',
    intensity:        72,
    fileLoaded:       false,
    fileName:         '',
    fileSizeMB:       0,
    fileData:         null,   // Float32Array or other raw data (v0.4+)
    processed:        false,
    abMode:           'A',    // 'A' | 'B'
    originalScores:   null,
    tunedScores:      null,
    report:           null,
  };

  // ── Frequency ─────────────────────────────────────────────
  function setFrequency(hz) {
    state.selectedHz = hz;

    // Update orb
    OrbUI.updateHz(hz);
    OrbUI.updateIntensityRing(state.intensity);

    // Sync freq grid buttons
    document.querySelectorAll('.freq-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.hz) === hz);
    });

    // Sync solfège table
    document.querySelectorAll('#freqTable tr').forEach(row => {
      const rowHz   = parseInt(row.dataset.hz);
      const isActive = rowHz === hz;
      row.classList.toggle('active-freq', isActive);
      const indicator = row.querySelectorAll('td')[2];
      if (indicator) indicator.textContent = isActive ? '🟡' : '';
    });

    // Update processing label
    const procHz = document.getElementById('processingHz');
    if (procHz) procHz.textContent = hz;

    // If already processed, refresh waveform
    if (state.processed) {
      _refreshWaveform();
    }
  }

  // ── Media type ────────────────────────────────────────────
  function setMediaType(type) {
    state.selectedMediaType = type;

    // Sync chips
    document.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active', c.dataset.type === type);
    });

    // Update accept + hint via UploadUI
    const mediaTypes = window._MRE_DATA?.mediaTypes || [];
    const def        = mediaTypes.find(m => m.id === type);
    if (def) {
      UploadUI.setAccept(def.accept);
      if (!state.fileLoaded) UploadUI.setHint(def.hint);
    }

    // Stream type: show/hide URL row
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
  function onFileLoaded(file) {
    // Size guard
    const mediaTypes = window._MRE_DATA?.mediaTypes || [];
    const def        = mediaTypes.find(m => m.id === state.selectedMediaType);
    const maxMB      = def?.maxMB || 50;
    const sizeMB     = file.size / 1024 / 1024;

    if (maxMB < 999 && sizeMB > maxMB) {
      ToastUI.show(`File too large · max ${maxMB}MB for ${state.selectedMediaType}`);
      return;
    }

    state.fileLoaded  = true;
    state.fileName    = file.name;
    state.fileSizeMB  = sizeMB;
    state.processed   = false;
    state.originalScores = null;
    state.tunedScores    = null;

    UploadUI.setLoaded(file.name, sizeMB);
    WaveformUI.renderGenerated({ tuned: false, hz: state.selectedHz, intensity: state.intensity });
    MetersUI.reset();

    // Hide download row, reset output status
    const dlRow = document.getElementById('downloadRow');
    if (dlRow) dlRow.style.display = 'none';
    const outStatus = document.getElementById('outputStatus');
    if (outStatus) outStatus.textContent = 'Awaiting processing';

    // In v0.4+ we also read the file here via FileReader
    // For now the UI is ready for the simulated engine
  }

  // ── Processing ────────────────────────────────────────────
  function startProcessing() {
    if (!state.fileLoaded) {
      UploadUI.nudge();
      ToastUI.show('Upload a file to begin · or drop one into the zone above');
      return;
    }

    const btn = document.getElementById('processBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Aligning...'; }

    // Show processing state
    const processingEl = document.getElementById('processingState');
    const promptEl     = document.getElementById('uploadPrompt');
    const outputStatus = document.getElementById('outputStatus');

    if (processingEl) processingEl.classList.add('active');
    if (promptEl)     promptEl.style.display = 'none';
    if (outputStatus) outputStatus.textContent = `Aligning to ${state.selectedHz}Hz · ${state.intensity}%...`;

    // Reset progress bars
    ['pBar1','pBar2','pBar3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.width = '0%';
    });

    // Staged progress simulation
    const stages = [
      `Analysing ${state.selectedMediaType} spectral content...`,
      `Mapping harmonic signature...`,
      `Calculating delta to ${state.selectedHz}Hz...`,
      `Applying resonance alignment at ${state.intensity}%...`,
      `Verifying coherence integrity...`,
      `Rendering tuned output...`,
    ];
    let stageIdx = 0;
    const stageInterval = setInterval(() => {
      const stageEl = document.getElementById('processingStage');
      if (stageEl) stageEl.textContent = stages[Math.min(stageIdx, stages.length - 1)];
      stageIdx++;
    }, 700);

    const t = (ms, fn) => setTimeout(fn, ms);
    t(400,  () => { const b = document.getElementById('pBar1'); if(b) b.style.width = '100%'; });
    t(1500, () => { const b = document.getElementById('pBar2'); if(b) b.style.width = '100%'; });
    t(2700, () => { const b = document.getElementById('pBar3'); if(b) b.style.width = '100%'; });

    setTimeout(() => {
      clearInterval(stageInterval);
      if (processingEl) processingEl.classList.remove('active');

      // Compute scores via ResonanceAnalyser
      const fakeOriginal = { harmonic: 52, coherence: 48, clarity: 61, alignment: 38 };
      const tuned        = ResonanceAnalyser.applyIntensity(fakeOriginal, state.intensity, state.selectedHz);

      state.originalScores = fakeOriginal;
      state.tunedScores    = tuned;
      state.processed      = true;
      state.abMode         = 'A';

      // Build report
      state.report = ResonanceAnalyser.buildReport({
        mediaType:      state.selectedMediaType,
        fileName:       state.fileName,
        targetHz:       state.selectedHz,
        intensity:      state.intensity,
        originalScores: fakeOriginal,
        tunedScores:    tuned,
      });

      _showResults();
      if (btn) { btn.disabled = false; btn.textContent = 'Align to Resonance →'; }
    }, 4000);
  }

  function _showResults() {
    const outStatus = document.getElementById('outputStatus');
    const dlRow     = document.getElementById('downloadRow');
    const promptEl  = document.getElementById('uploadPrompt');

    if (outStatus) outStatus.textContent = `Complete · ${state.selectedHz}Hz · ${state.intensity}%`;
    if (dlRow)     dlRow.style.display   = 'flex';
    if (promptEl)  promptEl.style.display = 'none';

    // Show original scores first (A state)
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
    WaveformUI.renderGenerated({
      tuned:     state.abMode === 'B',
      hz:        state.selectedHz,
      intensity: state.intensity,
    });
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
