# PulsoTerra

PulsoTerra turns NASA temperature maps into music for everyone. Explore Vivaldi, eight climate impact soundscapes, and expressive heartbeats, with screen reader support, keyboard navigation, and dyslexia-friendly text to include blind, low-vision, and dyslexic users.

[Open the public app](https://pulso-tierra-rgb-anton.akisunshin.chatgpt.site/) · [User guide](docs/USER_GUIDE.md) · [NVDA and accessibility](docs/ACCESSIBILITY.md) · [Team and authorship](AUTHORS.md)

## What you can explore

- Six dates: 1890, 1920, 1950, 1980, 2000, and 2023.
- A geographic map with 16 named land regions and additional ocean/polar reference points in the accessible explorer.
- One continuous Vivaldi performance whose pitch and tempo respond smoothly to the selected anomaly, plus an original-reference comparison.
- Water, biodiversity and ecosystems, forests, oceans, marine life, human impacts, ice melt, and economic impacts.
- English and Spanish interfaces; recorded bilingual NVDA instructions and transcripts on the welcome page; OpenDyslexic, large text, high contrast, and reduced-motion support.
- A sound-preview gallery and a generated single-file offline app.

The input is a rendered temperature-anomaly image, not a raw climate raster. The impact categories are **artistic interpretations of the temperature maps**, not eight measured damage datasets. The heartbeat is an expressive metaphor, not a physiological or medical model.

## Run locally

Install Node.js 22 or later. No package installation or API key is required to run the app.

```sh
node serve.mjs
```

Open `http://127.0.0.1:4173/`. Keep the server running during use. The complete deployable application is in `dist/`; it can be served by a static host. Use an HTTP server for normal development rather than opening `dist/index.html` directly.

## Verify and build

```sh
node --test tests/*.test.cjs
node tools/build-welcome-content.mjs
python build-sound-gallery.py
node build-offline.mjs
```

Python 3 is needed for the gallery builder. See [reproducibility](docs/REPRODUCIBILITY.md) for optional image-integrity tests, asset regeneration, and Windows speech generation. Generated portable HTML files are excluded from source control.

## Documentation

| Document | Purpose |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Listening, map exploration, comparisons, downloads, and preferences |
| [Accessibility](docs/ACCESSIBILITY.md) | Independent NVDA navigation, audio-guide operation, verification, and limits |
| [Data and image analysis](docs/DATA_AND_METHODS.md) | NASA provenance, RGB inversion, missing data, and interpretation limits |
| [Sonification design](docs/SONIFICATION.md) | Exact pitch, tempo, heartbeat, tension, and category choices |
| [Architecture](docs/ARCHITECTURE.md) | Files, data flow, browser state, and maintenance |
| [Development history](docs/DEVELOPMENT_HISTORY.md) | How the team's design evolved through review and revision |
| [ChatGPT collaboration](docs/AI_COLLABORATION.md) | Team ideas, human direction, AI assistance, and authorship transparency |
| [Reproducibility](docs/REPRODUCIBILITY.md) | Local setup, checks, generated outputs, and deployment |
| [Asset credits](docs/ASSET_CREDITS.md) | Source inventory and separate resource licenses |
| [References](docs/REFERENCES.md) | Scientific, musical, data, and accessibility sources |
| [Testing record](docs/TESTING.md) | Automated checks and the scope of real NVDA testing |

## Team

Created by Paola Sosa Zepeda, Paris Jolie Maceda Espejel, Sundury Aloany Valente Solis, Griselda Miranda González, and Dr. Antonieta Martínez-Guerrero at Universidad de las Américas Puebla (UDLAP), in connection with ENTRAMADO Lab. See [AUTHORS.md](AUTHORS.md) for affiliations. ChatGPT/Codex assisted the team with implementation and documentation under human direction.

The project was developed in response to the NASA Space Apps Challenge, **The Earth Information Jukebox**. NASA supplies referenced scientific resources; this project does not claim NASA endorsement. The interface does not display the NASA logo.

## Licensing

See [LICENSE.md](LICENSE.md) and [asset credits](docs/ASSET_CREDITS.md). Resource licenses differ; there is no blanket CC0 license for this repository. In particular, retain the heartbeat attribution and the exact Artistic License Version 2.0beta4 notices and source bundle for the relevant forest material.
