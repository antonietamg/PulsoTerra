# Reproducibility and deployment

## Run a clone

Use a current desktop browser and Node.js 22 or later:

```sh
git clone https://github.com/antonietamg/PulsoTerra.git
cd PulsoTerra
node serve.mjs
```

Open `http://127.0.0.1:4173/`. The repository includes prepared runtime assets. It does not require an OpenAI API key, an npm install, or NASA credentials.

## Checks

```sh
node --test tests/*.test.cjs
```

The Node suite tests mapping, missing data, audio scheduling, interaction, original comparison, and selector behavior. It does not substitute for a real screen reader or human listening. To run source-image checks, install Python 3, Pillow, and NumPy, then retain/download the official originals:

```sh
python -m pip install Pillow numpy
python tools/prepare-assets.py
python tools/prepare-extra-frames.py
python -m unittest discover -s tests -p 'test_map_assets.py'
```

The image test class skips when original frames are absent. One additional independent-download audit is a separate local artifact and may also be skipped. Read skipped output; do not describe it as a passing independent comparison. Source-download scripts require network access and NASA availability. They regenerate maps; use a separate branch when checking reproducibility so changes can be reviewed.

## Build presentation artifacts

```sh
node tools/build-welcome-content.mjs
python build-sound-gallery.py
node build-offline.mjs
```

Outputs include `PulsoTerra-sin-internet.html`, `Escuchar-sonidos-PulsoTerra.html`, and the prepared sound package. They are ignored as build outputs. The full app's instruction MP3s and download links are embedded in the offline file.

## Recreate the welcome recordings

Edit `docs/audio-guide-scripts.json`. On Windows, use PowerShell, System.Speech, the voice names listed in the JSON, and FFmpeg:

```powershell
node tools/build-welcome-content.mjs
./tools/generate-nvda-audio.ps1
node build-offline.mjs
```

Pass `-Ffmpeg` with an executable path if FFmpeg is not on PATH. The current voices are Microsoft Zira (English) and Microsoft Sabina Desktop (Mexican Spanish). Other machines may need an installed voice with a different name; edit that field explicitly and record the new provenance. The script does not install voices or change system settings. It writes temporary WAVs under ignored `qa/nvda-audio/` and MP3s plus hashes under `dist/assets/instructions/`. Confirm the scripts and actual recordings remain equivalent before release.

## Other preparation scripts

`prepare-vivaldi.py --help` describes score regeneration from a supplied MIDI. The retained score and its provenance are enough to run the application. `prepare-sounds.py` is a research pipeline that expects the original downloaded sample manifests in ignored `sound-research/`; it is not a one-command fresh-clone installer. Reproduction recipes and source requirements for the forest material are preserved in `dist/assets/audio/sordino-source.zip` and the license subdirectories. Existing preview recordings may intentionally use an earlier documented engine; do not silently regenerate them with another version.

## Static hosting

Publish the contents of `dist/` to any appropriate static host. Use a host that serves MP3, MP4, MIDI, WOFF, JSON, and JavaScript with their correct MIME types. No service secret is needed in the browser. For GitHub Pages, configure a static publishing workflow or branch containing the `dist/` contents; this repository does not automatically enable Pages or replace the existing live site.

The current public site is maintained through ChatGPT Sites separately from GitHub. The GitHub export excludes `.openai/` hosting identity, private repository history, credentials, local caches, raw chats, and desktop screenshots. It starts a clean public source history. Future changes should be reviewed and synchronized deliberately between the deployment checkout and the public repository.
