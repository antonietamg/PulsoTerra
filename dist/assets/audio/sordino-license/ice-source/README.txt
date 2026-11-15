DESHIELO — ORIGINAL SUN SOURCE IMPORT
Origin: Sun commit 537a9ecdfac1a395a6a026d3c3783b17ebe3caf3.
All seven imported source recordings are CC0. Exact MP3 and prepared-WAV
hashes, source URLs and transformations are in manifest/provenance JSON.
The preview was copied without re-encoding. It uses six of the seven palette
samples; the third glockenspiel pitch remains available for live playback.
No heartbeat is included in the published ice preview.

prepare_ice.py is the original portable preparation source (Python 3, NumPy,
FFmpeg). It expects originals/ to contain the six distinct raw source WAVs:
drops-1386.wav, ice-2205.wav, ice-2207.wav, glock_soft_G4_01.wav,
glock_soft_C5_02.wav and glock_soft_G5_01.wav. Obtain them from the exact
manifest downloadUrl entries and verify sourceSha256 before preparing.
The resulting raw-source paths are local to your reconstruction directory;
no personal origin filesystem paths are distributed here.

The three LaSonotheque recordings are explicitly redistributable CC0:
https://lasonotheque.org/gouttes-eau-3-s1386.html
https://lasonotheque.org/glace-qui-craque-1-s2205.html
https://lasonotheque.org/glace-qui-craque-3-s2207.html
https://lasonotheque.org/licences.html
Glockenspiel: VCSL, Versilian Studios LLC / Sam Gossner, CC0, pinned source
commit and source hashes in manifest.json; exact VCSL license is included.

The drops were recorded into a plate; the ice was crushed in a studio.
Neither is a glacier field recording. These are artistic thematic sounds
for a temperature-anomaly map, not measurements of ice mass or sea level.
The original and derived Bukvic forest package has its separate exact
Artistic License 2.0beta4; importing this CC0 palette does not alter it.
