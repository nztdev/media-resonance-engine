# Module: Script Alignment

**Status:** Coming Soon · In Development  
**Media types:** Text · PDF  
**Registry ID:** `script-alignment`  
**Target version:** v0.7 (web) · m2.0 (native)

---

## What this module will do

Script Alignment analyses written content for its intrinsic resonance frequency — derived from syllabic rhythm, sentence cadence, tonal vocabulary, and structural pacing — and suggests or applies transformations to bring the text into harmonic alignment with a target frequency.

## Resonance model for text

Text carries frequency in several measurable dimensions:

| Dimension | Measurement | Resonance signal |
|-----------|-------------|-----------------|
| Syllabic rhythm | Syllables per word | Tonal density |
| Sentence cadence | Words per sentence | Harmonic flow |
| Lexical diversity | Unique word ratio | Coherence |
| Punctuation density | Punctuation / total chars | Rhythm regularity |
| Paragraph structure | Sentence count variance | Macro pacing |

The `resonance-analyser.js` `scoreText()` function implements the core scoring. This module wraps it with a full text processing pipeline and output formatter.

## Planned processing pipeline

```
Text / PDF input
  → TextDecoder / PDF text extraction
  → Tokenisation (words, sentences, paragraphs)
  → resonance-analyser.scoreText() → original score
  → Alignment suggestions engine
  → Optional: automated rhythm adjustment
  → Tuned text output + resonance report
```

## Module folder structure (planned)

```
modules/script-alignment/
  index.js              ← registration
  tokeniser.js          ← word / sentence / paragraph splitting
  rhythm-analyser.js    ← syllable counting, cadence measurement
  alignment-engine.js   ← suggestion generation
  pdf-extractor.js      ← PDF text extraction (browser)
  README.md
```

## Notes

The core scoring algorithm is already implemented in `core/resonance-analyser.js` (`scoreText()`). This module provides the text preprocessing pipeline that feeds it, and the output formatting that presents suggestions in a readable form.
