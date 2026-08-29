# @fozy-labs/statechart-viz

React-компонент `StatechartViz` — интерактивная визуализация statechart'а rx-toolkit поверх диаграммы
mermaid (`stateDiagram-v2`): подсветка активных состояний по `value` запущенной машины, отправка событий кликом
по переходу или кнопкой, лог событий и текущий `context`. Собирается Vite как библиотека (`dist/`); пакет
`packages/viz` репозитория [fozy-labs/statechart](../../README.md). Требует `@fozy-labs/rx-toolkit` `>=0.12.0-rc.1`
(peer-зависимость: `mutate`, `definition.source`).

## Содержание

- [Пропсы](#пропсы)
- [Compound-компоненты и headless API](#compound-компоненты-и-headless-api)
- [Темизация](#темизация)
- [Режимы](#режимы)
- [Режим source](#режим-source)
- [Правило eval / CSP](#правило-eval--csp)
- [Как это работает](#как-это-работает)
- [Ограничения](#ограничения)
- [Разработка](#разработка)

## Пропсы

```ts
type StatechartVizProps =
    | { machine: VizMachine; title?: string } // режим machine
    | {
          // режим source
          source: string; // .mmd или markdown-документ с диаграммой в ```mermaid-блоке
          machineId?: string; // какую машину документа запускать; по умолчанию первую
          title?: string;
          onMachine?: (machine: DisposableVizMachine | null) => void;
      };

// StatechartViz и StatechartViz.Root принимают дополнительно:
type StatechartVizRootProps = StatechartVizProps & {
    className?: string;
    style?: CSSProperties;
    unstyled?: boolean; // не инжектить встроенный стиль — см. «Темизация»
    children?: ReactNode; // свой layout из частей; без children — layout по умолчанию
};
```

`VizMachine` — структурное подмножество `MachineStateSignal` библиотеки; `MachineSignal.state(definition)`
присваивается ему без приведений типов (`src/__tests__/vizMachine.types.test.tsx`):

```ts
interface VizMachine<TContext = unknown, TEvent extends { type: string } = { type: string }> {
    (): { status: string; value: StateValue; context: TContext };   // StateValue — тип библиотеки
    readonly obs: Observable<{ status: string; value: StateValue; context: TContext }>;
    readonly definition: { readonly id: string; readonly source?: string; readonly config: MachineConfigLike; toMermaid(): string };
    send(event: TEvent): void;
    can(event: TEvent): boolean;
    matches(value: StateValue): boolean;
}
```

`MachineConfigLike` — read-only и «свободно» типизированный вид конфига (`id`, `initial`, `states` опциональны;
`on`/`after`/`always`/`onDone` — строка, объект или массив с возможными `undefined`; guard/action — имя,
`{ type }` или функция). Обход конфига (`core/configWalk.ts`) нормализует записи и даёт guard'ам/action'ам
отображаемые имена: строка — как есть, функция — `name` или `anonymous` (встроенные `and()`, `assign()`,
`mutate()` названы по создателю), объект — `type`. Для тестов есть двойник `createFakeVizMachine` в
`src/testing/` поверх JSON-конфига конвертера.

`title` — заголовок панели; по умолчанию `definition.id`. `onMachine` (только режим `source`) получает созданную
машину и `null`, когда она удалена (смена текста, размонтирование).

## Compound-компоненты и headless API

`<StatechartViz {...props} />` — готовый layout целиком. Для встраивания в свой интерфейс тот же компонент
раскладывается на части поверх общего провайдера:

```tsx
<StatechartViz.Root machine={machine$}>
    <StatechartViz.Header />
    <StatechartViz.Body>
        <StatechartViz.Diagram />
        <StatechartViz.Side>
            <StatechartViz.Notice />
            <StatechartViz.Events />
            <MyInspector /> {/* своя панель на useStatechartViz() */}
        </StatechartViz.Side>
    </StatechartViz.Body>
</StatechartViz.Root>
```

| Часть           | Что рендерит                                                    |
|-----------------|------------------------------------------------------------------|
| `Root`          | провайдер + рамка `.scv`; без `children` — layout по умолчанию   |
| `Header`        | заголовок, статус машины, текущий `value`                        |
| `Body` / `Side` | layout-слоты: грид «диаграмма + колонка» и скроллящаяся колонка  |
| `Diagram`       | интерактивная диаграмма (pan/zoom, клики); `children` — оверлей поверх неё (по умолчанию — `DiagramControls`; `null` — без него) |
| `DiagramControls` | кнопки зума (+ / − / вписать) — HTML-оверлей в углу панели     |
| `Notice`        | ошибка режима `source`; без ошибки не рендерится                 |
| `Events`        | события выбранного состояния + `PayloadEditor`                   |
| `PayloadEditor` | редактор payload отдельно (внутри `Events` уже есть)             |
| `Log`           | лог отправок                                                     |
| `Context`       | текущий `context`                                                |

Каждая часть принимает `className`. Части — тонкие обёртки над headless-хуком `useStatechartViz()`
(тип `StatechartVizApi`, работает под `Root`): снапшот, `activeIds`, `edgeStatuses`, выбор состояния,
`outgoing`, `canSend`/`send` (с логированием), лог, состояние payload-редактора. Любую боковую панель
можно заменить своей, не теряя остального. Для своих кнопок зума внутри `Diagram` есть
`useDiagramControls()` (`zoomIn` / `zoomOut` / `reset`).

## Темизация

Все цвета — CSS-переменные на `.scv`; хосту достаточно переопределить их (тёмная тема — тоже):

| Токен                 | По умолчанию | Что красит                                        |
|-----------------------|--------------|----------------------------------------------------|
| `--scv-bg`            | `#fff`       | поле диаграммы, инпуты, кнопки                     |
| `--scv-panel`         | `#fafafa`    | фон боковых панелей                                |
| `--scv-text`          | `#222`       | основной текст                                     |
| `--scv-muted`         | `#7a7a7a`    | вторичный текст, заголовки панелей                 |
| `--scv-border`        | `#d9d9d9`    | рамки панелей и диаграммы                          |
| `--scv-border-strong` | `#b5b5b5`    | рамки интерактивных контролов                      |
| `--scv-active`        | `#d0342c`    | обводка активного состояния                        |
| `--scv-active-fill`   | `#fff0ee`    | заливка активного состояния                        |
| `--scv-selected`      | `#1a6ee0`    | обводка выбранного состояния                       |
| `--scv-enabled`       | `#1f8a3b`    | разрешённые переходы и кнопки                      |
| `--scv-blocked`       | `#b45309`    | переходы, отклонённые гвардом, и подписи гвардов   |
| `--scv-error`         | `#b00020`    | текст ошибок                                       |

Помимо цветов — две layout-переменные (не входят в `THEME_TOKENS`): `--scv-min-height` (по умолчанию
`480px`, минимум всего компонента) и `--scv-diagram-min-height` (`420px`, минимум панели диаграммы);
хост со стеснённой высотой ставит их в `0`, чтобы компонент никогда не вылезал за свой контейнер.

Таблица цветов экспортируется как `THEME_TOKENS`. `unstyled` на `Root` отключает встроенный стиль целиком —
хост стилизует классы `scv-*` и атрибуты `data-scv-*` сам (`BASE_CSS` экспортируется как отправная
точка); правила интерактивности диаграммы (курсоры, обводки подсветки) инжектятся всегда — они
привязаны к id конкретного SVG и читают те же токены с fallback-значениями. Внутренность SVG
(тема mermaid) настраивается конфигурацией mermaid у хоста, не токенами.

## Режимы

| Режим     | Что рендерится                                  | Откуда код guards/actions                          |
|-----------|-------------------------------------------------|----------------------------------------------------|
| `machine` | `definition.source ?? definition.toMermaid()`   | из определения машины (сгенерированный TS), без eval |
| `source`  | текст `.mmd` или выбранный блок markdown-документа | тела директив `%% @…` компилируются через `new Function` |

Взаимодействие (общее для режимов):

- активные состояния подсвечены; `value` проецируется на плоские mermaid-id (`{ working: "green" }` →
  `working`, `green`); ключи регионов `$0`/`$1` пропускаются, `$final` отображается на узел `[*]` по таблице в
  [docs/svg-scheme.md](docs/svg-scheme.md#start-and-end-pseudo-states);
- ребро с событием из активного состояния — в одном из трёх статусов: **enabled** (машина примет событие;
  зелёное, клик отправляет), **blocked** (машина отклоняет — обычно гвард; янтарный пунктир, клик пишет отказ
  в лог с именами гвардов и мигает ребром), **inert** (всё остальное, включая невалидный payload — его причина
  показана у поля, а не на диаграмме);
- клик по состоянию выделяет его и показывает кнопки исходящих событий (включая события предков); кнопка,
  отклонённая гвардом при активном состоянии, показывает его имя (`⊘ hasKey`) вместо простого затемнения;
- payload подмешивается в событие (`{ "value": 12 }` → `{ type: "SQUARE", value: 12 }`); редактор — в двух
  режимах с переключателем: **Fields** (по умолчанию; строки ключ/значение, значение — JSON, а не разобравшийся
  текст остаётся строкой) и **JSON** (сырой объект). Переключение конвертирует значение; невалидный JSON
  блокирует уход в Fields, но не теряется;
- панели: диаграмма (pan/zoom), лог событий (отказы — с именем гварда), `context`;
- телепорта (перезапуск машины из выбранного состояния по клику с модификатором) нет: у библиотеки нет API
  запуска машины из заданного `value`.

## Режим source

Конвейер `createSourceMachine(source)` (`src/playground/createSourceMachine.ts`):

```mermaid
flowchart LR
    SRC[".mmd"] --> P["parse"] --> V["validateMachineConfig"] --> C["compileImplementations"] --> M["createMachine(config, mutate(...))"] --> S["MachineSignal.state"]
```

`parse` и `validateMachineConfig` — из [конвертера](../converter/README.md) (там же грамматика и директивы);
`createMachine`, `mutate`, `MachineSignal` — из библиотеки. `@context initial` передаётся в `createMachine`
фабрикой: каждый экземпляр и каждый рестарт вычисляют выражение заново.

Markdown вместо `.mmd`: если в тексте есть ```` ```mermaid ````-блок с `%% @machine`, конвейер работает над
блоком — его же рендерит диаграмма (`resolveDiagramSource`), а `machineId` выбирает машину из документа
(по умолчанию первая; неизвестное имя — ошибка со списком доступных). Строки в уведомлениях — координаты
документа, не блока. Правила разбора блоков — в [конвертере](../converter/README.md#markdown-документ).

- Конвертер (и компилятор TypeScript, от которого он зависит) грузится `import()` при первом вызове — так же,
  как `mermaid`. Режим `machine` его не трогает: хост, собирающий viz только для него, парсер не получает.
- Машина живёт, пока живёт текст: компонент создаёт её в эффекте по `source` и вызывает `dispose()` при смене
  текста и размонтировании. Пока конвейер работает, панели пусты; результат — `onMachine`.
- Ошибка любого этапа — в области уведомления (`[data-scv-notice]`), с этапом и строкой источника:

| Этап       | Ошибка                                              | Текст уведомления                                  |
|------------|-----------------------------------------------------|----------------------------------------------------|
| parse      | `StatechartParseError` конвертера                   | `Parse error, line N[:col]: message[ (at path)]`   |
| validate   | `StatechartParseError` от `createMachine`-гейта     | `Machine config error, line N: message (at path)`  |
| compile    | `CompileError` (тело — не JavaScript)               | `Compile error, line N: @kind name: message`       |
| create     | `MachineConfigError` библиотеки                     | `Machine config error: message`                    |
| любой      | прочее                                              | `<Этап> failed: message`                           |
| runtime    | исключение тела при работе машины (`onError`)       | `Runtime error: message`; snapshot — `status: "error"` |

Программно: `createSourceMachine` отклоняет промис `SourceMachineError` (`stage`, `line?`, `cause`).

## Правило eval / CSP

Режим `source` исполняет текст схемы как код: тела `@guard`/`@action`/`@delay`/`@context initial` компилируются
`new Function` (единственное место eval в пакете — `src/playground/compileImplementations.ts`). Следствия:

- хосту нужен CSP с `unsafe-eval`; при строгом CSP режим не работает;
- чужой `.mmd` — это чужой код. Показ не своих файлов и встраивание в CSP-строгую страницу — только режим
  `machine` с кодом, полученным через конвертер.

Ядро библиотеки eval не содержит.

## Как это работает

- Диаграмма рендерится один раз (`mermaid.render`, `mermaid` — peer-зависимость, грузится `import()` по
  требованию); узлы и рёбра SVG размечаются атрибутами `data-scv-state` / `data-scv-edge` по схеме из
  [docs/svg-scheme.md](docs/svg-scheme.md); на каждый snapshot переключаются классы `scv-active`,
  `scv-selected`, `scv-enabled`, `scv-blocked` без перерендера (`scv-denied` — одноразовое мигание по клику
  на заблокированное ребро).
- Панель диаграммы следит за своим размером (`ResizeObserver`): пока пользователь не зумил и не панорамировал,
  диаграмма перевписывается в панель при каждом resize; после ручного зума viewport сохраняется, кнопка
  «вписать» возвращает слежение. Кнопки зума — HTML-оверлей (`DiagramControls`), а не встроенные иконки
  svg-pan-zoom, которые рисуются в SVG один раз и за панелью не следят.
- `mermaid.initialize` компонент не вызывает — конфигурация mermaid остаётся за хостом; `securityLevel: "sandbox"`
  не поддерживается (SVG уезжает в iframe).
- Внутреннее состояние — на сигналах rx-toolkit (`Signal.state`), подписка через `useSignal`.
- Цвета — токены из раздела [Темизация](#темизация).

## Ограничения

- В режиме `machine` без `definition.source` диаграмма строится `toMermaid()`: id узлов выводятся из ключей
  состояний (символы вне `[A-Za-z0-9_]` заменяются на `_`; ключ, повторяющийся у разных родителей, становится
  путём через `_`), а подсветка ищет узел по ключу из `value` — такие состояния не подсвечиваются. Давайте
  состояниям глобально уникальные ключи-идентификаторы или передавайте `source`.
- Финальные состояния регионов не имеют узла — [docs/svg-scheme.md](docs/svg-scheme.md#start-and-end-pseudo-states).

## Разработка

```bash
pnpm install            # в корне репозитория; затем pnpm --filter ./packages/converter run build: конвертер подключён
                        # как workspace:^ (симлинк) и читается из его dist/ (типы, unit-тесты, dev-сервер, сборка)
pnpm run dev            # playground: /?fixture=trafficLight|square|parallel|door[&mode=source[&source=<текст>][&machine=<id>]], спайк: /spike/
pnpm run ts-check       # против dist/ конвертера и установленного @fozy-labs/rx-toolkit
pnpm run test           # vitest (jsdom): core, playground (реальный конвейер), testing, type-тест VizMachine,
                        # файловые снапшоты src/__tests__/proposal/*.generated.ts — вывод конвертера (обновить: vitest -u)
pnpm run test:e2e       # Playwright (chromium) поверх playground'а
pnpm run lint / format:check
pnpm run build          # dist/index.js + dist/index.d.ts; конвертер и typescript — external
pnpm run check:all      # из корня репозитория pnpm run check:all собирает конвертер и проверяет оба пакета
```

Playground в режиме `source` гоняет реальный конвейер по тексту фикстуры (`src/testing/fixtures/*` — примеры
`square` и `trafficLight` из пропозала дословно; `door` — гвард, отклоняющий в начальном контексте) или по `?source=`; текст можно править в поле под диаграммой.
`window.__scvPlayground.machine` — запущенная машина (фейк или из `source`).
