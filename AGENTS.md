# AGENTS.md

## Repository map

- `src/core/`: presentation-independent curve, mapping and transport logic. Keep it pure and directly testable.
- `src/audio/AudioEngine.ts`: sole owner of `AudioContext`, oscillators and nodes. Do not create Web Audio graphs in React components.
- `src/components/`: focused presentation components. `CurvePlot` is SVG and `AxisControls` is driven by iterable axis configuration.
- `src/App.tsx`: application composition, accessible interactions and timing orchestration.
- `src/**/*.test.{ts,tsx}`: Vitest unit/component tests; `e2e/`: Playwright production-preview flows.
- `docs/`: architecture and accessibility decisions; `examples/`: safe local import examples.
- `public/`: static local assets copied into `dist`.

## Commands

Use Node 24 and npm with the committed lockfile.

```sh
npm ci
npm run dev
npm run format
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run validate
```

Run `npx playwright install chromium` once where the test browser is absent.

## Boundaries to preserve

1. X and Y are independent data dimensions. Never sort points by x or repurpose x as time.
2. Preserve supplied coordinate order. Closed geometry includes the final-to-first segment.
3. Timed progress comes from a monotonic clock (`AudioContext.currentTime` while active), never frame increments.
4. Keep geometry, parsing, pitch and transport as pure functions. New dimensions should extend iterable configuration, not duplicate whole implementations.
5. Keep one persistent, gesture-created audio engine. Smooth parameter changes and fade output. Never autoplay.
6. Imported data remains local, bounded and rendered as text only. Do not add telemetry, a backend or external runtime assets.
7. Vite production `base` remains relative for unknown GitHub Pages repository paths.
8. Route every Stop, Reset, Escape, visibility and preview-exit path through the common audio cancellation and fade method.
9. Add page shortcuts only through the central shortcut resolver. Never process them in editable/native controls; site-wide character shortcuts must remain disableable.
10. Keep the visible Stop control and never autoplay. Panning must not be the sole representation of a coordinate.
11. Do not live-announce animation frames. Keep ordinary current data visible numerically and technical audio values in collapsed details.
12. Do not restore decorative hero imagery without an accessible product purpose. New audio mappings need mono and textual alternatives; new interactions need keyboard and accessibility tests.

## Accessibility expectations

Accessibility is a product constraint, not cleanup. Preserve semantic landmarks and headings, native controls, visible labels, error-summary focus, keyboard parity, a prominent stop control, non-audio alternatives, status announcements and reduced-motion/forced-colour behaviour. Do not live-announce animation frames. Do not make sound, colour, stereo, dragging or SVG the only means of understanding or operating a feature.

Durable interaction rules:

- Prefer native controls to custom widgets. No pointer-only core action.
- Do not add global arrow or WASD shortcuts. WASD remains optional, off by default and focus-scoped to the plane controller.
- Never start audio automatically. Keep current state available as ordinary text.
- Do not add high-frequency live-region updates, positive `tabindex` or a page-level `role="application"`.
- Every new interaction needs keyboard and screen-reader-oriented tests. Accessibility regressions block completion.

Any new primary action needs:

- a visible keyboard-operable control;
- a discernible visible name and any required description;
- sensible focus placement/restoration;
- a text/numeric state representation where sound or graphics are involved;
- unit/component tests and a representative axe check when relevant.

Do not claim WCAG conformance based on automated tests. Update `docs/accessibility.md` for new limitations or manual checks.

## Change discipline

- Use UK English in interface and documentation.
- Keep dependencies small and justify new runtime dependencies.
- Add tests for mathematical edge cases, especially constants, duplicates, closure and malformed imports.
- Do not add a licence without the project owner’s choice.
- Before hand-off, run `npm run validate`, inspect `dist/index.html` for relative assets and report any browser step that genuinely could not run.
