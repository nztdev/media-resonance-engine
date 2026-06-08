# Media Resonance Engine

**Frequency alignment for every medium.**

A free, open-source tool for tuning audio, video, image, and text to natural resonance frequencies. Hosted permanently on GitHub Pages. No server. No cost. No paywalls.

→ **[Live site](https://nztdev.github.io/media-resonance-engine)**

---

## What it does

The Media Resonance Engine analyses any media file and realigns its frequency signature to a target solfège frequency — 432Hz by default. The result is a harmonically coherent version of your original content with a full A/B resonance report.

**Supported media types:** Audio · Video · Image · Text · PDF

**Available frequencies:** 396 · 417 · 432 · 528 · 639 · 741 · 852 · 963 Hz

---

## Current version: v0.3

| Version | Status | Description |
|---------|--------|-------------|
| v0.1 | ✅ Complete | Foundation, design system, GitHub Pages deploy |
| v0.2 | ✅ Complete | MRE state manager, freq/orb/table sync, upload guard |
| v0.3 | ✅ Complete | Architecture refactor — multi-file, core/ui/state separation |
| v0.4 | 🔄 Next | Real file reading via FileReader + Web Audio API |
| v0.5 | ⬜ Planned | A/B system on real data, resonance scoring |
| v0.6 | ⬜ Planned | Real audio pitch shifting, WAV export |
| v1.0 | ⬜ Planned | Public launch, custom domain |

---

## File structure

```
media-resonance-engine/
  index.html                    ← clean shell · imports only
  _config.yml                   ← GitHub Pages config
  CNAME                         ← custom domain (v1.0)

  assets/
    css/
      tokens.css                ← design tokens · typography · variables
      layout.css                ← nav · hero · sections · footer
      components.css            ← buttons · cards · panels · meters
      animations.css            ← keyframes · reveals · motion

    js/
      core/                     ← ZERO DOM · pure functions · React Native portable
        frequency-engine.js     ← pitch ratios · Hz calc · FFT · resampling
        resonance-analyser.js   ← scoring algorithms · A/B delta · reports
        fft-utils.js            ← FFT helpers · downsampling · windowing
        module-registry.js      ← ecosystem plugin system

      ui/                       ← DOM only · no business logic
        ui.js                   ← MetersUI · NavUI · ToastUI · UploadUI
        orb.js                  ← frequency orb renderer
        waveform.js             ← SVG waveform renderer

      state/
        mre-state.js            ← MREState coordinator · core↔ui bridge

      main.js                   ← entry point · data loading · event bindings

    data/
      frequencies.json          ← frequency definitions · shared with native
      media-types.json          ← media type config · shared with native

  modules/
    im-tuned/                   ← flagship module (live)
    frame-resonance/            ← coming v0.7
    script-alignment/           ← coming v0.7
```

---

## Architecture rule

**Files in `assets/js/core/` must have zero DOM dependencies.**

No `document`, `window`, `getElementById`, or any browser API. Pure JavaScript functions that accept data and return data. This is what makes the core directly portable to the React Native mobile apps without rewriting.

```
core/   →  pure functions only
ui/     →  DOM rendering only, calls core via state
state/  →  MREState coordinator, owns application state
main.js →  entry point, wires everything together
```

---

## Running locally

No build step required. Open `index.html` directly in a browser, or serve with any static file server:

```bash
# Python
python -m http.server 8000

# Node
npx serve .

# VS Code
# Install Live Server extension → right-click index.html → Open with Live Server
```

> **Note:** The JSON data files (`assets/data/`) require a server to load via `fetch()`. Opening `index.html` directly from disk will use inline fallback data automatically — everything still works.

---

## Deploying to GitHub Pages

1. Push this repo to GitHub
2. Settings → Pages → Source: `Deploy from branch` → Branch: `main` → Folder: `/ (root)`
3. Live at `https://nztdev.github.io/media-resonance-engine` within 60 seconds
4. Tag each version: `git tag v0.3 && git push origin v0.3`

---

## Roadmap

The web POC builds to v1.0, then the ecosystem expands into native iOS and Android apps via React Native. The `core/` folder ports directly — zero rewriting of business logic.

See the full interactive roadmap: [mre-roadmap.html](./mre-roadmap.html)

---

## Mission

The Media Resonance Engine is built with a purpose beyond the product: to measure, with user consent, whether resonance-aligned media genuinely improves human wellbeing. The mobile app permission model is designed from day one to enable this research. Every user who opts in contributes to the largest harmonic wellbeing study ever conducted.

Free forever. Open source. Built in public.

---

## Contributing

Issues, ideas, and pull requests are welcome. The `core/` files in particular benefit from DSP expertise — if you know FFT, phase vocoders, or bioacoustics, your contributions are especially valued.

---

## Licence

MIT — free to use, modify, and distribute.

© 2025 Media Resonance Engine
