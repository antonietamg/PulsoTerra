# Development history

This account follows the order of the team's requests and the resulting revisions. It avoids inventing individual dates or roles that are not established in the record.

## 1. From NASA visualizations to a listening concept

The project began by examining the Climate Vital Signs Dashboard and asking how its content could be sonified. With a presentation deadline, the team compared computer-vision interpretation with explicit RGB color mapping and selected RGB. Temperature became the first implemented vital sign. A public prototype, initially named Pulso Tierra, combined image exploration with two listening approaches.

## 2. Environmental themes and recognizable sounds

The team introduced eight impact categories and specific sound identities. Early results were rejected because they did not clearly sound like the requested animals, instruments, voices, or industrial march, and the heartbeat was difficult to hear. Revisions integrated recorded samples, made the heartbeat more present, softened water violins, and preserved the economy's march.

The team then emphasized meaningful exploration and musical coherence rather than arbitrary sound changes. The design evolved toward greater harmonic stability near the reference and increasing tension at larger anomaly magnitudes. Impact literature supplied narrative context, while the maps remained temperature maps. The distinction was made explicit instead of inventing historical impact measurements.

## 3. Ice Melt replaces Food

At the team's request, the Food/harvest category was replaced with the Ice Melt treatment from the Sun version. The adapted category uses water drops, ice Foley, and bell-like samples. Its imported preview has recorded provenance and a checksum. The other seven category identities were retained.

## 4. Alien welcome and project identity

The team provided the alien animation and asked for a blue welcome page with a comic invitation, a Start button, and a pastel application background drawn from the character. A backup of the previous visual version was retained. Supplied record images replaced the year-gallery thumbnails; the selected record rotates only during music playback. The previous-version button was removed.

The team corrected the name to **PulsoTerra** and required that it never be translated. It requested English/Spanish switching, OpenDyslexic, and branding. The initially misidentified ENTRAMADO logo was replaced with the correct team-supplied mark and reduced to a subtle welcome signature. The NASA logo was removed at the team's request.

## 5. Continuous Vivaldi exploration

The team supplied `The-Four-Seasons.mid` and specified warmer/lower/faster and colder/higher/slower behavior. It clarified that the experience must keep one performance as the cursor moves, without a separate track for each area and without holding down the mouse button. The implementation gained continuous scheduling, approximately 200 ms parameter transitions, pause/resume position preservation, and an original/reference comparison at the same position.

## 6. Scientific and visual corrections

The team identified unwanted dark edges and holes in the maps. The image pipeline was corrected to preserve internal original RGB and alpha while masking only the outside of the Robinson projection. White was retained as the zero-anomaly reference. Missing-data and coastline colors remain visible but do not become invented temperatures. NASA-source integrity checks were added.

Requests for a presentation script prompted tighter explanation of crossmodal perception, the heartbeat, and the project's multi-, inter-, and transdisciplinary aspirations. Brief in-app narratives explain the method and each sound choice. The team rejected a forced-looking explanation panel; it became a small speaking-alien video beside a comic-style text bubble.

## 7. Independent nonvisual navigation

The app gained native controls for selecting year, region, grid row and column, readings, area listening, tours, and pausing. Two selector barriers were corrected: updates no longer replace focused choices during use, and changes are drafts until explicitly checked. A category selector inside the accessible explorer makes all eight impacts and the geographic map reachable from the same route.

Real NVDA/Edge tests verified announcements and keyboard journeys alongside automated tests. An initial interruption in browser control prevented a final public check; a later authorized session completed that check. Long duplicate announcements on language changes were removed. [Testing details](TESTING.md) preserve the scope rather than describing the result as universal accessibility certification.

## 8. Bilingual onboarding and repository documentation

The team requested English and Spanish audio instructions on the welcome page so a blind visitor can learn the route without outside assistance. Downloadable synthetic-speech MP3s, transcripts, and keyboard-operable playback controls were added. The team also requested this English documentation set, complete credits, a public GitHub repository, and an explicit account of its ideas and AI-assisted implementation.

The repository history starts with a curated release of this project state. It is not presented as a complete import of private conversations or a reconstruction of every earlier edit. Retained legacy files and source notices are identified in the architecture and credits documents.
