# Architecture

## Data flow

`CurveData` contains a name, source, ordered `Point[]` and default closure. The view has a separate closure setting so a source can be auditioned open or closed without mutating points. Loading a source records an immutable-by-convention reset snapshot. Reverse traversal transforms normalised progress (`1 - p`); it does not reverse or sort the source array.

`src/core/parser.ts` accepts a selected or detected CSV/JSON format. It rejects empty input, malformed rows/items, non-finite numbers, fewer than two points and more than 20,000 points. File reading separately enforces 1 MB and known extensions before text parsing.

`src/core/midi.ts` reads Standard MIDI File bytes without Web MIDI or a runtime dependency. It validates `MThd`/`MTrk` structure, bounded variable-length values, track boundaries, running status and channel-event sizes. It accepts at most 2 MB, 64 tracks and 50,000 note-on events. The result contains only a sanitised filename and sorted unique note numbers; timing, velocity, programs, effects and the original bytes are discarded.

`src/core/audioFile.ts` performs the presentation-independent extension, empty
file and 10 MB checks for local audio clips. `AudioEngine` alone passes the
bytes to `AudioContext.decodeAudioData`, rejects decoded durations outside
0.05–30 seconds and owns the resulting in-memory buffers. React state retains
only the filename, duration, reference MIDI note and an opaque buffer key.

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

Pitch functions normalise, clamp, optionally invert and convert MIDI to hertz. Without a note map they interpolate fractional MIDI. With an imported MIDI palette they select the nearest sorted note, producing a monotonic, quantised mapping. Equal domain bounds explicitly return the midpoint. Note names are the nearest named semitone; displayed frequency retains a continuous fractional MIDI value only in continuous mode.

`sonification.ts` owns X-to-pan mapping, Spatial and Axis mode point mapping,
bounded volume/brightness/pulse mappings, range-overlap detection and the
equal-power Y-sign blend. Non-pitch mappings select the midpoint pitch first,
then return a separate frame parameter. `instruments.ts` is the pure catalogue
for sixteen synthetic choices. Each definition supplies a visible label and
description plus harmonics, carrier level, pitch-tracked filter, articulation,
vibrato and level-compensation parameters.

`auditionPatterns.ts` holds the original note/rest patterns and scales them to a
bounded 0.5–5 second preview. `curveBenchmarks.ts` derives the first
traversal-order visit to each axis extremum. Its calculation follows closure,
direction and the selected parameterisation without changing source-point
order.

## Timing and transport

The explicit states are `ready`, `playing`, `holding`, `stopped`, `unavailable`
and `error`. A pure transition function covers user and completion events.
Position remains separate from whether sound is active.

When Play begins, the app captures starting progress and `AudioEngine.currentTime`. Each animation callback derives:

```text
progress = startProgress + (currentAudioTime - startAudioTime) / duration
```

Looping applies modulo one. A non-looping result clamps at one and enters holding so the final coordinate remains audible. The animation loop pushes each interpolated point directly to the SVG marker ref and each frequency pair directly to the audio engine. React-visible progress/readouts publish at about 10 Hz. Audio duration therefore does not depend on React or frame count.

The same loop compares each old/new progress pair with the pure benchmark
table. A crossed benchmark produces one discrete text status and, when Voice
over is checked, one English browser-speech utterance. Loop wrapping is
explicit; coincident extrema are grouped. The app never sends ordinary frame
updates to either speech path.

Manual movement writes normalised progress directly. Once audio has been deliberately enabled, a manual move sustains its new coordinate and enters holding. Before activation, it remains silent.

`keyboardNavigation.ts` keeps plane-domain expansion, derived step sizes,
arrow/WASD mapping, clamping, boundary detection and nearest-source-point
selection pure. `shortcuts.ts` is the central page-command resolver: it owns
scope, modifier, repeat, editable-control, dialog and composition guards.
When shortcuts are enabled, Stop is the sole page-wide scope exception and
remains blocked in editable/input widgets. Visible controls remain available
for every page command.

Plane exploration stores the curve traversal progress before it starts. Its coordinate is separate from `CurveData`, so movement cannot mutate the curve. The user can explicitly copy the coordinate into the point list or move the saved traversal progress to the nearest source point.

## Audio graph

One `AudioEngine` owns the lifecycle:

```text
X modulation oscillator → modulation depth → X carrier detune
X pulse oscillator → pulse depth → X voice gain
X secondary oscillator → layer gain ┐
X carrier oscillator → carrier gain ┴→ X filter ┐
X uploaded sample → sample gain ─────────────────┤
noise source → X texture filter → texture gain ┴→ X articulation → X gain → X panner ┐
                                                                                     ├→ master → compressor → destination
noise source → Y texture filter → texture gain ┬→ Y articulation → Y gain → Y panner ┘
Y uploaded sample → sample gain ─────────────────┤
Y carrier oscillator → carrier gain ┬→ Y filter ┘
Y secondary oscillator → layer gain ┘
Y modulation oscillator → modulation depth → Y carrier detune
Y pulse oscillator → pulse depth → Y voice gain
noise source → high-pass filter → cue gain ──────────────────────────────────────────┘
```

The context and graph are created only from deliberate audio handlers,
including choosing a local sample for decoding. Sample selection remains
silent. Oscillator and noise sources remain alive until teardown. Uploaded
clips use replaceable looped buffer sources because Web Audio buffer sources
cannot be restarted. In Axis mode the two paths are independent voices. In
Spatial mode they share Y pitch and X pan and can crossfade hollow/bright sign
timbres. `PeriodicWave` harmonics and filter tracking make the synthetic
instrument families. Optional octave, detuned, inharmonic and filtered-noise
layers provide larger categorical differences; attack, decay and vibrato
separate behaviour over time. Pure tone uses sine. Frequency, sample playback
rate, filter, modulation, layer, texture, voice gain, panning and master gain
use bounded smoothing. Brightness multiplies the instrument's calculated
filter frequency within 80–12,000 Hz. Pulse mapping modulates the voice gain
from 20% to 100% of its selected level using a persistent audio-rate node, so
its timing does not depend on React or animation frames.

Test patterns are scheduled by the application after a deliberate calibration
action. Each note reuses `updateMapping`; each rest calls a short
`releaseTestSound` fade. Stop and all normal cancellation routes clear the
pending timers.

`progressCues.ts` detects threshold crossings without audio or UI state. Direct
seeks are silent, loop wraps are explicit and call sites cap scheduling after
delayed frames.

`stopAllSound` marks the engine silent, cancels future carrier, secondary,
modulation, texture, filter, articulation, voice-gain, pan and cue automation,
then linearly ramps the master to zero over 120 ms. Every application Stop route
reaches this method.
Application teardown additionally stops/disconnects sources and closes the
context. An unavailable constructor leaves all non-audio paths operational.

## Presentation and accessibility

The SVG exposes a short title/description, not thousands of points. It combines curve line, square start and outlined current marker, labelled mathematical axes and a written direction caption. Exact curve and live mapping data sit outside the SVG in semantic definition lists. Pointer drawing is an enhancement.

`SourcePointEditor` provides a paginated native table and ordinary form controls for add, update, duplicate, delete and reorder operations. `TwoDimensionalExplorer` supplies one narrowly scoped focusable controller plus native x/y alternatives. Neither component owns audio nodes.

Important discrete events update one polite live region. Coordinates are never
announced on animation frames. Explorer movement replaces a pending
announcement after a short idle period. Timed position announcements require
explicit opt-in. Landmark Voice over also starts unchecked; once selected it
speaks only after Play and is cancelled by every sound-stop route. A static
benchmark list provides the same names and coordinates. Native elements supply
range, number, selection, disclosure, file, table and button semantics.

`preferences.ts` validates a versioned, bounded subset of sound and keyboard
settings before reading or writing local storage. Playback, audio-enabled
state, curve position, MIDI maps and uploaded audio metadata or bytes are never
persisted.

## Extension points

- Add axis keys/configuration and generalise `Point` to a keyed coordinate record before adding more voices. Keep the current two-dimensional interface until an interaction model is validated.
- Add alternative mapping functions behind a typed strategy without coupling them to `AudioEngine`.
- Extend MIDI mapping only through pure, bounded strategies; do not turn file input into device access or retain source bytes.
- Extend sample playback inside `AudioEngine`; keep decoded buffers out of
  React and persistent storage.
- Replace the geometry linear lookup with binary search if profiling demonstrates a need.
- Add import for the exported schema only with version validation and safe merging.
