# PulsoTerra user guide

## Start listening

Open the [public app](https://pulso-tierra-rgb-anton.akisunshin.chatgpt.site/). The welcome page provides English and Spanish audio instructions, pause/resume and stop/reset buttons, downloadable MP3s, and transcripts. Audio starts only when requested. Selecting a language recording restarts that recording; entering the app stops it.

Choose English or Español for the interface, then activate **Start / Iniciar**. Accessibility preferences are available on the welcome page and in the app. The animated alien is silent and has its own pause button.

## Explore without a pointer

With NVDA running in Edge, press Escape and then Control+Home. Activate **Skip to the accessible explorer**. Press Tab to move between controls and Shift+Tab to go back. Arrow keys choose native selector options; Enter activates buttons. If arrows are reading the page, press Enter on the selector before changing its value. Escape leaves an automatically entered form field.

Choose **Map or soundscape**, **Year**, and **Region or reference point**. Leave Row and Column alone when choosing a named region. Your choices take effect only when you activate **Check this area**. NVDA announces a short reading. **Announce the current reading** provides the coordinates and sound parameters. **Listen to this area** starts playback; **Pause all audio** stops it.

For other locations, choose Row and Column and check again. Row 1 is north and Column 1 is west. Editing either clears the named region. **Previous area** and **Next area** move through the grid. Enable **Play audio when moving between areas** if desired. **Play the full tour** advances automatically. Optional spoken readings during a tour are limited to at most one every four seconds.

Data are approximate local anomalies relative to 1951–1980. A missing-data announcement means silence, not zero temperature. The region list contains useful starting points; it is not an exhaustive set of countries.

## Geographic Vivaldi map

Start the music, then move the cursor over the map without holding a mouse button. On a touchscreen, tap or drag. The player keeps one musical position. Warmer anomalies lower the pitch and speed the score up; colder anomalies raise the pitch and slow it down. Pause retains position; restart returns to the beginning. Keyboard and screen-reader users select locations through the accessible explorer instead.

In **Compare Vivaldi**, **Play original** sets the original pitch and tempo and silences the heartbeat. **Map-driven** returns to the temperature response at the same musical position. This is a sample-based rendition of the supplied MIDI, not an original orchestral recording.

## Impact soundscapes

Choose any of the eight categories in the explorer or use the visible category cards. All use temperature maps as their input. Listen for instrumental identity, changes in continuity and tension, animal variety, and the separate heartbeat. Each category has a brief explanation of its sound choices. See [sonification design](SONIFICATION.md) for the complete mapping.

## Controls and exports

Music volume and heartbeat presence have separate controls. The heartbeat can be turned off. Use the gallery of six dated records to choose a map visually; only the selected record rotates during playback. Map-driven and original-reference modes are available for comparison.

The geographic WAV export is a **30-second sample**, not the complete MIDI performance. The impact WAV export retains its three-minute maximum. The full geographic piece can be heard in the app. The sound gallery contains prepared demonstrations; those recordings are examples, not a fresh export of the current selected cell.

The generated `PulsoTerra-sin-internet.html` embeds application media for a presentation without a network connection. The sound gallery has its own generated offline HTML. Preference storage is browser-local; another browser or device may start with defaults.

## Troubleshooting

If there is no sound, activate a play button, check the site/browser volume and system output, and try a location with valid data. If speech and music compete, use **Pause all audio**. Control stops NVDA speech only; it does not pause music. The welcome guide has its own pause/stop controls. No Insert-key shortcut is required for the basic route described above.
