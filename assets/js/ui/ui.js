/**
 * MEDIA RESONANCE ENGINE · ui/ui.js
 * MetersUI · NavUI · ToastUI · UploadUI · FileReaderUI
 * DOM layer — v0.4
 */

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


/**
 * MEDIA RESONANCE ENGINE · ui/file-reader.js (embedded in ui.js)
 * ──────────────────────────────────────────────────────────────
 * Reads files using browser APIs (FileReader, AudioContext, Canvas).
 * Returns plain data objects — no DOM references in the result.
 * DOM layer only. Called by mre-state.js via onFileLoaded().
 *
 * v0.4
 */
const FileReaderUI = (() => {

  // ── Audio reading ─────────────────────────────────────────
  /**
   * Read an audio file and return decoded audio data.
   * Uses Web Audio API — browser only.
   *
   * @param {File} file
   * @returns {Promise<AudioReadResult>}
   *   { channelData: Float32Array[], sampleRate, duration,
   *     numberOfChannels, fileName, fileSizeMB }
   */
  async function readAudio(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          // AudioContext must be created in UI layer — not portable to RN
          const ctx         = new (window.AudioContext || window.webkitAudioContext)();
          const arrayBuffer = e.target.result;
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          // Extract channel data as plain arrays (portable)
          const channelData = [];
          for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            // Copy — don't hold reference to AudioBuffer after context closes
            channelData.push(new Float32Array(audioBuffer.getChannelData(i)));
          }

          await ctx.close();

          resolve({
            type:             'audio',
            channelData,
            sampleRate:       audioBuffer.sampleRate,
            duration:         audioBuffer.duration,
            numberOfChannels: audioBuffer.numberOfChannels,
            fileName:         file.name,
            fileSizeMB:       file.size / 1024 / 1024,
          });
        } catch (err) {
          reject(new Error(`Audio decode failed: ${err.message}`));
        }
      };

      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Image reading ─────────────────────────────────────────
  /**
   * Read an image file and return pixel data via Canvas.
   * @param {File} file
   * @returns {Promise<ImageReadResult>}
   *   { imageData: ImageData, width, height, dominantHue,
   *     saturation, brightness, colourVariance, fileName, fileSizeMB }
   */
  async function readImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          // Downsample to max 200x200 for fast pixel analysis
          const maxDim = 200;
          const scale  = Math.min(maxDim / img.width, maxDim / img.height, 1);
          const w      = Math.round(img.width  * scale);
          const h      = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const imageData = ctx.getImageData(0, 0, w, h);
          const analysis  = _analysePixels(imageData);

          URL.revokeObjectURL(url);

          resolve({
            type:          'image',
            imageData,
            width:         img.width,
            height:        img.height,
            fileName:      file.name,
            fileSizeMB:    file.size / 1024 / 1024,
            ...analysis,
          });
        } catch (err) {
          reject(new Error(`Image read failed: ${err.message}`));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };

      img.src = url;
    });
  }

  /**
   * Analyse pixel data to extract colour frequency metrics.
   * Pure computation on raw pixel values.
   * @param {ImageData} imageData
   * @returns {{ dominantHue, saturation, brightness, colourVariance }}
   */
  function _analysePixels(imageData) {
    const data       = imageData.data;
    const pixelCount = data.length / 4;
    let   rSum = 0, gSum = 0, bSum = 0;
    const hues = [];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      rSum += r; gSum += g; bSum += b;

      // RGB → HSL hue
      const max  = Math.max(r, g, b);
      const min  = Math.min(r, g, b);
      const delta = max - min;
      if (delta > 0.05) { // ignore near-grey pixels
        let h = 0;
        if      (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else                h = (r - g) / delta + 4;
        hues.push((h * 60 + 360) % 360);
      }
    }

    const avgR = rSum / pixelCount;
    const avgG = gSum / pixelCount;
    const avgB = bSum / pixelCount;

    // Average brightness (0–100)
    const brightness = Math.round(((avgR + avgG + avgB) / 3) * 100);

    // Average saturation proxy
    const maxAvg = Math.max(avgR, avgG, avgB);
    const minAvg = Math.min(avgR, avgG, avgB);
    const saturation = maxAvg > 0
      ? Math.round(((maxAvg - minAvg) / maxAvg) * 100)
      : 0;

    // Dominant hue (circular mean)
    let sinSum = 0, cosSum = 0;
    hues.forEach(h => {
      sinSum += Math.sin(h * Math.PI / 180);
      cosSum += Math.cos(h * Math.PI / 180);
    });
    const dominantHue = hues.length > 0
      ? Math.round((Math.atan2(sinSum / hues.length, cosSum / hues.length) * 180 / Math.PI + 360) % 360)
      : 0;

    // Colour variance (standard deviation of hues, normalised 0–1)
    const hueMean = dominantHue;
    const variance = hues.length > 0
      ? Math.sqrt(hues.reduce((s, h) => s + Math.pow(h - hueMean, 2), 0) / hues.length) / 180
      : 0;

    return {
      dominantHue,
      saturation,
      brightness,
      colourVariance: Math.min(variance, 1),
    };
  }

  // ── Text reading ──────────────────────────────────────────
  /**
   * Read a text file and return linguistic metrics.
   * @param {File} file
   * @returns {Promise<TextReadResult>}
   */
  async function readText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text     = e.target.result;
          const analysis = _analyseText(text);

          resolve({
            type:       'text',
            text,
            fileName:   file.name,
            fileSizeMB: file.size / 1024 / 1024,
            ...analysis,
          });
        } catch (err) {
          reject(new Error(`Text read failed: ${err.message}`));
        }
      };

      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsText(file);
    });
  }

  /**
   * Analyse text to extract resonance metrics.
   * @param {string} text
   * @returns {{ wordCount, sentenceCount, avgWordsPerSentence,
   *             avgSyllablesPerWord, uniqueWordRatio, punctuationDensity }}
   */
  function _analyseText(text) {
    const words      = text.match(/\b\w+\b/g) || [];
    const sentences  = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const wordCount  = words.length;
    const sentenceCount = sentences.length;

    const avgWordsPerSentence = sentenceCount > 0
      ? wordCount / sentenceCount
      : 0;

    // Simple syllable estimate: vowel groups per word
    const totalSyllables = words.reduce((sum, w) => {
      const syllables = (w.toLowerCase().match(/[aeiou]+/g) || []).length;
      return sum + Math.max(syllables, 1);
    }, 0);
    const avgSyllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 0;

    // Unique word ratio (lexical diversity)
    const uniqueWords    = new Set(words.map(w => w.toLowerCase()));
    const uniqueWordRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0;

    // Punctuation density
    const punctCount      = (text.match(/[.,;:!?'"()\-–—]/g) || []).length;
    const punctuationDensity = text.length > 0 ? punctCount / text.length : 0;

    return {
      wordCount,
      sentenceCount,
      avgWordsPerSentence:  Math.round(avgWordsPerSentence  * 10) / 10,
      avgSyllablesPerWord:  Math.round(avgSyllablesPerWord  * 10) / 10,
      uniqueWordRatio:      Math.round(uniqueWordRatio       * 100) / 100,
      punctuationDensity:   Math.round(punctuationDensity   * 1000) / 1000,
    };
  }

  // ── Router ────────────────────────────────────────────────
  /**
   * Read any file based on its declared media type.
   * @param {File}   file
   * @param {string} mediaType — 'audio' | 'video' | 'image' | 'text' | 'pdf'
   * @returns {Promise<ReadResult>}
   */
  async function read(file, mediaType) {
    switch (mediaType) {
      case 'audio':
      case 'video':  // extract audio track
        return readAudio(file);
      case 'image':
        return readImage(file);
      case 'text':
      case 'pdf':    // PDF text extraction v0.7 — reads as text for now
        return readText(file);
      default:
        return readAudio(file); // best-effort fallback
    }
  }

  return { read, readAudio, readImage, readText };

})();


/**
 * MEDIA RESONANCE ENGINE · ui/audio-encoder.js (embedded in ui.js)
 * ──────────────────────────────────────────────────────────────────
 * Encodes Float32Array channel data to WAV blob and triggers download.
 * DOM layer only — no pure logic, just browser API calls.
 * v0.6
 */
const AudioEncoderUI = (() => {

  /**
   * Encode channel data arrays to a WAV Blob.
   * Produces standard 16-bit PCM WAV — plays in every audio application.
   *
   * @param {Float32Array[]} channelData  — array of per-channel samples
   * @param {number}         sampleRate
   * @returns {Blob} WAV blob
   */
  function encodeWAV(channelData, sampleRate) {
    const numChannels  = channelData.length;
    const numSamples   = channelData[0].length;
    const bitDepth     = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign   = numChannels * bytesPerSample;
    const byteRate     = sampleRate * blockAlign;
    const dataSize     = numSamples * blockAlign;
    const bufferSize   = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view   = new DataView(buffer);

    // ── WAV header ──
    _writeString(view, 0,  'RIFF');
    view.setUint32( 4,  bufferSize - 8,  true);
    _writeString(view, 8,  'WAVE');
    _writeString(view, 12, 'fmt ');
    view.setUint32( 16, 16,              true);  // PCM chunk size
    view.setUint16( 20, 1,               true);  // PCM format
    view.setUint16( 22, numChannels,     true);
    view.setUint32( 24, sampleRate,      true);
    view.setUint32( 28, byteRate,        true);
    view.setUint16( 32, blockAlign,      true);
    view.setUint16( 34, bitDepth,        true);
    _writeString(view, 36, 'data');
    view.setUint32( 40, dataSize,        true);

    // ── Interleave channels and write PCM samples ──
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        // Clamp and convert float32 → int16
        const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
        const int16  = sample < 0
          ? Math.round(sample * 32768)
          : Math.round(sample * 32767);
        view.setInt16(offset, int16, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function _writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * Trigger a WAV file download in the browser.
   * @param {Float32Array[]} channelData
   * @param {number}         sampleRate
   * @param {string}         filename
   */
  function downloadWAV(channelData, sampleRate, filename) {
    const blob = encodeWAV(channelData, sampleRate);
    _triggerDownload(blob, filename);
  }

  /**
   * Trigger download of any blob.
   * @param {Blob}   blob
   * @param {string} filename
   */
  function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Play a preview of channel data in the browser.
   * Creates a temporary AudioContext for playback.
   * @param {Float32Array[]} channelData
   * @param {number}         sampleRate
   * @param {Function}       [onEnded]   — callback when playback finishes
   * @returns {AudioContext} — caller can call .close() to stop early
   */
  function preview(channelData, sampleRate, onEnded) {
    const ctx         = new (window.AudioContext || window.webkitAudioContext)();
    const numChannels = channelData.length;
    const numSamples  = channelData[0].length;

    const audioBuffer = ctx.createBuffer(numChannels, numSamples, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      audioBuffer.getChannelData(ch).set(channelData[ch]);
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      ctx.close();
      if (onEnded) onEnded();
    };
    source.start(0);

    return ctx; // return so caller can stop early
  }

  return { encodeWAV, downloadWAV, preview };

})();