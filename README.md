# TIMUDS

**Time-Independent Multidimensional Sonification**

TIMUDS is a browser instrument for listening to an ordered two-dimensional
curve without turning x into time. In the default Spatial voice, x moves one
sound from left to right while y changes its pitch. Axis voices offers separate
X and Y sounds. In both cases, time only controls travel through the supplied
point order.

The default circle demonstrates why this matters. Its x coordinate repeatedly rises and falls, yet a complete circuit remains representable because no coordinate is sorted or treated as the clock.

> TIMUDS is exploratory research software. It has not been validated as assistive technology, a perceptual measurement, or scientific instrumentation. Do not use it for safety-critical interpretation.

## Current scope

- Eleven deterministic sources, including comparison pairs, zero crossings and
  constant-axis cases.
- Local CSV/JSON paste and file import with bounded input and useful validation.
- Point-by-point native editing, paginated source-point inspection and optional freehand drawing.
- Open/closed curves, reverse traversal, reset, summaries and reproducible JSON download.
- Constant-spatial-speed and uniform-segment traversal; timed, looped and manual control.
- Spatial and Axis voice modes backed by one persistent local Web Audio graph.
- Ten locally synthesised timbres with distinct spectra, filtering, attacks,
  vibrato and struck-note behaviour.
- Independent local Standard MIDI File note-map import for X and Y.
- Separated default Axis registers, overlap repair, stereo-width and explicit
  mono-compatible controls.
- Configurable progress ticks and guarded workspace or site-wide keyboard
  commands.
- Responsive SVG, concise numeric/state readout, collapsed technical details
  and independent two-dimensional keyboard exploration.
- No backend, tracking, cookies, accounts, external fonts, samples or runtime service.

## Run locally

Node 24 is recorded in `.nvmrc`.

```sh
nvm use
npm ci
npm run dev
```

Build and preview the production site:

```sh
npm run build
npm run preview
```

Vite uses `base: "./"`, so production scripts and styles resolve relative to the HTML document on a repository Pages path or a future custom domain.

## Coordinate formats

At least two and at most 20,000 finite points are required. Local files are limited to 1 MB. Input order is always preserved.

CSV may include an `x,y` header:

```csv
x,y
-1,0
0,1
1,0
```

CSV without a header, JSON pairs and JSON objects are also accepted:

```json
[
  [0, 0],
  [1, 1]
]
```

```json
[
  { "x": 0, "y": 0 },
  { "x": 1, "y": 1 }
]
```

Malformed values are rejected rather than reinterpreted. `NaN`, infinity, missing fields and wrong item shapes are errors. See [triangle.csv](examples/triangle.csv) and [double-back.json](examples/double-back.json).

## Sound modes and mapping

Spatial voice maps X continuously across a default stereo width of 0.75 and
maps Y to pitch. An optional smooth timbre blend reinforces negative, zero and
positive Y without replacing the numeric readout.

Axis voices maps each dimension to its own pitch, timbre and gain. X defaults
to MIDI 48–60 at −0.65 pan; Y defaults to MIDI 67–79 at +0.65 pan. Touching or
overlapping custom registers produce a warning and a one-step restore action.
Mono-compatible output selects centred Axis voices so X is not lost when stereo
channels are combined.

Each axis has its own data domain. Automatic mode uses that axis’s minimum and
maximum in the current curve. Manual mode accepts an explicit domain.
Shared-domain mode takes the union of the two active domains so equal numeric
values map consistently.

For a signed value:

```text
u = clamp((value - minimum) / (maximum - minimum), 0, 1)
midi = lowNote + u * (highNote - lowNote)
frequency = 440 * 2^((midi - 69) / 12)
```

Fractional MIDI values make pitch continuous. Inversion replaces `u` with
`1 - u`. A constant axis uses `u = 0.5`, avoiding division by zero. “Value”
means the signed number, not its absolute magnitude. Volume controls listening
comfort only; volume is not a data channel.

Each axis can instead load a local `.mid` or `.midi` Standard MIDI File of up to 2 MB. TIMUDS extracts note-on pitches, removes duplicates and sorts the resulting palette from low to high. The normalised coordinate selects the nearest palette entry, so the mapping remains monotonic and inspectable. Timing, velocity, channel, program-change and effect instructions are not replayed. The instrument selector determines the generated sound.

## Traversal

Progress is normalised from 0 to 1 and never requires monotonic x.

- **Constant spatial speed (default):** cumulative polyline arc length determines the active segment and interpolation. Zero-length segments are safe. A closed curve includes the final-to-first segment.
- **Uniform segment progression:** every supplied segment receives equal time, more directly retaining sampling density as a timing influence.

Timed playback uses `AudioContext.currentTime`, a monotonic audio clock. `requestAnimationFrame` updates the visual marker but does not determine duration. A non-looping 20-second circle therefore completes one circuit in approximately 20 seconds independent of visual frame rate.

Hold stops traversal and sustains the current sound. Stop all sound cancels
scheduled voice and cue changes, fades to silence over 120 ms and retains
position. Progress ticks can be Off or sound every 25%, 12.5% or 10%. Direct
seeks are silent and delayed frames do not create catch-up storms.

## Keyboard controls

Page shortcuts default to **Workspace only** scope. They can be turned off or
deliberately changed to site-wide scope. Editable fields, native controls, open
dialogs, IME composition, handled events and browser/assistive-technology
modifiers keep their keys.

| Key                  | Action                           |
| -------------------- | -------------------------------- |
| Space                | Play or hold                     |
| S                    | Stop all sound                   |
| R                    | Stop and return to the start     |
| Left / Right         | Move 1%                          |
| Shift + Left / Right | Move 10%                         |
| Home                 | Move to the start                |
| End                  | Move to the end of an open curve |
| Escape               | Emergency fade outside controls  |
| ?                    | Open Keyboard help               |

Alt can optionally be required for S, R and ?. The Help dialog shows the full
map and current scope, contains a Stop control and restores focus when closed.
Every command also has a visible native control.

The two-dimensional explorer has one focused controller:

| Key             | Action                              |
| --------------- | ----------------------------------- |
| Left / Right    | Decrease / increase numeric x       |
| Up / Down       | Increase / decrease numeric y       |
| Shift + Arrow   | Use the configured coarse step      |
| Escape          | Return to the saved curve position  |
| Tab / Shift+Tab | Leave the controller without a trap |

Native x and y ranges and number inputs provide the same operation. WASD is
optional, off by default and active only on the focused controller.

## Audio design and safety

The graph is created only after Play, Hear current position or a calibration
action. Each long-lived voice has carrier, secondary and modulation
oscillators. A shared noise source supplies separately filtered instrument
texture and progress cues. Filters, gains and panners feed one conservative
master and compressor. The same graph serves both sound modes. Pitch, pan,
filter and instrument changes use short smoothing constants.

All exits share one Stop method: visible Stop controls, S, Escape, Reset, curve
or mode changes, page hiding, previews and explorer exits cancel future
automation and ramp the master gain to zero. No sound starts automatically.

Changing tabs while sound is active stops traversal and fades audio. Audio resources are closed on application teardown. If Web Audio is unsupported, curve creation and numeric/visual inspection remain usable.

No automated test can establish perceptual clarity or listening safety for every person and device. Start quietly and use the manual listening checklist in [docs/accessibility.md](docs/accessibility.md).

## Accessibility approach

TIMUDS targets applicable WCAG 2.2 Level A and AA criteria. This is a target,
not a conformance claim. Current work includes native controls, a complete text
readout, point editing without dragging, focus-scoped plane exploration,
coalesced announcements, reflow, visible focus and deliberate audio.

Read the [audio-mode design](docs/audio-modes.md), [keyboard
controls](docs/keyboard-controls.md), [accessibility
approach](docs/accessibility.md), [implementation
decisions](docs/implementation-decisions.md) and [manual listening
protocol](docs/manual-listening-test.md). Manual screen-reader, hardware and
device results remain unrecorded.

## Privacy and browser requirements

All coordinate and MIDI parsing, drawing, synthesis and export happen locally. Imported data never leaves the browser. MIDI upload does not request access to a connected MIDI device. The production application makes no requests after its static assets load and contains no analytics, telemetry, cookies, accounts, remote media or third-party runtime code.

A current desktop or mobile browser with SVG and ES2022 support is required. Sonification additionally needs the Web Audio API and an output route. Browsers may impose their own audio permission and background-suspension rules.

## Quality commands

```sh
npm run format          # write Prettier formatting
npm run format:check    # verify formatting
npm run lint            # ESLint, including typed TypeScript rules
npm run typecheck       # strict project type check
npm run test:unit       # Vitest unit and component tests
npm run test:e2e        # Playwright Chromium flows and axe checks
npm run build           # strict type check plus Vite production build
npm run validate        # complete local quality gate above
```

Install the Playwright browser once if it is not already available:

```sh
npx playwright install chromium
```

Automated axe checks cover representative default, active and validation-error states. They cannot certify WCAG conformance or replace keyboard, screen-reader, zoom, contrast and listening reviews.

## Architecture

The key boundary is between pure data/audio calculations and React presentation:

- `src/core/` — coordinate types, bounded parsing, deterministic presets, geometry, interpolation, pitch and transport transitions.
- `src/audio/AudioEngine.ts` — the sole Web Audio owner and persistent audio graph.
- `src/components/` — SVG plot and iterable per-axis mapping controls.
- `src/App.tsx` — product state, clock orchestration, imports and accessible interaction.
- `src/**/*.test.*` — unit and component coverage; `e2e/` — browser flows.

The audio update loop works with refs and the engine directly. React-visible state is published at a lower frequency so the full workspace does not need to render on every animation frame. Details and extension points are in [docs/architecture.md](docs/architecture.md).

## GitHub Pages

The Pages workflow validates, builds and uploads `dist`; a separate least-privilege deployment job publishes the artifact. It does not maintain a `gh-pages` branch.

After pushing to GitHub, enable exactly this repository setting:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Pushes to `main` then run validation and deployment. The workflow can also be started manually with `workflow_dispatch`.

## Known limitations and future directions

- Two dimensions only; arbitrary SoundFonts, uploaded audio samples,
  head-tracking and custom key remapping remain out of scope.
- MIDI import creates a sorted pitch palette; it is not a MIDI sequencer, sampler or sound-font player and does not reproduce the file’s timing or instrument commands.
- Basic comma-separated numeric data is supported, not quoted fields, locale decimal commas or arbitrary CSV dialects.
- Freehand input uses deterministic distance filtering and arc-length resampling; it is an authoring convenience, not a digitisation measurement.
- The app does not import its exported full configuration yet; coordinate arrays can be re-imported separately.
- Synthetic output differs across browser/OS/device audio pipelines. No automated test judges timbre separability, distortion or loudness.
- Screen-reader/browser combinations, high-contrast implementations, 400% zoom
  and audio/speech coexistence still need manual review.

Before using TIMUDS in research, define and validate a protocol, retain exported settings, calibrate output equipment and independently establish that the mapping is appropriate for the intended question.
