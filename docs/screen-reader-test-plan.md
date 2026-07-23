# Screen-reader test plan

Status date: 23 July 2026

No combination in this document has been run by a person yet. Every result is therefore **Not run — environment unavailable or manual verification required**. Do not change a result to passed without recording the tester, date, versions, input method and findings.

## Required combinations

| Screen reader and browser | Platform | Status                                          |
| ------------------------- | -------- | ----------------------------------------------- |
| NVDA with Firefox         | Windows  | Not run — Windows/NVDA environment unavailable  |
| NVDA with Chrome or Edge  | Windows  | Not run — Windows/NVDA environment unavailable  |
| VoiceOver with Safari     | macOS    | Not run — manual verification required          |
| VoiceOver with Safari     | iOS      | Not run — iOS device verification required      |
| TalkBack with Chrome      | Android  | Not run — Android device verification required  |
| JAWS with Chrome or Edge  | Windows  | Not run — licensed JAWS environment unavailable |
| Narrator with Edge        | Windows  | Not run — Windows environment unavailable       |

Record browser, operating-system and screen-reader versions. Record whether a hardware keyboard, touch gestures, braille display or speech input was used.

## Task script for every combination

Use the production build. Start with a fresh page and system output at a low level.

1. Read the document title. Expected meaning: “TIMUDS, Time-Independent Multidimensional Sonification”.
2. Read the initial context. Confirm the page explains that x and y produce simultaneous voices and that sound starts only after an action.
3. Navigate headings. Confirm one level-one heading and a logical sequence through Current curve, Current position, traversal, explorer, curve data, mapping and access.
4. Navigate landmarks. Confirm one main landmark plus concise banner, navigation and footer landmarks. Named regions must be distinguishable.
5. Use each skip link. Confirm focus reaches main, traversal and current position without disappearing.
6. Review names and descriptions for controls. Examples of expected semantics: “Enable audio, button”; “Position along curve, slider”; “X coordinate slider”; “Stop all sound, button”.
7. Select Triangle and activate Load preset. Confirm a discrete load message identifies the name, point count, x/y ranges and closure without starting audio.
8. Open coordinate import instructions. Submit `x,y`, `0,0`, `wrong,1`. Confirm the summary receives focus, identifies line 3 and links back to preserved input.
9. Correct the data to `0,0` and `1,1`; import it. Confirm focus remains predictable and playback does not begin.
10. Review the value-mapping dropdown. Confirm Pitch is selected initially and
    its four options are Pitch, Volume, Tone brightness and Pulse rate. Change
    each option and confirm the description and Current position values update
    without starting audio.
11. Review both axis fieldsets. Confirm instrument sound, gain, mute, solo and advanced mapping controls have visible matching names and descriptions. Confirm disabled manual domains have a nearby prerequisite.
12. Select different X and Y instruments and each Test pattern. Confirm the current-position definition list identifies both instruments and that changing a selection does not start audio.
13. Load a valid MIDI file into X. Confirm the status identifies the filename, distinct-note count, note-on event count, track count and pitch range. Review the palette, confirm the low/high range is disabled with an explanation, then remove the map.
14. Load a malformed `.mid` file into Y. Confirm its inline alert is associated with the Y file input, the existing X configuration is unaffected and no sound starts.
15. Load a short MP3 into X. Confirm the file input has instructions and the
    visible summary reports its filename, duration and original note. Confirm
    the instrument selector becomes unavailable with an explanation, audio is
    enabled but silent, and removing the sample restores that selector. Load an
    unsupported file into Y and confirm its inline alert is associated with the
    Y audio input.
16. Activate Enable audio if the sample test did not already enable it. Expected meaning: “Audio enabled. No sound is playing.”
17. Review the curve-landmark list and confirm Voice over is unchecked beside Play. Check it, then activate Play. Confirm the initial and subsequently crossed extrema are spoken in English and match the listed coordinates. Check for duplicate browser and screen-reader speech. Untick Voice over if necessary. Use Hold, Stop all sound and Reset traversal; confirm queued browser speech stops and each state remains available as static text.
18. Operate Position along curve with native range commands. Expected meaning at one quarter: “Position along curve, slider, 25 percent”, allowing product-specific phrasing.
19. Use Step backwards and Step forwards. Confirm the announcement follows the selected detail level and does not move focus.
20. Enter two-dimensional exploration. Expected meaning: “Keyboard exploration started. Arrow keys change x and y. The curve will not change. Press Escape to return.”
21. Use Left, Right, Up and Down on the controller. Confirm Up increases numeric y, including when the Y sound-mapping direction is inverted. Confirm Shift uses the coarse step.
22. Leave the controller with Tab and Shift+Tab. Confirm focus is not trapped, directional commands stop immediately and sustained preview sound fades.
23. Use the native x/y ranges and number inputs. Confirm they are a reliable fallback when browse or Quick Nav intercepts directional commands. Do not instruct the tester to turn off the screen reader.
24. Verify WASD is inert at first. Enable it, return focus to the controller and test W/A/S/D. Move to coordinate text and confirm characters type normally.
25. Review Current position. Confirm mode, transport, progress, time, coordinates, notes, frequencies, mapped sound values, domains, direction, closure, sounding state, instruments or uploaded samples, pitch sources and voice states are readable as a definition list.
26. Open Inspect and edit source points. Navigate table caption, headers and rows. Move to a point, edit x/y, add, reorder and delete. Confirm deletion restores focus to Point number.
27. Activate Add this coordinate to the curve. Confirm the change is explicit and announced.
28. Download the configuration. Confirm the browser reports a JSON download.
29. Test with Web Audio unavailable where the browser or harness permits it. Confirm authoring and all text/graphic inspection remain available.
30. Use the complete keyboard reference and terms disclosure. Confirm instructions are available before memorisation is required.
31. Explicitly exit the explorer by button and by Escape in separate runs. Confirm the saved traversal coordinate returns and focus is understandable.

## Expected spoken semantics

Exact punctuation, ordering and voice-engine phrasing may differ. Meaning must remain equivalent.

- “Enable audio, button”
- “Stop all sound, button, unavailable” before audio activation, with the visible prerequisite nearby
- “Position along curve, slider, 25 percent”
- “What the coordinate value changes, Pitch default, pop-up button” or the
  platform's equivalent native-select wording
- “X coordinate, 0.25”
- “Y coordinate, minus 0.5”
- “Keyboard exploration started. Arrow keys change x and y. The curve will not change.”
- “Maximum X boundary reached”
- “Point 3 updated. Traversal reset to the first point.”
- “Coordinate data needs attention, alert”
- “Line 3, x must be a finite number”
- “MIDI file for x-axis, file upload”
- “3 distinct notes from 3 note-on events in 1 track”
- “Audio sample for x-axis, file upload”
- “piano.mp3: decoded locally, 1.25 seconds”

## Announcement and repetition checks

1. Select Coordinates only. Press an explorer arrow quickly 20 times. Speech should settle on one recent coordinate after the short idle period rather than speaking 20 queued positions.
2. Hold a key long enough to trigger repeat. Movement should stay controllable. A boundary should be announced once until movement leaves that boundary.
3. Select Off. Confirm movement remains visible and available in Current position without coordinate speech.
4. Select Coordinates and sound values, then Full position details. Confirm
   each level adds the current pitches, volume percentages, brightness
   multipliers or pulse rates as appropriate.
5. Untick Voice over and start timed playback with timed announcements Off. Confirm no coordinate stream or browser landmark speech occurs.
6. Test 1-, 2-, 5- and 10-second playback intervals. Confirm older messages do not make controls unusable.
7. Leave timed announcements Off, check Voice over and play Circle forwards, backwards and looped. Confirm highest/lowest X and Y are discrete English phrases rather than frame updates. Repeat with Constant X and Constant Y.
8. Confirm routine statuses never move focus. Confirm only import failure uses the alert path.

## Screen reader and sonification together

Record findings separately for each listening mode.

| Check                                             | Sustained | Short preview | On demand |
| ------------------------------------------------- | --------- | ------------- | --------- |
| Do tones mask speech?                             | Not run   | Not run       | Not run   |
| Is the mode easy to understand?                   | Not run   | Not run       | Not run   |
| Are announcements too verbose?                    | Not run   | Not run       | Not run   |
| Is Stop all sound easy to find?                   | Not run   | Not run       | Not run   |
| Does focus remain understandable as tones change? | Not run   | Not run       | Not run   |
| Do repeated arrows create a speech queue?         | Not run   | Not run       | Not run   |
| Are boundary messages clear and non-repeating?    | Not run   | Not run       | Not run   |
| Are native x/y controls reliable?                 | Not run   | Not run       | Not run   |
| Can the listener identify the sounding axis?      | Not run   | Not run       | Not run   |
| Is centred/mono output understandable?            | Not run   | Not run       | Not run   |

Also record:

- whether X and Y instruments remain distinguishable with one speaker or earbud;
- whether sustained, mallet and pitched-drum choices remain comfortable and distinguishable;
- whether Test sound length announces a useful seconds value and gives enough
  time to identify the pitched drum at 0.5, 2 and 5 seconds;
- whether the five Test pattern names and descriptions are clear, and whether
  phrase rests leave enough space for speech;
- whether benchmark names, grouped extrema and constant-axis messages are
  understandable in forward, reverse and looped playback;
- whether MIDI palette and error messages are understandable without hearing the notes;
- whether mute, solo and text state make axis identity clear;
- whether blur and Escape fades avoid clicks;
- whether the explorer's selected preview duration leaves enough time to
  perceive coordinate changes;
- whether speech remains understandable at the default master level.

## Mobile touch scripts

For iOS VoiceOver and Android TalkBack:

1. Use heading, landmark and control navigation without spatial exploration.
2. Adjust the native curve-position, x and y sliders with standard screen-reader gestures.
3. Use all visible buttons without precision dragging.
4. Edit and reorder source points with form controls.
5. Confirm drawing remains optional and does not block page navigation when inactive.
6. Rotate portrait to landscape and back; confirm no control or state is lost.
7. Test at the largest practical system text setting and browser zoom.

## Result template

```text
Date:
Tester:
Screen reader and version:
Browser and version:
Operating system/device:
Input methods:
Listening mode:
Tasks completed:
Failures:
Unexpected speech:
Focus problems:
Audio/speech interaction:
Mono result:
Severity and follow-up:
```
