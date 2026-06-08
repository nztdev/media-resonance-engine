# Module: Frame Resonance

**Status:** Coming Soon · In Development  
**Media types:** Video  
**Registry ID:** `frame-resonance`  
**Target version:** v0.7 (web) · m2.0 (native)

---

## What this module will do

Frame Resonance extends frequency alignment to the full video medium — not just the audio track. It analyses and aligns:

- **Audio track** — pitch shifting to target Hz (inherits from I'm Tuned!)
- **Colour grading** — dominant colour frequencies mapped to solfège spectrum
- **Narrative pacing** — cut rhythm and scene duration analysed for harmonic structure

## Planned processing pipeline

```
Video file
  → Audio track → I'm Tuned! audio pipeline
  → Frame sequence → Canvas colour extraction per frame
  → colour-frequency mapping (wavelengthToHz)
  → Colour grade adjustment to target palette
  → Scene timing analysis → rhythm scoring
  → Unified resonance report (audio + visual + pacing)
```

## Module folder structure (planned)

```
modules/frame-resonance/
  index.js            ← registration
  video-splitter.js   ← extract audio + frame sequence
  colour-grader.js    ← per-frame colour-frequency alignment
  pacing-analyser.js  ← cut rhythm + scene duration scoring
  README.md
```

## Notes for contributors

The key technical challenge is processing video frames efficiently in the browser. Options under evaluation:

- `requestAnimationFrame` + Canvas for frame-by-frame colour extraction
- WebCodecs API (Chrome 94+) for hardware-accelerated frame access
- Web Worker for off-main-thread processing

The colour-frequency mapping functions already exist in `core/frequency-engine.js` (`wavelengthToHz`, `hueToWavelength`) — this module wraps them for video frame sequences.
