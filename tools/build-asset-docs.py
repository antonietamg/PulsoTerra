"""Build the English asset inventory from the retained provenance records."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
meta=json.loads((ROOT/'dist/assets/audio/licencias.json').read_text(encoding='utf-8-sig'))
def safe(value):return str(value).replace('|','\\|').replace('\n',' ')
intro='''# Asset credits and resource permissions

## Scope

Credits below supplement, rather than replace, the exact notices, source records, hashes, and change declarations distributed with the assets. Scientific sources, performers, recordists, artists, and font authors retain their credits. There is no blanket CC0 grant for the application.

## Scientific images and geographic material

NASA SVS visualization 5207 supplies the source temperature frames and calibrated legend. Exact URLs and SHA-256 values are in `dist/assets/sources.json` and `dist/assets/extra-sources.json`. Cropping, nearest-neighbor reduction, and an exterior alpha mask are documented in [DATA_AND_METHODS.md](DATA_AND_METHODS.md). Natural Earth reference boundaries are public-domain material. The NASA logo is not used, and no NASA endorsement is claimed.

## Recorded music and environmental samples

VSCO 2 CE and VCSL material is credited to Sam Gossner, Simon Dalzell, Versilian Studios, and the source-specific contributors recorded below. These sample collections provide CC0 material. Animal and ice/drop recordings include Joseph SARDIN / LaSonotheque and Le tiroir du fond, with exact sources per asset. The human vocal group was recorded by Shane Vincent (ShangusBurger) at GameSoundCon 2024 and released as CC0.

The heartbeat credits Benboncan for the original recording and Natural Philo for the processed Commons version, under CC BY 3.0. It was cropped to a lub-dub cycle, faded, filtered/EQ'd, compressed, normalized, and scheduled at expressive intervals. Keep the credit, license link, and change declaration when redistributing it. [Source](https://commons.wikimedia.org/wiki/File:Human_heart_beating_at_61_bpm_(Cc-by-3.0).ogg) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

The actual muted violin was performed by Rena Ishii and published by Ivica Ico Bukvic in 2005. It retains **Artistic License Version 2.0beta4, October 2000**, not the later stable Artistic 2.0 license. Preserve `dist/assets/audio/sordino-license/` and `sordino-source.zip`, including the exact license, original source, change notices, and reproduction recipes. Do not relabel the forest derivative as CC0.

The original impact arrangements have the asset-specific grants recorded in `licencias.json`: CC0 where applicable, with Bukvic-derived material and its relevant contributions retaining the exact Artistic beta license. Referenced composers are artistic references, not performers or creators of these sample clips. Preview recordings have documented engine versions and transformations; they need not match every current live parameter.

## User-supplied visuals and MIDI

The alien animations and dated disc artwork were supplied by the team. Disc filenames identify Gemini-generated images; their artistic map appearance is not the NASA image analyzed for sound. The correct ENTRAMADO Lab mark was supplied and approved by the team. The public export omits personal local input paths. No third-party commercial logo or illustration license is inferred from uploading these files.

The team supplied `The-Four-Seasons.mid`. Its original hash, byte-identical retained copy, and prepared score statistics are in `dist/assets/music/provenance.json`. The composition attribution does not independently establish the provenance or redistribution rights of this particular MIDI transcription. The team should retain its source permission record; this repository does not invent a MIDI license.

## Typeface and instruction speech

OpenDyslexic is credited to Abbie Gonzalez. Exact font hashes and provenance are in `dist/assets/fonts/opendyslexic/provenance.json`; the included `OFL.txt` is the SIL Open Font License 1.1 notice. The font files are unmodified.

The bilingual welcome guides are synthetic speech generated locally using installed Microsoft voices: Zira for English and Sabina Desktop for Mexican Spanish. They are not recordings or imitations of team members. Scripts, settings, and file hashes are retained in `docs/audio-guide-scripts.json`, `tools/generate-nvda-audio.ps1`, and `dist/assets/instructions/provenance.json`. No general license for the underlying voice software is granted by this repository. The team's new instruction text is separate from voice-engine rights.

## Per-file audio inventory

Source titles and creator credits below preserve the original provenance spelling. Exact processing notes, source hashes, and licenses remain in [the original manifest](../dist/assets/audio/licencias.json).

| File | Creator or source credit | License | Primary source |
| --- | --- | --- | --- |
'''
rows=[]
for asset in meta['assets']:
    source=asset.get('sourceUrl','')
    rows.append('| `'+safe(asset.get('file',asset.get('id','')))+'` | '+safe(asset.get('creator','See retained manifest'))+' | '+safe(asset.get('license','See retained manifest'))+' | '+('[Source]('+source+')' if source else 'See retained manifest')+' |')
out=intro+'\n'.join(rows)+'\n\nThe inventory contains '+str(len(rows))+' active recorded samples. The ten prepared previews and their source/engine notices are described in `licencias.json`, `CREDITOS.txt`, and the retained source bundle. Original Spanish legal/source notices are kept verbatim alongside this English explanation.\n'
(ROOT/'docs/ASSET_CREDITS.md').write_text(out,encoding='utf-8')
print('Wrote asset credits for',len(rows),'recorded samples.')
