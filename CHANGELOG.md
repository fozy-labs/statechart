# CHANGELOG

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).
Пакеты `@fozy-labs/statechart-converter` и `@fozy-labs/statechart-viz` версионируются синхронно:
одна версия на оба, один тег `vX.Y.Z`, одна секция здесь. Процедура — [RELEASING.md](./RELEASING.md).

## [Unreleased]

### Added
- **viz** — compound-компоненты и headless API: `StatechartViz.Root` + части (`Header`, `Body`, `Diagram`,
  `Side`, `Notice`, `Events`, `PayloadEditor`, `Log`, `Context`), хук `useStatechartViz()` (`StatechartVizApi`)
  для своих панелей; `Root` принимает `className` / `style` / `unstyled` / `children`. Монолитный
  `<StatechartViz />` — тот же `Root` с layout'ом по умолчанию, API не менялся.
- **viz** — статус **blocked** у переходов: ребро с событием из активного состояния, которое машина отклоняет
  (гвард), рисуется янтарным пунктиром (`scv-blocked`), клик пишет отказ в лог с именами гвардов
  (`collectGuardsForEvent`) и мигает ребром (`scv-denied`); кнопка события показывает имя гварда (`⊘ hasKey`).
  Невалидный payload больше не гасит рёбра «молча» — они inert, причина показана у поля.
- **viz** — редактор payload в двух режимах с переключателем: **Fields** (по умолчанию; строки ключ/значение,
  значение — JSON или строка) и **JSON**; переключение конвертирует значение без потерь.
- **viz** — темизация: все цвета — CSS-токены `--scv-*` (12 штук, экспорт `THEME_TOKENS`), включая фоны и
  рамки панелей; `unstyled` отключает встроенный стиль (`BASE_CSS` экспортируется).
- **viz** — фикстура `door` (гвард, отклоняющий в начальном контексте) в playground и e2e.

- **viz** — зум-контролы диаграммы вынесены в HTML-оверлей `StatechartViz.DiagramControls`
  (+ хук `useDiagramControls`); `Diagram` принимает `children` как оверлей. Layout-переменные
  `--scv-min-height` / `--scv-diagram-min-height` снимают минимальные высоты в стеснённых хостах.

### Fixed
- **viz** — диаграмма и контролы не реагировали на resize контейнера: встроенные иконки svg-pan-zoom
  рисуются в SVG с координатами на момент инициализации и уезжали за панель, viewport оставался от старого
  размера. Теперь `ResizeObserver` перевписывает диаграмму (пока пользователь не зумил сам; «вписать»
  возвращает слежение), контролы — HTML в углу панели.

### Changed
- **viz** — монолитный `<StatechartViz />` принимает те же пропсы, что и `Root`
  (`className` / `style` / `unstyled` / `children`).
- **viz** — лог: отказ рендерится как `⊘ ~~EVENT~~ [guard] from`; `LogEntry` получил `reason?`.
  `HighlightState.enabledEdges` заменён на `edgeStatuses` (`applyHighlight` из публичного API).

## [0.2.0] - 2026-08-29

### Added
- **converter** — markdown как контейнер: каждый ```` ```mermaid ````-блок с `%% @machine` — самостоятельная
  машина. `extractMermaidBlocks` / `findStatechartBlocks` / `selectStatechartBlock` (разбор фенсов по правилам
  CommonMark, чужие диаграммы пропускаются), `parseMarkdown` / `convertMarkdown` / `parseStatechartBlock` /
  `convertStatechartBlock` — с позициями ошибок и `ParseResult` в координатах документа. CLI: вход `.md`
  (или `--format md`), `--machine <id[=file]>` (повторяемый), `--all`; при нескольких целях файлы пишутся,
  только если сконвертировались все. Заголовок сгенерированного файла — `from flows.md (@machine order)`;
  `EmitOptions.sourceLabel` задаёт его вручную.
- **viz** — режим `source` принимает markdown-документ: проп `machineId` выбирает машину (по умолчанию первая),
  диаграмма рендерит выбранный блок (`resolveDiagramSource`, `looksLikeMarkdown`), строки в уведомлениях —
  координаты документа. В playground'е — параметр `?machine=` и поле в форме.

## [0.1.0] - 2026-08-29

Первый релиз: извлечение из [fozy-labs/rx-toolkit](https://github.com/fozy-labs/rx-toolkit)
(коммит `a001b0a`, `apps/converter` и `apps/viz`). Требует `@fozy-labs/rx-toolkit` `>=0.12.0-rc.1`.

### Added
- **converter** — `parse` / `emit` / `convert` / `validateMachineConfig` и CLI `statechart-convert`:
  mermaid `stateDiagram-v2` с директивами `%% @machine | @context | @event | @guard | @action | @delay`
  → `*.generated.ts` с `createMachine`; синтаксическая проверка тел через TypeScript; проверка конфига
  `createMachine` до записи; дифференциальные тесты парсера против mermaid 11.17.2.
- **viz** — React-компонент `StatechartViz`: режим `machine` (запущенный `MachineSignal`: подсветка активных
  состояний, отправка событий кликом по переходу, лог событий, `context`) и режим `source` (текст `.mmd` →
  parse → `new Function` → `MachineSignal`; конвертер и TypeScript загружаются лениво).

[Unreleased]: https://github.com/fozy-labs/statechart/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/fozy-labs/statechart/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/fozy-labs/statechart/releases/tag/v0.1.0
