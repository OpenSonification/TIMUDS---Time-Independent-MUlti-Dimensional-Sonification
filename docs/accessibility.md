# Accessibility test plan and limitations

TIMUDS is designed to target WCAG 2.2 Level AA. This is not a conformance claim. Automated tests cover only detectable rules in representative states and cannot replace evaluation by disabled users or manual assistive-technology review.

## Implemented approach

- English (UK) document language, descriptive metadata, skip link and header/main/navigation/complementary/footer landmarks.
- Logical headings, native controls, visible labels, fieldsets/legends and concise descriptions.
- A focused error summary linked to preserved input, with line/item-specific validation where possible.
- Button parity for shortcuts and pointer drawing alternatives through text and file import.
- Visible focus, large targets, responsive one-column reflow and no disabled zoom.
- Light/dark colour schemes, forced-colour treatment and reduced-motion handling.
- No autoplay; deliberate activation, safe initial master gain, smoothing, prominent Stop sound and Escape stop.
- Non-colour plot markers, distinguishable timbres without relying solely on panning, and optional centred voices.
- SVG title/description plus adjacent curve, coordinate, progress, note, frequency and state text.
- Polite announcements for discrete actions and manual steps. High-frequency coordinate announcements are intentionally absent; periodic progress announcements default off.
- Web Audio failure leaves authoring, SVG and numeric inspection available.

## Manual keyboard and zoom checklist

1. At first load, use Tab from the browser chrome. Confirm the skip link appears and moves focus to the workspace.
2. Traverse every interactive element forwards and backwards. Confirm visible focus, logical order and no trap.
3. From the plot, use Space, arrows, Shift+arrows, Home, End and Escape. Confirm editable fields keep their native keys.
4. Complete preset selection, CSV paste, file selection, mapping changes, Play/Hold/Stop and manual steps without a pointer.
5. Submit malformed and empty imports. Confirm the focused error summary is understandable and the original input remains editable.
6. At browser zoom 200% and 400%, and at a 320 CSS-pixel viewport, confirm single-column reflow without page-level horizontal scrolling.
7. Use 200% text-only scaling where available. Confirm labels, buttons and readouts do not clip.
8. Enable operating-system forced colours/high contrast. Confirm start and current markers, curve, focus and state remain distinguishable.
9. Enable reduced motion. Confirm there is no decorative motion; user-requested traversal remains controllable.
10. Use touch emulation or a touch device. Confirm controls have separation and drawing does not scroll the page while active.

## Screen-reader checklist

Test at least NVDA + Firefox/Chrome on Windows and VoiceOver + Safari on macOS/iOS where available.

1. Navigate by landmarks and headings; confirm each region’s purpose.
2. Load every preset and understand summary changes without entering the SVG.
3. Review the plot accessible name/description; confirm it stays concise.
4. Operate Play, Hold, Stop, Reset and manual movement. Confirm announcements are discrete and do not overwhelm audio.
5. Enable and disable optional quarter-progress announcements.
6. Change both axis configurations, including automatic/manual domains, mute, solo and centre voices.
7. Import valid CSV/JSON and recover from errors; confirm focus moves once and the error is associated with the text area.
8. Simulate unavailable Web Audio and confirm the explanation and all non-audio operations remain usable.

## Manual listening checklist

Use a low system output first. Headphones are not required.

1. Confirm no sound occurs at load, after refresh or after importing a curve.
2. Press Play on the circle. Confirm two simultaneous sustained voices are audible and perceptually distinguishable in centred/mono output.
3. Follow one 20-second non-looping circle with a stopwatch. Confirm completion is approximately 20 seconds and final position is held.
4. Confirm X and Y pitches change independently around the circle: their maxima, minima and direction changes occur at different positions.
5. Press Hold. Confirm movement freezes without a click/pop and both voices sustain indefinitely.
6. Press Stop sound and Escape in separate runs. Confirm a short clean fade and retained position.
7. After audio is enabled, use ±1%, ±5%, Home, End and the seek slider. Confirm each new point sustains and transitions smoothly.
8. Audition low/middle/high and test controls for each axis. Confirm inversion reverses the learnt relationship.
9. Exercise mute, solo, per-axis gain, safe master volume, panning and centred voices. Listen for clipping or unstable loudness.
10. Change tabs during playback. Confirm traversal stops and audio fades; return and verify the explanation/status.
11. Test browser/OS audio interruption and output-device changes where practical.

Automated audio mocks only prove lifecycle/control calls. They do not prove sound exists, timbres are distinguishable, loudness is safe or output is distortion-free.

## Known limitations

- No formal audit or testing by disabled participants has yet been recorded.
- Browser/assistive-technology support for SVG descriptions, range inputs, disclosure elements and live regions varies.
- Sound cannot be made equivalent for all forms of hearing difference. Numeric and visual output is the non-audio alternative, not a claim of equivalent auditory perception.
- The current coordinate readout updates about ten times per second visually. It is not live-announced during playback.
- Optional panning may be ineffective or uncomfortable on some hearing devices; timbre and text remain primary separation cues.
- Freehand drawing requires pointer-like input; full curve creation remains available through keyboard-accessible text/file inputs.
- Automated colour-contrast checks in DOM test environments do not cover every system colour or rendered SVG state.
- Basic CSV support excludes quoted fields and locale-specific numeric conventions.

Report accessibility problems through the repository’s **Issues → New issue** page. Include browser, operating system, assistive technology, steps, expected result and actual result; apply an `accessibility` label if the repository provides one.
