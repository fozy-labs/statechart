# Changelog

> `@fozy-labs/statechart-converter` and `@fozy-labs/statechart-viz` are versioned together.

## [Unreleased]

## [0.4.0] - 2026-09-01

### Changed

- **Breaking: converter, viz** — `@fozy-labs/rx-toolkit` `>=0.12.0` is now required, where the statechart API carries
  the `unstable_` prefix: `createMachine` → `unstable_createMachine`, `MachineSignal` → `unstable_MachineSignal`,
  `Statechart` → `unstable_Statechart`. Rename the imports in code that builds or types a machine by hand.
- **converter** — The generated file imports `unstable_createMachine as createMachine` and still calls it
  `createMachine`. A file regenerated after 0.3.0 differs on that import line and nowhere else.

## [0.3.0] - 2026-08-29

### Added

- **viz** — Compound components and a headless API. `StatechartViz.Root` composes with `Header`, `Body`, `Diagram`,
  `DiagramControls`, `Side`, `Notice`, `Events`, `PayloadEditor`, `Log` and `Context`, and `useStatechartViz()`
  exposes the same state to panels of your own. `<StatechartViz />` is that `Root` with the default layout.
- **viz** — Guard-blocked transitions are now visible rather than silent: the edge is drawn as an amber dash,
  clicking it logs the refusal with the guard names and flashes the edge, and the event button names the guard
  (`⊘ hasKey`). An invalid payload makes edges inert and reports the reason next to the field.
- **viz** — A payload editor with two modes behind a toggle: **Fields** (key/value rows, the default) and **JSON**.
  Switching converts the value without losing it.
- **viz** — Theming through CSS custom properties: twelve `--scv-*` tokens covering panel backgrounds and borders as
  well as diagram colours, exported as `THEME_TOKENS`. `unstyled` drops the built-in stylesheet, which is exported as
  `BASE_CSS`.
- **viz** — Zoom controls as an HTML overlay, `StatechartViz.DiagramControls`, with `useDiagramControls()` behind it;
  `Diagram` accepts `children` as an overlay. `--scv-min-height` and `--scv-diagram-min-height` release the minimum
  heights for cramped hosts.
- **viz** — A `door` fixture — a guard that refuses in the initial context — in the playground and the e2e suite.
- **viz** — The UI store behind the panels is injectable and subscribable. `StatechartViz.createStore()` builds the
  store that holds the selection, the event log and the payload editor's state; `Root` accepts it as a `store` prop
  (and still creates its own per machine when none is given), `StatechartViz.useStore()` lets a panel follow a single
  signal without re-rendering with the whole `useStatechartViz()` object, `VizStore.reset()` puts every signal back
  in one batch, and `api.store` exposes the instance to code already holding the API.

### Changed

- **viz** — `<StatechartViz />` accepts the same props as `Root`: `className`, `style`, `unstyled` and `children`.
- **viz** — A refused event is logged as `⊘ ~~EVENT~~ [guard] from`, and `LogEntry` carries the `reason`.
- **viz** — The diagram is repainted so one node reads as active: inert states take the field's own
  `--scv-bg` / `--scv-border-strong` colours, leaving the active state as the only filled node. `--scv-active` moves
  from red to violet — red now marks errors only — so each predicate (active, selected, enabled, blocked, error) has
  exactly one colour. Side panels flatten onto the field colour, and spacing sits on a single ~1.7 progression.

### Fixed

- **viz** — The diagram and its controls now follow a resizing container. svg-pan-zoom's built-in icons are drawn
  into the SVG with the coordinates it had at initialization and drifted out of the panel, while the viewport kept
  the old size. A `ResizeObserver` refits the diagram until the user zooms or pans — "fit" hands control back — and
  the controls are plain HTML in the corner of the panel.

## [0.2.0] - 2026-08-29

### Added

- **converter** — Markdown as a container: every `mermaid` block declaring `%% @machine` is an independent machine.
  `extractMermaidBlocks`, `findStatechartBlocks`, `selectStatechartBlock`, `parseMarkdown`, `convertMarkdown`,
  `parseStatechartBlock` and `convertStatechartBlock` parse fences by CommonMark rules, skip foreign diagrams, and
  report every position in document coordinates.
- **converter** — The CLI accepts a `.md` input (or `--format md`), `--machine <id[=file]>` (repeatable) and `--all`.
  With several targets, files are written only if every machine converted. The generated header names the source
  block — `from flows.md (@machine order)` — and `EmitOptions.sourceLabel` sets it by hand.
- **viz** — `source` mode accepts a Markdown document. `machineId` selects the machine, defaulting to the first; the
  diagram renders the selected block, and notice lines are document coordinates.

## [0.1.0] - 2026-08-29

First release, extracted from [fozy-labs/rx-toolkit](https://github.com/fozy-labs/rx-toolkit) at commit `a001b0a`
(`apps/converter` and `apps/viz`). Requires `@fozy-labs/rx-toolkit` `>=0.12.0-rc.1`.

### Added

- **converter** — `parse`, `emit`, `convert`, `validateMachineConfig` and the `statechart-convert` CLI: a Mermaid
  `stateDiagram-v2` with `%% @machine | @context | @event | @guard | @action | @delay` directives becomes a
  `*.generated.ts` built on `createMachine`. Directive bodies are syntax-checked with TypeScript, the config is run
  through `createMachine` before anything is written, and the parser is held to differential tests against Mermaid
  11.17.2.
- **viz** — The `StatechartViz` React component in two modes. `machine` renders a running `MachineSignal` with active
  states highlighted, events sent by clicking a transition, an event log and the `context`. `source` compiles `.mmd`
  text in the browser, loading the converter and TypeScript on demand.

[Unreleased]: https://github.com/fozy-labs/statechart/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/fozy-labs/statechart/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fozy-labs/statechart/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/fozy-labs/statechart/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/fozy-labs/statechart/releases/tag/v0.1.0
