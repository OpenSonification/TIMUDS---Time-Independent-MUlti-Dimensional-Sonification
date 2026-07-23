# Manual listening test

Status: **Not run**. This is a structured protocol, not a record of perceptual
validation. Record date, browser, OS, output device, listener and observations
when each trial is actually performed.

## Equipment matrix

| Condition                   | Status  | Notes |
| --------------------------- | ------- | ----- |
| Stereo headphones           | Not run |       |
| Laptop speakers             | Not run |       |
| External stereo speakers    | Not run |       |
| Mono output                 | Not run |       |
| Left channel only           | Not run |       |
| Right channel only          | Not run |       |
| Low volume                  | Not run |       |
| Screen-reader speech active | Not run |       |

Begin at low output and master levels. Stop immediately if the sound is
uncomfortable.

## Curves

Use Circle, Diagonal line (`y = x`), Anti-diagonal line (`y = -x`), Triangle,
Spiral, Mirrored pair, Y-zero crossings, Constant X and Constant Y. Also check
duplicate consecutive points and a closed final-to-first segment using imported
coordinates.

## Spatial voice

For each output condition, record:

- whether left-to-right X movement is clear;
- whether Y pitch remains clear at the pan extremes;
- whether it is more comfortable than two simultaneous voices;
- whether movement is disorientating;
- whether width 0.75 is comfortable;
- whether mirrored coordinate pairs remain distinguishable;
- whether the Y-sign timbre helps or overloads the sound.

## Axis voices

Record whether X and Y are immediately distinguishable, whether register
separation is sufficient, whether pan helps, whether loudness feels balanced,
whether one voice masks the other, and whether mirrored coordinates remain
distinguishable. Repeat with mono-compatible output.

## Instrument separation

Use **Test sound** at one unchanged coordinate and compare every instrument at
the same master level. Start with the default 2-second test length, then repeat
the drum and mallet at 0.5 and 5 seconds. Confirm that:

- Pure sine tone stays neutral and steady;
- Warm organ is rounder than Bright synthesiser;
- Clarinet-like reed sounds narrower and woodier than Flute-like;
- Trumpet-like brass attacks faster than Bowed-string-like;
- Mallet-like rings longer than Pitched drum;
- Pitched drum has a clear downward bend;
- Drum remains audible across the chosen test and stops at its end.
- Deep sub pulse is unmistakably lower and heavier than Warm organ;
- Arcade square wave has a hard electronic edge;
- Air-jet whistle is dominated by breath noise;
- Alarm siren has an obvious pitch sweep;
- Robot FM growl has coarse metallic modulation;
- Sharp plucked string has an immediate transient and fast decay.

Then change instruments in an unpredictable order without looking at the
selector. Check that the sound family can be identified before reading its
name. Treat any repeated confusion between a pair as a defect, even if their
spectra are technically different.

Repeat on headphones, laptop speakers and mono output. Record any pair that is
hard to distinguish, any large loudness jump and any uncomfortable resonance.
Confirm that changing test length does not alter timed curve playback.

Repeat the blind comparison with Held note, Bebop-style run, Boogie bass
pattern, Son-clave pulse and 3:2 hemiola. Confirm every pattern stops at the
chosen duration, rests are audible as rests, and repeated notes re-trigger drum,
mallet and pluck attacks. Record whether any phrase makes two instruments harder
to tell apart.

## Uploaded sounds

Use short, known MP3 and WAV clips for X and Y. Include mono and stereo files,
a quiet file, and one unsupported or damaged file. Confirm that:

- choosing a valid clip enables audio but remains silent;
- the filename, decoded duration and original sample note are readable;
- X and Y use their own clips and remain independently audible;
- Pitch mapping transposes each clip in the expected direction, and changing
  the original sample note corrects the reference pitch;
- Volume, Tone brightness and Pulse rate retain their documented behaviour;
- playback loops without a large click on the test files;
- Stop all sound ends both samples promptly;
- removing a sample restores the selected built-in instrument;
- damaged, empty, oversized, overlong and browser-unsupported files produce an
  associated error without replacing the previous sample;
- reloading the page does not restore the clip or its filename.

Repeat on each supported browser. Codec support and loop seams cannot be
established by mocked automated audio tests.

## Progress cues

Compare 12.5% and 10%. Record whether the tick is audible but unobtrusive,
whether completion is clear, and whether ticks distract during a 20-second
traversal. Directly seek across several thresholds and return from a background
tab; confirm there is no catch-up storm. Record whether the default should
remain 12.5% or become Off.

## Value mappings

At low master volume, test Pitch, Volume, Tone brightness and Pulse rate on
Circle, Diagonal line, Constant X and Constant Y. In Axis voices, confirm X and
Y change independently. In Spatial voice, confirm X retains left-to-right
position while Y uses the selected mapping. Check that:

- Volume remains faintly audible at the minimum and reaches the selected
  listening gain at the maximum;
- Tone brightness is clearly darker at the minimum without becoming inaudible;
- Pulse rate moves smoothly from a slow pulse to a rapid flutter and never
  depends on visual frame rate;
- non-pitch mappings hold one stable note;
- inversion reverses only the selected sound property;
- switching mappings does not cause an unsafe loudness jump.

## Screen-reader coexistence

With speech active, record whether sustained audio masks speech, whether status
messages are too verbose, whether Stop is easy to find, whether site-wide
arrows interfere with reading commands, whether workspace scope is easier, and
whether mono-compatible mode is understandable.

Leave Voice over checked. Test Circle, Triangle, Constant X and Constant Y
forwards, backwards and with looping. Confirm extrema are spoken in English
when crossed, coincident extrema produce one phrase, loop seams do not create a
queue, and speech remains understandable over the selected instrument. Confirm
Hold, Stop all sound, Reset and unticking Voice over cancel queued speech.

Automated unit, axe and browser tests may verify scheduling and operation, but
they do not complete this protocol.

## Axis balance

Select Axis voices and leave X as Warm organ and Y as Clarinet-like reed. Use
Test X, Test Y, Hear low, Hear middle and Hear high at the default listening
gain. Repeat with laptop speakers, ordinary headphones and mono-compatible
output.

Both axes should remain easy to hear throughout MIDI 60–72. Neither should
sound like a foreground voice while the other feels incidental. The
instruments should identify X and Y even when both coordinates produce the same
note. Record the device, comfortable master volume and any point at which one
voice masks the other; this remains a perceptual manual check.
