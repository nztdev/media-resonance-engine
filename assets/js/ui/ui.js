/**
 * MEDIA RESONANCE ENGINE · ui/meters.js
 * Resonance meter bar animations — DOM only.
 * v0.3
 */
const MetersUI = (() => {

  const METER_MAP = {
    harmonic:  { bar: 'mHarmonic',  val: 'vHarmonic'  },
    coherence: { bar: 'mCoherence', val: 'vCoherence' },
    clarity:   { bar: 'mClarity',   val: 'vClarity'   },
    alignment: { bar: 'mAlignment', val: 'vAlignment' },
  };

  /**
   * Set a single meter to a value.
   * @param {string} metric  — 'harmonic' | 'coherence' | 'clarity' | 'alignment'
   * @param {number} value   — 0 to 100
   */
  function set(metric, value) {
    const ids = METER_MAP[metric];
    if (!ids) return;
    const bar = document.getElementById(ids.bar);
    const val = document.getElementById(ids.val);
    if (bar) bar.style.width   = value + '%';
    if (val) val.textContent   = value + '%';
  }

  /**
   * Set all meters from a ResonanceScore object.
   * @param {object} scores — { harmonic, coherence, clarity, alignment }
   */
  function setAll(scores) {
    Object.keys(METER_MAP).forEach(metric => {
      if (scores[metric] !== undefined) set(metric, scores[metric]);
    });
  }

  /**
   * Reset all meters to zero.
   */
  function reset() {
    Object.keys(METER_MAP).forEach(metric => set(metric, 0));
    Object.values(METER_MAP).forEach(({ val }) => {
      const el = document.getElementById(val);
      if (el) el.textContent = '—';
    });
  }

  return { set, setAll, reset };
})();


/**
 * MEDIA RESONANCE ENGINE · ui/nav.js
 * Scroll-spy and nav active state — DOM only.
 * v0.3
 */
const NavUI = (() => {

  const SECTION_IDS = ['tuned', 'science', 'ecosystem', 'waitlist'];
  let   _observer   = null;

  /**
   * Initialise scroll-spy on nav links.
   * Expects <a href="#sectionId"> in .nav-links.
   */
  function init() {
    const links = {};
    SECTION_IDS.forEach(id => {
      const link = document.querySelector(`.nav-links a[href="#${id}"]`);
      if (link) links[id] = link;
    });

    _observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          Object.values(links).forEach(l => l.classList.remove('active'));
          const link = links[entry.target.id];
          if (link) link.classList.add('active');
        }
      });
    }, { threshold: 0.35 });

    SECTION_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) _observer.observe(el);
    });
  }

  function destroy() {
    if (_observer) { _observer.disconnect(); _observer = null; }
  }

  return { init, destroy };
})();


/**
 * MEDIA RESONANCE ENGINE · ui/toast.js
 * Notification toast system — DOM only.
 * v0.3
 */
const ToastUI = (() => {

  let _el = null;
  let _timeout = null;

  function _getEl() {
    if (_el) return _el;
    _el = document.createElement('div');
    _el.id = 'mreToast';
    _el.style.cssText = [
      'position:fixed', 'bottom:2rem', 'left:50%', 'transform:translateX(-50%)',
      'background:var(--ink-mid)', 'border:0.5px solid var(--border-strong)',
      'color:var(--parchment)', 'font-family:var(--font-mono)', 'font-size:0.68rem',
      'letter-spacing:0.1em', 'padding:0.75rem 1.5rem', 'border-radius:var(--radius)',
      'z-index:var(--z-toast)', 'opacity:0', 'transition:opacity 0.3s',
      'pointer-events:none', 'white-space:nowrap', 'max-width:90vw',
      'text-align:center',
    ].join(';');
    document.body.appendChild(_el);
    return _el;
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {number} duration — ms, default 2800
   */
  function show(message, duration = 2800) {
    const el     = _getEl();
    el.textContent = message;
    el.style.opacity = '1';
    clearTimeout(_timeout);
    _timeout = setTimeout(() => { el.style.opacity = '0'; }, duration);
  }

  return { show };
})();


/**
 * MEDIA RESONANCE ENGINE · ui/upload.js
 * File upload zone — drag-drop, validation, state machine.
 * DOM layer only. Delegates file reading to main.js via callbacks.
 * v0.3
 */
const UploadUI = (() => {

  let _onFile     = null; // callback: (File) => void
  let _zoneEl     = null;
  let _inputEl    = null;

  /**
   * Initialise the upload zone.
   * @param {object}   options
   * @param {string}   options.zoneId   — upload zone element id
   * @param {string}   options.inputId  — hidden file input id
   * @param {Function} options.onFile   — called with (File) when user selects/drops
   */
  function init({ zoneId = 'uploadZone', inputId = 'fileInput', onFile }) {
    _zoneEl  = document.getElementById(zoneId);
    _inputEl = document.getElementById(inputId);
    _onFile  = onFile;

    if (!_zoneEl || !_inputEl) return;

    // Click to browse
    _zoneEl.addEventListener('click', () => {
      if (_inputEl.accept !== '') _inputEl.click();
    });

    // File input change
    _inputEl.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) _handleFile(e.target.files[0]);
    });

    // Drag over
    _zoneEl.addEventListener('dragover', e => {
      e.preventDefault();
      _zoneEl.classList.add('active');
    });

    // Drag leave
    _zoneEl.addEventListener('dragleave', e => {
      if (!_zoneEl.contains(e.relatedTarget)) _zoneEl.classList.remove('active');
    });

    // Drop
    _zoneEl.addEventListener('drop', e => {
      e.preventDefault();
      _zoneEl.classList.remove('active');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        _handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  function _handleFile(file) {
    if (_onFile) _onFile(file);
  }

  /**
   * Update the upload zone to show a loaded file.
   * @param {string} name
   * @param {number} sizeMB
   */
  function setLoaded(name, sizeMB) {
    if (!_zoneEl) return;
    _zoneEl.classList.add('active');
    const hint = _zoneEl.querySelector('#uploadHint');
    const stat = document.getElementById('fileStatus');
    if (hint) hint.textContent = `${name} · ${sizeMB.toFixed(2)} MB · ready`;
    if (stat) stat.textContent = name;
  }

  /**
   * Nudge the upload zone to draw attention (no file loaded).
   */
  function nudge() {
    if (!_zoneEl) return;
    _zoneEl.classList.add('nudge');
    setTimeout(() => _zoneEl.classList.remove('nudge'), 500);
  }

  /**
   * Update accepted file types.
   * @param {string} accept — value for <input accept>
   */
  function setAccept(accept) {
    if (_inputEl) _inputEl.accept = accept;
  }

  /**
   * Update the hint text.
   * @param {string} hint
   */
  function setHint(hint) {
    const el = document.getElementById('uploadHint');
    if (el) el.textContent = hint;
  }

  return { init, setLoaded, nudge, setAccept, setHint };
})();
