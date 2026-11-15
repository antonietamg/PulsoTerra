# Sonification design

## Two connected listening experiences

PulsoTerra separates a continuous geographic MIDI performance from category-specific impact motifs. Both depend on approximate map anomalies. The heartbeat is a third, separately controlled layer. Sound is intended to make patterns explorable and emotionally legible; it does not quantify climate damage or diagnose a physiological state.

## Continuous Vivaldi mapping

For a finite anomaly ΔT, let `d = clamp(ΔT, -2, 2)`:

```text
transposition in semitones = -6 × d
score tempo factor        = 2 ** (d / 2)
```

| Anomaly | Transposition | Tempo relative to original | Reference tempo |
| --- | --- | --- | --- |
| −2 °C | +12 semitones | 0.5 | 50 BPM |
| 0 °C | 0 | 1 | 100 BPM |
| +2 °C | −12 semitones | 2 | 200 BPM |

The supplied MIDI has 3,242 prepared notes and approximately 293.8 seconds at its original tempo. The filename does not establish that it contains all four complete concertos. Its SHA-256 and preparation metrics are in `dist/assets/music/provenance.json`.

The player keeps position in original-score seconds while applying continuous transposition and tempo changes, smoothed over roughly 200 milliseconds. It does not create a separate track for each geographic area. The smoothing affects musical parameters, not the reported anomaly. Relative intervals and the MIDI's harmony are preserved: this mode does **not** requantize the score into the impact-mode major/minor scales. Original comparison uses zero transposition, unit tempo factor, and no heartbeat at the same position. Missing map data suspend map-driven sound and progression; the original reference remains independently playable.

Recorded samples render the MIDI. Some programs use disclosed timbral substitutes, including harp for pizzicato strings, flute for ocarina, and clarinet for oboe. This is not a claim to reproduce the exact instrumentation of a concert performance.

## Expressive heartbeat

Let `a = abs(ΔT)`. The nominal rhythm is:

| Magnitude | Heartbeat |
| --- | --- |
| `a <= 0.5` | 60 BPM |
| `0.5 < a < 1` | 90 BPM |
| `1 <= a <= 1.5` | 125 BPM |
| `a > 1.5` | 130 BPM with expressive interval irregularity |

A complete recorded lub-dub cycle counts as one beat. The layer uses a processed recording of a human heartbeat, not an oscillator imitation. Its enable state and volume are independent of the main music. These ranges are project design choices. They do not model an actual person's cardiac response to temperature, establish stress, or diagnose tachycardia or arrhythmia.

## Impact-mode pitch, harmony, and tension

The general guide note begins with `72 - 6 × clamp(ΔT, -2, 2)` and is quantized within the project's major or minor scale. Major applies when `abs(ΔT) < 1.5`; minor applies at and beyond 1.5 °C. Additional tension is `clamp((abs(ΔT) - 0.5) / 1.5, 0, 1)`. It grows gradually through changes in intervals, texture, continuity, and spacing rather than simply raising the volume.

Water adapts pitch to its own monotonic C-pentatonic guide in MIDI 55–76 to preserve a natural bowed-violin register. Samples may be voiced in their suitable octave. Animal calls and industrial percussion retain their recognizable natural pitch. The existing industrial march receives only small changes. The heartbeat policy remains separate from all these musical adaptations.

| Category | Sound choice and artistic reference | Interpretation |
| --- | --- | --- |
| Water availability | Softly bowed recorded violin; Vivaldi's flowing-water imagery | Continuous flow near reference; increasing tension and discontinuity farther away |
| Biodiversity and ecosystems | Recorded blackbird, frog, tawny owl, and insect | More call types inside −1.5 to +1.5 °C; one type at either inclusive extreme; not a species census |
| Forest impacts | Actual muted violin, flute, and clarinet; Wagner's *Forest Murmurs* | Leaf-like textures and bird-like gestures; increasing fragmentation |
| Ocean impacts | Harp, strings, and brass; Debussy's *La mer* | Undulation and breadth, with changing continuity and tension |
| Marine life | Recorded flute and cello; Crumb's *Vox Balaenae* | Whale-like inflections and lament; not recorded whale calls or measured animal distress |
| Human impacts | A real recorded nonprofessional human vocal group | Cohesion near reference and expressive fragmentation farther away |
| Ice melt | Recorded water drops and studio ice Foley, with glockenspiel | A fragile crystalline texture; extreme cold sounding tense does not imply cold causes melting |
| Economic impacts | Recorded bass drum, snare, anvil, and brake-drum metal | An original industrial march with its recognizable pattern largely preserved |

The impact motifs are original arrangements inspired by these references, not recordings or score reproductions of Wagner, Debussy, or Crumb. Earlier Food/harvest piano material was replaced by Ice Melt at the team's request; the current interface contains eight categories.

## Scientific inspiration and project decisions

Temperature–pitch correspondences discussed by Wang and Spence (2017) and Spence (2020) informed the colder/higher and warmer/lower direction. These experiments concern particular sensory tasks, not a universal climate-sonification law. The 2017 work also reports cold-water associations with **faster** tempo; PulsoTerra's colder/slower tempo rule is therefore explicitly the team's narrative design choice, not a reproduction of that experimental finding. See [the paper](https://ora.ox.ac.uk/objects/uuid%3A0b412fea-eeca-448d-9de4-f160264aa2eb) and [review](https://brill.com/downloadpdf/journals/msr/33/6/article-p645_4.pdf).

The contrast between major and minor in *The Four Seasons* inspired an expressive vocabulary. The ±1.5 °C threshold and exact notes were chosen for this project, not prescribed by Vivaldi. Absolute anomaly is used symmetrically for expressive tension; real climate risks from warming and cooling are not assumed to be symmetric.
