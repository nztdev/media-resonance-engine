/**
 * MEDIA RESONANCE ENGINE · main.js
 * ─────────────────────────────────
 * Entry point. Loads data, binds events, initialises all systems.
 * Runs after all other scripts are loaded.
 *
 * v0.3 · https://github.com/nztdev/media-resonance-engine
 */

(async function init() {

  // ── 1. Load JSON data ─────────────────────────────────────
  // Fetch both data files in parallel
  try {
    const [freqRes, mediaRes] = await Promise.all([
      fetch('./assets/data/frequencies.json'),
      fetch('./assets/data/media-types.json'),
    ]);
    const freqData  = await freqRes.json();
    const mediaData = await mediaRes.json();

    // Attach to window so MREState can access without circular deps
    window._MRE_DATA = {
      frequencies: freqData.frequencies,
      mediaTypes:  mediaData.mediaTypes,
    };
  } catch (e) {
    // Fallback: data files not available (e.g. opening HTML directly from disk)
    console.warn('MRE: data files not loaded — using inline fallbacks', e);
    window._MRE_DATA = {
      frequencies: [
        { hz: 396, name: 'Liberation', inGrid: false },
        { hz: 432, name: "Verdi's A",  inGrid: true, isDefault: true },
        { hz: 528, name: 'Love / DNA', inGrid: true },
        { hz: 639, name: 'Connection', inGrid: true },
        { hz: 741, name: 'Awakening',  inGrid: true },
        { hz: 963, name: 'Unity',      inGrid: true },
        { hz: 417, name: 'Change',     inGrid: false },
        { hz: 852, name: 'Spiritual',  inGrid: false },
      ],
      mediaTypes: [
        { id: 'audio', accept: 'audio/*',         maxMB: 50,  hint: 'MP3, WAV, FLAC · up to 50MB' },
        { id: 'video', accept: 'video/*',         maxMB: 200, hint: 'MP4, MOV, AVI · up to 200MB' },
        { id: 'image', accept: 'image/*',         maxMB: 25,  hint: 'JPG, PNG, WEBP · up to 25MB' },
        { id: 'pdf',   accept: 'application/pdf', maxMB: 25,  hint: 'PDF · up to 25MB'            },
        { id: 'text',  accept: 'text/*,.txt,.md', maxMB: 999, hint: 'TXT, MD, DOC · any size'     },
        { id: 'stream',accept: '',                maxMB: 0,   hint: 'Paste a stream URL'           },
      ],
    };
  }

  // ── 2. Initialise UI systems ──────────────────────────────
  NavUI.init();
  MREState.initReveal();

  UploadUI.init({
    zoneId:  'uploadZone',
    inputId: 'fileInput',
    onFile:  file => MREState.onFileLoaded(file),
  });

  // ── 3. Frequency grid buttons ─────────────────────────────
  document.querySelectorAll('.freq-btn').forEach(btn => {
    btn.addEventListener('click', () => MREState.setFrequency(parseInt(btn.dataset.hz)));
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        MREState.setFrequency(parseInt(btn.dataset.hz));
      }
      // Arrow key navigation
      const btns = [...document.querySelectorAll('.freq-btn')];
      const idx  = btns.indexOf(btn);
      const map  = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
      const delta = map[e.key];
      if (delta !== undefined && btns[idx + delta]) {
        e.preventDefault();
        btns[idx + delta].focus();
      }
    });
  });

  // ── 4. Media type chips ───────────────────────────────────
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      MREState.setMediaType(chip.dataset.type);
    });
  });

  // ── 5. Intensity slider ───────────────────────────────────
  const slider = document.getElementById('intensitySlider');
  if (slider) {
    slider.addEventListener('input', () => MREState.setIntensity(parseInt(slider.value)));
  }

  // ── 6. Download report button ─────────────────────────────
  const dlReport = document.querySelector('.dl-btn.gold');
  if (dlReport) {
    dlReport.addEventListener('click', () => MREState.downloadReport());
  }

  // ── 7. Waitlist form ──────────────────────────────────────
  const waitlistBtn = document.querySelector('.email-submit');
  if (waitlistBtn) {
    waitlistBtn.addEventListener('click', () => MREState.submitWaitlist());
  }
  const emailInput = document.getElementById('emailInput');
  if (emailInput) {
    emailInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') MREState.submitWaitlist();
    });
  }

  // ── 8. Success overlay close ──────────────────────────────
  const overlay = document.getElementById('successOverlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  }

  // ── 9. Ecosystem flagship card ────────────────────────────
  const flagship = document.querySelector('.eco-card.flagship');
  if (flagship) {
    flagship.addEventListener('click', () => {
      document.getElementById('tuned')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ── 10. Initialise state defaults ────────────────────────
  MREState.setFrequency(432);
  MREState.setMediaType('audio');
  MREState.setIntensity(72);
  WaveformUI.renderEmpty();

  // ── Console signature ─────────────────────────────────────
  console.log(
    '%c Media Resonance Engine · v0.5 ',
    'background:#C9A96E;color:#0A0906;font-family:monospace;font-size:11px;padding:4px 8px;border-radius:2px;'
  );
  console.log(
    '%c Real FFT analysis · OfflineAudioContext · dominantHz · harmonicRatio · spectralCentroid ',
    'color:#C9A96E;font-family:monospace;font-size:10px;'
  );
  console.log(
    '%c github.com/[your-username]/media-resonance-engine ',
    'color:#8A6D3F;font-family:monospace;font-size:10px;'
  );

})();
