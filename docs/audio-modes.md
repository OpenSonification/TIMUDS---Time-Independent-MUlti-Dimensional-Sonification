# Audio modes

TIMUDS has two deliberately different ways to hear the same ordered
two-dimensional curve. Neither mode changes point order or treats x as time.

## Spatial voice

Spatial voice is the default. It uses one perceived voice:

- x maps continuously from left to right within the selected stereo width;
- y maps to pitch using the Y-axis domain and pitch range;
- the default stereo width is 0.75, leaving some margin at both extremes;
- an optional equal-power timbre blend makes negative y more hollow and
  positive y brighter, with a small smooth region around zero.

The sign cue is not a third data mapping. It reinforces the sign already shown
in the numeric Y readout. Turning it off uses the selected synthetic timbre.
Constant X is centred and constant Y uses the midpoint pitch, so neither case
divides by zero.

## Axis voices

Axis voices keeps separate X and Y sounds. X starts at MIDI 48–60 with a warm
timbre and a pan position of −0.65. Y starts at MIDI 67–79 with a reed timbre
and a pan position of +0.65. Register, timbre, visible labels and numeric
readouts all identify the dimensions; stereo is never the only distinction.

When custom pitch ranges touch or overlap, TIMUDS displays a warning and a
button that restores the separated defaults. Optional local MIDI note maps may
replace either continuous range.

## Mono output

Mono-compatible output selects Axis voices and centres both voices. TIMUDS does
not retain Spatial voice in mono because doing so would discard X's
left-to-right mapping. The separated registers and timbres keep both dimensions
available on a single channel.

Use headphones only at a comfortable level. Also check laptop speakers and
mono output before relying on a mapping. No automatic test establishes
perceptual clarity; use [the manual listening protocol](manual-listening-test.md).

## Progress tick

The optional tick can sound every 25%, 12.5% or 10%; 12.5% is the default.
Crossings are calculated from the previous and next normalised progress values,
including loop boundaries. Direct seeks do not create ticks. A delayed
animation frame suppresses catch-up cues, and at most one cue is scheduled per
ordinary frame.

The tick uses a persistent, local filtered-noise path in the existing Web Audio
graph. It is brief, has its own bounded level, and is not sent to the screen
reader live region. Progress remains visible as a percentage and on the native
range control.

## Sound lifecycle

The audio graph is created only after a user action. Two persistent oscillators
serve either the two Axis voices or the negative/positive components of the
Spatial timbre blend. Pitch, pan and timbre gains use short smoothing constants.

Every stop route calls the same `AudioEngine.stopAllSound` method. It cancels
pending automation for voices and cues, then ramps the master gain to silence
over 120 ms. Stop buttons, S, Escape, Reset, curve and mode changes, visibility
handling, previews and explorer exits share that path.
