# Testing record

## Previous real NVDA review

On 15 November 2026, NVDA was running on the team's Windows computer and its Speech Viewer displayed actual announcements from Microsoft Edge. Tests first covered the earlier public release and the local updated application. All eight impact categories were queried and their area playback started/finished with NVDA confirmation. The main route and initial category flows were exercised with keyboard navigation; some later category setup used a pointer to broaden functional coverage.

A final public-site review of version 19 then confirmed:

- English → Spanish → English → Spanish changed the selector value without repeating long guide text or volume percentages.
- The skip link opened the accessible explorer; Tab moved through native controls and action buttons.
- Water, 2000, Europe produced approximately +1.42 °C on the impact grid and a single short announcement.
- Enter activated area playback, with start and finish announcements.
- During a running tour, changing the draft year to 1980 kept focus and the chosen value while map readouts continued updating.
- Changing to Economy preserved 1980 and Europe until Check this area was activated; its queried anomaly was approximately −0.28 °C.
- Shift+Tab reached Pause all audio from the tour button; Enter stopped the tour and NVDA confirmed the pause.

Earlier checks covered the original/map-driven comparison and a missing-data case: 1890, geographic grid row 1, column 7. That case was announced as having no valid data, with area listening unavailable. Geographic and impact grids can produce different estimates because they summarize different neighborhoods.

## Automated regression checks

The pre-onboarding release passed 117 Node tests, including 16 focused selector tests. The welcome-audio release adds behavioral coverage for its own playback controls, switching languages, cancellation, and navigation. Run `node --test tests/*.test.cjs` for the actual current result; a historical count is not a substitute for running the current suite.

The optional Python image checks compare RGB/alpha and hashes with retained official NASA originals. They skip if those originals are not present. Inline JavaScript in generated portable files is also parsed during release checks.

## What these checks do not establish

Speech Viewer confirms text emitted by NVDA, not subjective acoustic quality or pronunciation. Browser playback checks establish that the audio engine or media element starts, advances, pauses, and stops; they are not an expert listening evaluation. The assistant did not physically listen to the music through the computer's speakers. These checks do not certify WCAG conformance or prove usability for all blind users, all assistive technologies, or all possible map combinations.

For future validation, recruit blind participants, evaluate onboarding without sighted assistance, compare exploration accuracy and cognitive load, and record the actual browser, NVDA version, keyboard layout, language, and audio-device setup.
