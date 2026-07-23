# Architecture

## Data flow

`CurveData` contains a name, source, ordered `Point[]` and default closure. The view has a separate closure setting so a source can be auditioned open or closed without mutating points. Loading a source records an immutable-by-convention reset snapshot. Reverse traversal transforms normalised progress (`1 - p`); it does not reverse or sort the source array.

`src/core/parser.ts` accepts a selected or detected CSV/JSON format. It rejects empty input, malformed rows/items, non-finite numbers, fewer than two points and more than 20,000 points. File reading separately enforces 1 MB and known extensions before text parsing.

Preset functions are deterministic and omit a duplicated endpoint on closed curves. Closure is owned by geometry so the return segment appears exactly once.

## Geometry and interpolation

`buildCurveGeometry(points, closed)` performs one linear pass and records each segment’s length and cumulative boundaries. Duplicate consecutive points remain represented but contribute zero distance. A closed table adds `last → first`.

Normalised progress is interpreted in one of two ways:

1. **Arc length:** multiply progress by total length, find the containing cumulative segment and interpolate locally. A zero total returns the first point.
2. **Uniform segment:** multiply progress by segment count, select the segment and interpolate its local fraction. Every supplied segment receives equal time, including a zero-length segment.

The current implementation performs a linear segment lookup. With the 20,000-point input bound this is predictable, while avoiding more complex indexing in the proof of principle. A binary search is a compatible future optimisation.

Freehand input is converted from SVG space to mathematical coordinates (positive y upwards), clamped to the visible `[-1, 1]` domain, distance-filtered and, when necessary, resampled to at most 300 points using the same arc-length interpolation. Imported points are never silently resampled.

## Mapping

Axis configuration is an array of `AxisConfig`, keyed by `x | y`. Presentation iterates this structure. Domains are calculated independently, optionally replaced by manual domains, then optionally combined by union. Reversed manual bounds are safely ordered before mapping.

Pitch functions normalise, clamp, optionally invert, interpolate fractional MIDI and convert MIDI to hertz. Equal domain bounds explicitly return the midpoint. Note names are the nearest named semitone; displayed frequency retains the continuous fractional MIDI value.

## Timing and transport

The explicit states are `silent`, `playing`, `holding`, `stopped`, `unavailable` and `error`. A pure transition function covers user and completion events. Position remains separate from whether sound is active.

When Play begins, the app captures starting progress and `AudioEngine.currentTime`. Each animation callback derives:

```text
progress = startProgress + (currentAudioTime - startAudioTime) / duration
```

Looping applies modulo one. A non-looping result clamps at one and enters holding so the final coordinate remains audible. The animation loop pushes each interpolated point directly to the SVG marker ref and each frequency pair directly to the audio engine. React-visible progress/readouts publish at about 10 Hz. Audio duration therefore does not depend on React or frame count.

Manual movement writes normalised progress directly. Once audio has been deliberately enabled, a manual move sustains its new coordinate and enters holding. Before activation, it remains silent.

`keyboardNavigation.ts` keeps plane-domain expansion, derived step sizes, arrow/WASD mapping, clamping, boundary detection and nearest-source-point selection pure. Buttons, native inputs and the focused plane controller call the same application commands. No document-wide directional handler exists.

Plane exploration stores the curve traversal progress before it starts. Its coordinate is separate from `CurveData`, so movement cannot mutate the curve. The user can explicitly copy the coordinate into the point list or move the saved traversal progress to the nearest source point.

## Audio graph

One `AudioEngine` owns the lifecycle:

```text
X oscillator → X filter → X voice gain → X panner ┐
                                                   ├→ master gain → compressor → destination
Y oscillator → Y filter → Y voice gain → Y panner ┘
```

The context and graph are created only from deliberate Play/calibration handlers. Oscillators then remain alive until teardown. `PeriodicWave` harmonics and filter settings make the warm, reed and bright timbres; pure tone uses sine. Frequency, voice gain, panning and master gain use `setTargetAtTime`. Solo is resolved across the iterable axis array. The low master default plus per-axis headroom and compressor reduces clipping risk; it does not replace listening-level judgement.

Stop changes the master target to zero rather than disconnecting live nodes. Page hiding stops traversal and fades audio. Application teardown stops/disconnects oscillators and closes the context. An unavailable constructor leaves all non-audio paths operational.

## Presentation and accessibility

The SVG exposes a short title/description, not thousands of points. It combines curve line, square start and outlined current marker, labelled mathematical axes and a written direction caption. Exact curve and live mapping data sit outside the SVG in semantic definition lists. Pointer drawing is an enhancement.

`SourcePointEditor` provides a paginated native table and ordinary form controls for add, update, duplicate, delete and reorder operations. `TwoDimensionalExplorer` supplies one narrowly scoped focusable controller plus native x/y alternatives. Neither component owns audio nodes.

Important discrete events update one polite live region. Coordinates are never announced on animation frames. Explorer movement replaces a pending announcement after a short idle period. Timed announcements require an explicit interval. Native elements supply range, number, selection, disclosure, file, table and button semantics.

## Extension points

- Add axis keys/configuration and generalise `Point` to a keyed coordinate record before adding more voices. Keep the current two-dimensional interface until an interaction model is validated.
- Add alternative mapping functions behind a typed strategy without coupling them to `AudioEngine`.
- Add quantised scales by returning a mapped frequency from a new pure mapper.
- Replace the geometry linear lookup with binary search if profiling demonstrates a need.
- Add import for the exported schema only with version validation and safe merging.
