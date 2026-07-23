# Implementation decisions

## Two modes, not one compromise

Spatial voice was added because two sustained pitches can be tiring and can
mask one another. It gives X and Y different acoustic jobs: X controls pan and Y
controls pitch. Axis voices remains available because it works without a
stereo-dependent data channel and lets listeners compare two explicit voices.

Axis voices no longer makes one dimension low and dark while the other is high
and bright. That approach made X easy to lose on small speakers. Both defaults
now use the same centred MIDI 60–72 register and matched listening gains. Warm
organ identifies X and Clarinet-like reed identifies Y, backed by labels and
numeric readouts. A warning appears only when the same instrument is used
across overlapping ranges; its repair changes the instruments, not the data
mapping.

The positive/negative Y timbre cue is optional. Its equal-power crossfade avoids
a hard discontinuity at zero, while the numeric sign remains the authoritative
non-audio equivalent.

The value-mapping selector uses one native dropdown because the choices are
mutually exclusive and the list can grow without turning the panel into a bank
of toggles. Pitch stays the default. Non-pitch choices hold a stable midpoint
pitch so one coordinate does not alter several auditory properties at once.
Volume retains a 10% floor, and pulse modulation retains a 20% trough, so an
axis does not vanish solely because it reaches its minimum. Mute remains the
explicit zero-output control.

## Orientation and safety

Progress ticks are configurable because a useful orientation rate depends on
curve duration and listener. Threshold detection is pure and direct seeks are
silent, avoiding tick storms after large jumps or suspended tabs.

All stop routes share one cancellation and fade method. Escape remains an
emergency Stop outside controls and dialogs. A prominent Stop button remains
visible whenever audio may have been enabled.

Spatial voice is not silently collapsed to mono: mono-compatible output selects
centred Axis voices so X still has an audible representation.

## A shorter working surface

The title illustration and decorative heading diamonds were removed because
they occupied the first screen without helping operate or interpret the
instrument. Equal visual scaling remains enabled internally, rather than being
a primary choice that can visually distort comparisons.

The plot, coordinates, progress, mode and state remain near the compact
transport. Notes, frequencies, domains and engine state moved into Technical
details. Curve, Sound, Advanced and Accessibility controls use native
disclosures. Visible controls remain alongside shortcuts so operation never
depends on memorising keys.

Site-wide shortcuts are user-controlled and persisted; workspace scope is the
default. A single pure resolver owns guards and command mapping, preventing
component-specific global listeners.

## Local synthesis

Synthetic timbres keep the graph small, persistent, offline and inspectable.
Each profile combines a harmonic spectrum with pitch-tracked filtering,
articulation and optional vibrato, secondary voices, inharmonic modulation or
filtered noise. Struck profiles use distinct decay and pitch behaviour. The
catalogue favours categorical separation over realistic imitation, so several
profiles intentionally exaggerate noise, sub-octaves, pitch sweeps or
modulation.

Full SoundFont support would add a large parsing, sampling and licensing
surface, so it remains out of scope. Local MIDI files supply optional pitch
palettes, not timing or instruments. A user may instead provide one bounded
local audio clip per axis. The browser decodes that clip in memory and the
engine loops and transposes it; TIMUDS does not parse SoundFonts, retain the
bytes or ship sample content. The built-in audition phrases are small original
note-event fixtures. This avoids bundling third-party MIDI or audio files whose
reuse could require attribution and ShareAlike terms in a repository that does
not yet have an owner-selected licence.
