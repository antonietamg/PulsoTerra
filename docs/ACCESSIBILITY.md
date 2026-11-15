# Accessibility and independent NVDA navigation

## Welcome audio guide

The welcome page has a first keyboard shortcut to **Audio instructions / Instrucciones de audio**. English and Spanish recordings are separate, explicitly labeled buttons, so visitors can find their language before choosing an interface language. Neither recording autoplays. Both languages remain available regardless of the interface setting.

Use Tab and Shift+Tab to reach the controls, then Enter or Space to activate them. Pause/Resume preserves position. Stop/reset returns to the beginning. Choosing either language starts that guide from the beginning and replaces the other guide: two instruction tracks never play simultaneously. Starting the application stops the guide. Downloads and full transcripts are available under **Read or download / Leer o descargar**. The transcript container is keyboard scrollable. Speech is synthetic and contains no background music.

## Independent exploration route

Run NVDA and open PulsoTerra in Microsoft Edge. Finish or pause the welcome recording, then activate Start. Press Escape, Control+Home, and Enter on **Skip to the accessible explorer**. Tab reaches Map or soundscape, Year, Region, Row, and Column. Arrow keys choose options. On a selector, Enter can enter focus mode if arrows are reading the page. Escape leaves automatically entered focus mode.

Select category, year, and region, then activate Check this area. Only this explicit action applies the choices. An announcement identifies the result. Announce the current reading gives the longer description. Listen to this area, Previous area, Next area, Play the full tour, and Pause all audio provide the nonvisual listening route. Editing row or column clears the named region. Missing data are announced and silent. Read the [user guide](USER_GUIDE.md) for comparisons and optional automatic playback.

Control stops NVDA's speech; it does not pause the recording or sonification. Use the corresponding in-page pause button. The basic route needs no Insert-key command. For advanced NVDA commands, its modifier is Insert or a configured Caps Lock; manually toggled focus mode can be changed with NVDA+Space. See the [official NVDA guide](https://download.nvaccess.org/documentation/en/userGuide.html).

## Interface provisions

- Native HTML selectors and buttons, visible focus, meaningful labels, skip links, headings, and landmarks.
- Focused fields are retained and stay enabled during updates. Choices remain drafts until explicitly checked. Inactive actions use guarded `aria-disabled` without removing focus.
- A dedicated polite announcement region, with long explanatory text readable on request rather than repeated automatically during language changes.
- Optional tour announcements throttled to no more than once every four seconds; off by default.
- OpenDyslexic, enlarged text, high contrast, and reduced-motion behavior. Data-image colors remain intact rather than being inverted or recolored.
- Independent music and heartbeat controls. Silent decorative video with a pause option.

## Verification and limits

Real NVDA/Edge interaction and announcements were checked on Windows, including a later check on the public site. The tests included the eight categories in the earlier review and the language/focus corrections in the final public review. Automated fixtures are complementary and do not emulate NVDA. New welcome-guide checks are recorded separately in [TESTING.md](TESTING.md).

This is not a WCAG certification, a usability study with blind participants, or a guarantee for every browser, screen-reader configuration, hearing profile, or braille device. Sonification alone does not ensure accessibility for Deaf or hard-of-hearing visitors; the data readings, summaries, and transcripts provide a text route, but the musical experience needs additional evaluation. Perceptual intuitiveness and cognitive load also require user research.

When reporting a barrier, include the browser, screen reader, interface language, control name, and expected versus observed behavior. Do not include private screenshots, credentials, or unnecessary personal information.
