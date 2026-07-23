# Accessibility approach, testing and limitations

Latest review: 23 July 2026

TIMUDS targets applicable WCAG 2.2 Level A and AA success criteria. This is a design target, not a conformance claim. Automated tests, code review and one browser engine cannot replace an expert audit or testing by disabled people.

TIMUDS is exploratory research software. It has not been validated as assistive technology, clinical equipment, perceptual measurement or scientific instrumentation.

Detailed evidence:

- [Accessibility audit](accessibility-audit.md)
- [WCAG 2.2 A/AA matrix](wcag-2.2-aa-matrix.md)
- [Screen-reader test plan](screen-reader-test-plan.md)

## Current implementation

- One main landmark, concise header, footer, stable page navigation and skip links to main, traversal and current position.
- Logical headings and native buttons, ranges, numbers, selects, text area, file input, checkboxes, disclosures, definition lists and source-point table.
- Silent initial state. Enable audio prepares the graph without sounding it. Play, Hear and calibration are deliberate sound actions.
- Persistent Stop all sound, low initial master gain, voice gains, mute, solo, mono-friendly centring and smooth fades.
- A complete visible current-position definition list available without audio or the SVG.
- A native Position along curve range plus named start, back, forward and end actions.
- A dedicated focused two-dimensional controller with native x/y ranges and number inputs.
- Optional WASD, off by default and active only on the focused controller.
- Point-by-point curve editing, deletion and reordering without drawing or dragging.
- Focused import-error summary linked to preserved invalid input with line or item information where possible.
- One polite live status for discrete messages. Timed announcements are off by default. Rapid explorer messages replace a pending message after a short idle period.
- Light and dark schemes, reduced-motion handling, forced-colour rules and narrow single-column reflow.
- A concise SVG description with detailed data available outside the image.

## Keyboard instructions

### General

Use Tab and Shift+Tab to move through native controls. Enter and Space activate controls according to browser conventions. The first Tab reveals skip links.

No arrow, Home, End, Space or WASD handler is registered across the page. Escape has one safety use while sound is active; it leaves editable and dialog controls alone.

### Follow the curve

Focus **Position along curve**:

| Key         | Action                                       |
| ----------- | -------------------------------------------- |
| Left Arrow  | Decrease curve progress by the selected step |
| Right Arrow | Increase curve progress by the selected step |
| Home        | Move to the start                            |
| End         | Move to the end or closed-curve seam         |

The Move to start, Step backwards, Step forwards and open-curve Move to end buttons provide the same operations.

### Two-dimensional exploration

Activate **Enter two-dimensional exploration**. Focus moves to the plane controller after this deliberate action.

| Key              | Action                                                            |
| ---------------- | ----------------------------------------------------------------- |
| Left Arrow       | Decrease numeric x                                                |
| Right Arrow      | Increase numeric x                                                |
| Up Arrow         | Increase numeric y                                                |
| Down Arrow       | Decrease numeric y                                                |
| Shift plus Arrow | Use the coarse step                                               |
| Escape           | Fade preview audio, leave the mode and restore the curve position |
| Tab / Shift+Tab  | Leave the controller normally                                     |

Up always increases numeric y. Inverting Y pitch does not reverse coordinate movement. Leaving the controller makes its keys inactive immediately. The native x/y controls offer the same coordinate changes when a screen reader retains arrow keys in browse or Quick Nav mode. Users are not asked to disable their screen reader.

### Optional WASD

**Enable WASD in the two-dimensional explorer** starts unchecked. When checked, W increases y, A decreases x, S decreases y and D increases x. These characters have no application action outside the focused controller and type normally in editable controls.

### Audio safety

The visible **Stop all sound** button remains available after audio is enabled. Escape fades currently active audio when focus is outside editable fields and dialogs. Changing or hiding the page also fades timed playback.

## Screen-reader and audio coexistence

The explorer provides:

1. Sustained sound.
2. A configurable short preview after movement.
3. Sound only when Hear current position is activated.

Moving focus away from the controller fades a sustained explorer preview. Timed traversal retains its own Play, Hold and Stop state. No attempt is made to detect a screen reader.

Announcement detail can be Off, Coordinates only, Coordinates and pitches, or Full position details. Coordinates only is the initial manual-movement setting. Timed playback announcements are initially Off and may be set to 1, 2, 5 or 10 seconds.

The current-position section is static navigable text, not a live region. During playback React publishes it at a controlled rate of about ten times per second while the audio clock remains authoritative. Animation frames are never announced.

## Visual and numeric alternatives

The current-position and curve-summary sections expose:

- mode and transport state;
- normalised progress and elapsed time;
- x and y coordinates;
- notes and frequencies for both axes;
- active axis domains;
- direction and closure;
- whether audio is enabled and sounding;
- mute and solo state for each voice;
- point count, coordinate ranges and curve length.

The source-point table exposes individual coordinates and segment information. X/Y text labels, different marker shapes, solid/dashed treatments, timbre differences and state words supplement colour and stereo cues.

## Mono and hearing considerations

The two voices use different synthetic timbres. Panning is optional and never the only distinction. **Centre both voices (mono-friendly)** removes panning. Each axis has gain, mute, solo and test controls. Numeric note/frequency output remains available when the device is muted or a voice cannot be heard.

No automated test can judge safe volume, timbre separation, masking, distortion or comfort. Begin with low system output.

## Motion, zoom and reflow

TIMUDS has no flashing or decorative continuous animation. Reduced-motion mode removes smooth scrolling and transition duration. User-requested traversal remains controllable.

The production Chromium test verifies no page-level horizontal overflow at 320 CSS pixels. The point table may scroll inside its named container. Responsive CSS removes fixed multi-column layouts at narrow widths. Manual 200%, 400%, increased-text-spacing, mobile orientation and operating-system forced-colour tests remain required.

## Automated evidence

Available checks cover:

- 46 pure/component tests, including keyboard navigation, imports, initial silence, names, states, focus restoration and representative axe scans;
- nine Chromium production-preview flows covering skip links, audio enable/play/hold/stop, native range keys, pointer drawing, independent arrows, inverted pitch direction, Shift stepping, Escape, Tab exit, optional WASD, text entry, import errors, source-point editing and download-independent production semantics;
- axe in initial, audio-active, holding, error, explorer, point-editor, dark, reduced-motion, forced-colour emulation and narrow states;
- a 320 CSS-pixel page-overflow assertion;
- strict TypeScript, ESLint, Prettier and production build checks.

The tested browser engine is Chromium supplied by Playwright. No real screen-reader result is recorded.

## Manual checks not run

- NVDA with Firefox, Chrome or Edge.
- JAWS with Chrome or Edge.
- Windows Narrator with Edge.
- VoiceOver with Safari on macOS and iOS.
- TalkBack with Chrome on Android.
- Switch control, voice control and braille displays.
- Real forced-colour/high-contrast environments.
- 200% text-only scaling, 400% browser zoom and increased text spacing.
- Touch and pen hardware, mobile orientation and largest system text.
- Sustained, short-preview and on-demand audio alongside screen-reader speech.
- Mono, one-earbud, hearing-device and output-interruption behaviour.
- Testing by disabled participants.

## Known limitations

- Basic CSV parsing does not support quoted fields, locale decimal commas or arbitrary dialects.
- Imported full configuration files cannot yet restore mapping settings; exported curve coordinates remain inspectable.
- The SVG drawing mode needs pointer-like path input, although every practical authoring action has a native-control alternative.
- Very large point tables are paginated but still require sequential review.
- Screen-reader support for SVG descriptions, native ranges and disclosures varies.
- Synthetic audio differs across browsers, operating systems and output devices.
- The site has not received a formal external accessibility audit.

## Report a problem

Use the repository’s **Issues → New issue** page. Include:

- browser and operating system;
- assistive technology and version;
- input method;
- exact steps;
- expected and actual result;
- whether audio was enabled and which listening mode was selected.

Apply an `accessibility` label if the repository provides one.
