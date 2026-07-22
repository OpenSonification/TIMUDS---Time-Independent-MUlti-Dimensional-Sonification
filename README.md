# TIMUDS

**Time-Independent Multidimensional Sonification** — hear position, not just progression.

TIMUDS is a client-side proof of principle for sonifying an ordered two-dimensional curve. Conventional sonification often consumes x as time and maps only y to sound. TIMUDS keeps x and y as independent data dimensions: one sustained synthetic voice carries x position and a distinguishable second voice carries y position. Time controls only how the application travels through the supplied point order.

The default circle demonstrates why this matters. Its x coordinate repeatedly rises and falls, yet a complete circuit remains representable because no coordinate is sorted or treated as the clock.

> TIMUDS is exploratory research software. It has not been validated as assistive technology, a perceptual measurement, or scientific instrumentation. Do not use it for safety-critical interpretation.

## Current scope

- Five deterministic sources: circle, triangle, diagonal line, Lissajous curve and spiral.
- Local CSV/JSON paste and file import with bounded input and useful validation.
- Optional pointer, pen and touch freehand drawing in a visible `[-1, 1]` domain.
- Open/closed curves, reverse traversal, reset, summaries and reproducible JSON download.
- Constant-spatial-speed and uniform-segment traversal; timed, looped and manual control.
- Two simultaneous Web Audio voices with four locally generated timbres.
- Independent automatic/manual domains, shared domain, pitch inversion, gains, mute, solo and optional panning.
- Responsive SVG, persistent numeric/pitch readout, keyboard controls and accessible alternatives.
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

## Value-to-pitch mapping

Each axis has its own data domain. Automatic mode uses that axis’s minimum and maximum in the current curve. Manual mode accepts an explicit domain. Shared-domain mode takes the union of the two active domains so equal numeric values map consistently.

For a signed value:

```text
u = clamp((value - minimum) / (maximum - minimum), 0, 1)
midi = lowNote + u * (highNote - lowNote)
frequency = 440 * 2^((midi - 69) / 12)
```

The default range is MIDI 48–72 (C3–C5). Fractional MIDI values make pitch continuous. Inversion replaces `u` with `1 - u`. A constant axis uses `u = 0.5`, avoiding division by zero. “Value” means the signed number, not its absolute magnitude. Volume controls listening comfort only; volume is not a data channel.

## Traversal

Progress is normalised from 0 to 1 and never requires monotonic x.

- **Constant spatial speed (default):** cumulative polyline arc length determines the active segment and interpolation. Zero-length segments are safe. A closed curve includes the final-to-first segment.
- **Uniform segment progression:** every supplied segment receives equal time, more directly retaining sampling density as a timing influence.

Timed playback uses `AudioContext.currentTime`, a monotonic audio clock. `requestAnimationFrame` updates the visual marker but does not determine duration. A non-looping 20-second circle therefore completes one circuit in approximately 20 seconds independent of visual frame rate.

Hold stops traversal and sustains the current x/y sounds. Stop sound fades to silence and retains position. Manual steps use 1% or 5% of curve progress rather than raw point indices.

## Keyboard controls

Shortcuts apply when focus is within the sonification workspace and not in an editable or native action control.

| Key                  | Action                   |
| -------------------- | ------------------------ |
| Space                | Play or hold             |
| Left / Right         | Move by 1%               |
| Shift + Left / Right | Move by 5%               |
| Home / End           | Move to beginning or end |
| Escape               | Fade and stop all sound  |

Every shortcut also has a visible native button or slider.

## Audio design and safety

The audio graph is created only after Play or calibration is activated. Two long-lived oscillators feed separate filters, voice gains and stereo panners, then a conservative master gain and dynamics compressor. Frequencies and gains use short smoothing constants to avoid discontinuities. X defaults to a warm organ-like synthetic periodic wave; Y defaults to a more resonant reed-like synthetic wave. Timbre, not stereo alone, separates axes, and “centre both voices” supports mono output.

Changing tabs while sound is active stops traversal and fades audio. Audio resources are closed on application teardown. If Web Audio is unsupported, curve creation and numeric/visual inspection remain usable.

No automated test can establish perceptual clarity or listening safety for every person and device. Start quietly and use the manual listening checklist in [docs/accessibility.md](docs/accessibility.md).

## Accessibility approach

TIMUDS is designed to target WCAG 2.2 Level AA; this is a target, not a conformance claim. It uses landmarks, native controls, grouped fields, a skip link, visible focus, error focus management, polite discrete status messages, reflow, light/dark schemes, forced-colour support and reduced-motion handling. Rapid coordinates are not live-announced; optional quarter-progress announcements are off by default. The SVG has a concise accessible description, while adjacent text gives the complete useful state.

See [docs/accessibility.md](docs/accessibility.md) for checks, limitations and the manual audit checklist. Report a problem using the repository’s **Issues → New issue** page and add an `accessibility` label if available.

## Privacy and browser requirements

All parsing, drawing, synthesis and export happen locally. Imported data never leaves the browser. The production application makes no requests after its static assets load and contains no analytics, telemetry, cookies, accounts, remote media or third-party runtime code.

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

- Two dimensions and pitch mapping only; future work may add dimensions, spatial/haptic channels, quantised scales and alternative acoustic mappings.
- Basic comma-separated numeric data is supported, not quoted fields, locale decimal commas or arbitrary CSV dialects.
- Freehand input uses deterministic distance filtering and arc-length resampling; it is an authoring convenience, not a digitisation measurement.
- The app does not import its exported full configuration yet; coordinate arrays can be re-imported separately.
- Synthetic output differs across browser/OS/device audio pipelines. No automated test judges timbre separability, distortion or loudness.
- Screen-reader/browser combinations and high-contrast implementations vary and still need manual review.

Before using TIMUDS in research, define and validate a protocol, retain exported settings, calibrate output equipment and independently establish that the mapping is appropriate for the intended question.
