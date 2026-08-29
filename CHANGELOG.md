# CHANGELOG

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).
Пакеты `@fozy-labs/statechart-converter` и `@fozy-labs/statechart-viz` версионируются синхронно:
одна версия на оба, один тег `vX.Y.Z`, одна секция здесь. Процедура — [RELEASING.md](./RELEASING.md).

## [Unreleased]

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

[Unreleased]: https://github.com/fozy-labs/statechart/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fozy-labs/statechart/releases/tag/v0.1.0
