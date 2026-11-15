# Data and image analysis

## Input and provenance

The current app uses rendered maps from [NASA SVS visualization 5207](https://svs.gsfc.nasa.gov/5207/), linked from the [Climate Vital Signs Dashboard](https://svs.gsfc.nasa.gov/gallery/climate-vital-signs-dashboard/). They show surface-temperature anomalies in the Robinson projection, with a 1951–1980 reference and a running 24-month average. White marks the reference, blue cooler conditions, and red warmer conditions. The visual palette saturates near ±2 °C.

| Visible date | Original frame index |
| --- | --- |
| 1890 | 57 |
| 1920 | 237 |
| 1950 | 417 |
| 1980 | 597 |
| 2000 | 717 |
| 2023 | 899 |

`dist/assets/sources.json` and `extra-sources.json` retain exact source URLs, image hashes, frame labels, and transformation metadata. A 1900 asset also remains from the earlier prototype; it is not one of the six current gallery choices. The app is a fixed historical selection, not a live feed of the latest NASA release.

## From image to anomaly

1. Download the referenced source frames and the legend calibration. Retain source hashes.
2. Crop titles, legend, and timeline away from the geographic image. Reduce using nearest-neighbor sampling. Keep original internal RGB values. An alpha mask removes only the exterior of the map; internal gray pixels remain visible.
3. Reject transparent pixels and colors that cannot support a valid temperature reading. Keep white as a valid zero-anomaly reference. Dark coastlines and missing-data gray are not converted into zero.
4. Convert accepted RGB colors and palette entries into CIE Lab, then match to the nearest calibrated palette entry using squared Euclidean distance in Lab. This is color-to-value inversion, not a learned computer-vision classifier.
5. Summarize valid recovered anomalies using their median. Grid aggregation happens **after** per-pixel inversion; averaging RGB colors first would change the meaning of the palette.
6. For point exploration, read a 5×5-pixel neighborhood. The geographic keyboard grid uses 32 columns and 16 rows. Impact grid resolution is controlled separately; the default is 12×6. The same coordinate can therefore yield different approximate summaries at different resolutions.
7. Preserve an empty result as `null`. Missing areas produce silence and a spoken explanation.

`pixels.js` validates and classifies colors; `anomaly-analysis.js` performs calibrated inversion and aggregation; `geography.js` relates display coordinates to approximate geographic locations; `atlas-app.js` connects those results to interaction and sound. Natural Earth boundaries support approximate orientation, not historical territorial reconstruction.

## What the values mean

These are estimates recovered from a finite-resolution, color-coded graphic. They are not absolute temperatures, raw GISTEMP grid values, forecasts, or direct measurements of impacts. Source saturation, rasterization, palette matching, coastlines, and spatial aggregation limit precision. A value shown to two decimal places is a display convention, not a claim of that level of scientific accuracy.

The histogram summarizes valid **image pixels** without area weighting. Robinson pixels do not represent equal surface areas, so its proportions are not global climate statistics. Do not infer a scientifically valid global mean by averaging them.

The eight impact categories reuse the temperature images as thematic canvases. They do not contain measured maps of water stress, species loss, forest biomass, sea-level rise, whale health, mortality, ice mass, or economic damage. Global warming scenarios relative to 1850–1900 in impact literature cannot be equated with a selected local anomaly relative to 1951–1980.

See [sonification design](SONIFICATION.md), [references](REFERENCES.md), and [reproducibility](REPRODUCIBILITY.md).
