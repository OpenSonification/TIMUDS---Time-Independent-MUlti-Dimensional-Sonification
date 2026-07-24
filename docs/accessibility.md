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
- Persistent Stop all sound, low initial master gain and one shared 120 ms cancellation/fade path.
- A native dropdown selects Pitch, Volume, Tone brightness or Pulse rate.
  Pitch is the default. Spatial voice retains X pan and applies the selected
  property to Y; Axis voices applies it independently to X and Y.
- Volume is bounded to 10–100% beneath the separate listening gains. Brightness
  is bounded to 0.35–2.5 times the instrument filter and pulse rate to
  0.75–8 Hz. The live readout exposes the exact mapped value.
- Mono-compatible output preserves both dimensions with centred Axis voices.
- Default Axis voices share a centred MIDI 60–72 register and matched listening
  gains. Contrasting instruments identify X and Y without making loudness,
  register or stereo hearing the distinction.
- Sixteen independently selectable synthetic timbres with visible
  descriptions, named calibration controls and a persisted 0.5–5 second
  test-sound length.
- Five original, locally generated test patterns with a visible selector and
  descriptions. Changing the pattern or instrument remains silent.
- Separate native MIDI file inputs for X and Y, bounded local parsing, associated inline errors, a readable note-palette summary and a remove action.
- Separate native audio-file inputs for X and Y, a 10 MB encoded-file bound,
  a 0.05–30 second decoded-duration bound, associated inline errors, visible
  filename/duration/reference-note output and a remove action. Choosing a valid
  sample may enable the audio graph for decoding but does not play sound.
- A concise visible coordinate/progress/state readout available without audio or the SVG, with notes, frequencies and engine state in Technical details.
- Configurable progress ticks with the native slider and percentage as non-audio equivalents. Ticks are never live-announced.
- A central, disableable keyboard shortcut resolver with workspace and deliberately selected site-wide scopes.
- A native Position along curve range plus named start, back, forward and end actions.
- A dedicated focused two-dimensional controller with native x/y ranges and number inputs.
- Optional WASD, off by default and active only on the focused controller.
- Point-by-point curve editing, deletion and reordering without drawing or dragging.
- Focused import-error summary linked to preserved invalid input with line or item information where possible.
- An optional Voice over checkbox beside Play starts off and uses the browser's
  installed English speech voice for discrete curve landmarks when selected.
  One polite live status carries the matching text. Timed position
  announcements also remain off by default, and rapid explorer messages
  replace a pending message after a short idle period.
- Light and dark schemes, reduced-motion handling, forced-colour rules and narrow single-column reflow.
- A concise SVG description with detailed data available outside the image.

## Keyboard instructions

### General

Use Tab and Shift+Tab to move through native controls. Enter and Space activate controls according to browser conventions. The first Tab reveals skip links.

Workspace shortcuts support Space, S, R, Left/Right, Shift+Left/Right, Home,
open-curve End, Escape and ?. They can be switched off or deliberately extended
site-wide. Editable fields and input widgets retain their keys. A button retains
Space and Enter while allowing S and R, so those commands still work after
Play or another button leaves focus in place. Open dialogs, IME composition,
the browser and assistive-technology modifier commands remain guarded. The
visible Keyboard help dialog contains the complete map and restores focus when
closed.

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

Up always increases numeric y. Inverting a sound-mapping direction does not
reverse coordinate movement. Leaving the controller makes its keys inactive
immediately. The native x/y controls offer the same coordinate changes when a
screen reader retains arrow keys in browse or Quick Nav mode. Users are not
asked to disable their screen reader.

### Optional WASD

**Enable WASD in the two-dimensional explorer** starts unchecked. When checked, W increases y, A decreases x, S decreases y and D increases x. These characters have no application action outside the focused controller and type normally in editable controls.

### Audio safety

The visible **Stop all sound** button remains available after audio is enabled.
S and Escape use the same fade when focus is outside controls and dialogs.
Reset, curve/mode changes, previews, explorer exits and page hiding also use the
common cancellation/fade path.

**Test sound length** defaults to 2 seconds and applies only to the main Test
sound button and the X/Y calibration buttons. Struck sounds use a
duration-aware decay during those tests, so a drum remains audible without
changing the short articulation used to follow a curve. The native range is
keyboard-operable and exposes its value in seconds. Stop all sound can end a
test before its timer.

**Test pattern** chooses a held note, bebop-style run, boogie bass pattern,
son-clave pulse or 3:2 hemiola. These are original local note sequences rather
than recordings or copied MIDI files. Each is scaled to the selected test
length, and rests fade the preview. The instrument and phrase selectors never
start sound by themselves.

## Screen-reader and audio coexistence

The explorer provides:

1. Sustained sound.
2. A configurable short preview after movement.
3. Sound only when Hear current position is activated.

Moving focus away from the controller fades a sustained explorer preview. Timed traversal retains its own Play, Hold and Stop state. No attempt is made to detect a screen reader.

Announcement detail can be Off, Coordinates only, Coordinates and sound values,
or Full position details. Volume percentages, brightness multipliers and pulse
rates replace changing-pitch details when their mapping is active. Coordinates
only is the initial manual-movement setting. Timed playback announcements are
initially Off and may be set to 1, 2, 5 or 10 seconds.

Curve-landmark Voice over starts unchecked and sits next to Play. After the
user selects it, playback uses `SpeechSynthesisUtterance` with an installed
English voice to speak the first crossing of the lowest and highest X and Y
source-point values. Shared extrema form one phrase. Constant axes receive one
constant-axis phrase. Hold, Stop all sound, Reset, disabling Voice over and page
teardown cancel queued speech. No speech starts before Play.

The current curve's landmark names and exact coordinates remain ordinary text.
If browser speech synthesis is absent, the checkbox is disabled and this text
remains available. Screen-reader users should manually check for duplicated
speech from the browser voice and live status; the checkbox can disable browser
speech.

The current-position section is static navigable text, not a live region.
During playback React publishes it at a controlled rate of about ten times per
second while the audio clock remains authoritative. Animation frames are never
announced; only a user-selected timed interval or a crossed landmark can
produce playback speech.

## Visual and numeric alternatives

The always-visible current-position summary exposes coordinates, progress and
sound state. Its Technical details and the Curve summary additionally expose:

- mode and transport state;
- normalised progress and elapsed time;
- x and y coordinates;
- notes and frequencies for both axes;
- selected value mapping and current mapped volume, brightness or pulse rate;
- active axis domains;
- direction and closure;
- whether audio is enabled and sounding;
- mute and solo state for each voice;
- selected instrument or uploaded sample, including its duration and reference
  note, and the continuous or imported MIDI pitch source for each voice;
- point count, coordinate ranges and curve length.
- current curve-benchmark names and coordinates.

The source-point table exposes individual coordinates and segment information. X/Y text labels, different marker shapes, solid/dashed treatments, timbre differences and state words supplement colour and stereo cues.

## Mono and hearing considerations

Panning is never the only distinction. Axis voices also uses separate registers,
timbres, labels and numeric values. **Mono-compatible output** selects and
centres Axis voices instead of silently dropping Spatial voice's X mapping.
Each axis has instrument, gain, mute, solo and test controls. Numeric
note/frequency output and the imported MIDI palette remain available when the
device is muted or a voice cannot be heard.

No automated test can judge safe volume, instrument separation, masking,
distortion, decay comfort, filter salience, pulse comfort or whether a
synthetic label matches a listener’s expectation. Begin with low system output.

## Motion, zoom and reflow

TIMUDS has no flashing or decorative continuous animation. Reduced-motion mode removes smooth scrolling and transition duration. User-requested traversal remains controllable.

The production Chromium test verifies no page-level horizontal overflow at 320 CSS pixels. The point table may scroll inside its named container. Responsive CSS removes fixed multi-column layouts at narrow widths. Manual 200%, 400%, increased-text-spacing, mobile orientation and operating-system forced-colour tests remain required.

## Automated evidence

Available checks cover:

- Pure/component tests covering spatial mapping, pan bounds, sign blending,
  overlap detection, progress thresholds and loops, shortcut guards, validated
  preferences, persistent graph scheduling, MIDI parsing, imports, focus
  restoration and representative axe scans.
- Chromium production-preview flows covering both audio modes, contrast repair,
  mono fallback, shortcut help and fade scheduling as well as transport,
  imports, drawing, explorer operation, MIDI maps and source-point editing.
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
- Browser Voice over and screen-reader speech together, including cancellation
  and duplicated-speech checks.
- Curve-landmark speech in forward, reverse and looped traversal, including
  coincident and constant-axis landmarks.
- Mono, one-earbud, hearing-device and output-interruption behaviour.
- Perceptual distinction, spatial movement, sign-cue usefulness, progress-tick
  comfort, audition-pattern clarity and every synthetic voice pairing. See
  [manual-listening-test.md](manual-listening-test.md).
- MIDI note-map naming, error and pitch-palette output with each listed screen reader.
- Testing by disabled participants.

## Known limitations

- Basic CSV parsing does not support quoted fields, locale decimal commas or arbitrary dialects.
- Imported full configuration files cannot yet restore mapping settings; exported curve coordinates remain inspectable.
- The SVG drawing mode needs pointer-like path input, although every practical authoring action has a native-control alternative.
- Very large point tables are paginated but still require sequential review.
- Screen-reader support for SVG descriptions, native ranges and disclosures varies.
- Synthetic audio differs across browsers, operating systems and output devices.
- MIDI import uses note-on pitches as a sorted palette. It does not replay
  timing, velocity, channels, programs or effects.
- Uploaded sound decoding depends on browser codecs. Samples loop in full;
  there is no trimming or loop-point editor, and pitch changes also change
  playback speed.
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
