# Module: I'm Tuned!

**Status:** Live · v0.3  
**Media types:** Audio · Video · Image · Text · PDF  
**Registry ID:** `im-tuned`

---

## What this module does

I'm Tuned! is the flagship module of the Media Resonance Engine. It accepts any media file, analyses its frequency signature, and produces a harmonically realigned version tuned to a target solfège frequency.

## Module structure (target — builds through v0.7)

```
modules/im-tuned/
  index.js          ← module registration + public API
  processor.js      ← processing pipeline coordinator
  audio-handler.js  ← audio-specific processing (Web Audio API wrapper)
  image-handler.js  ← image colour-frequency processing (Canvas wrapper)
  text-handler.js   ← text cadence analysis
  README.md
```

## Registration

This module self-registers with `ModuleRegistry` on load:

```javascript
ModuleRegistry.register({
  id:         'im-tuned',
  name:       "I'm Tuned!",
  status:     ModuleRegistry.STATUS.LIVE,
  mediaTypes: ['audio', 'video', 'image', 'text', 'pdf'],
  process:    async (input, options) => { /* v0.6+ */ },
  analyse:    async (input, options) => { /* v0.5+ */ },
});
```

## Processing pipeline

```
File input
  → FileReader (ui layer)
  → AudioContext / Canvas / TextDecoder (ui layer)
  → Raw data (Float32Array / ImageData / string)
  → frequency-engine.js (core — analysis)
  → resonance-analyser.js (core — scoring)
  → frequency-engine.js (core — transformation)
  → Output blob (ui layer — WAV / PNG / TXT)
  → resonance-analyser.js (core — report)
```

## Version history

- **v0.3** — Module registered. Processing stubs in place. Architecture ready.
- **v0.5** — Real resonance scoring on uploaded file data.
- **v0.6** — Real audio pitch shifting via Web Audio API + phase vocoder.
- **v0.7** — Image colour-frequency mapping + text cadence analysis.
