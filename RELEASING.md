# Релиз

Пакеты версионируются синхронно: одна версия на `@fozy-labs/statechart-converter` и `@fozy-labs/statechart-viz`,
один git-тег `vX.Y.Z`, одна секция в [CHANGELOG.md](./CHANGELOG.md). Публикация — вручную, по шагам ниже.

## Предпосылки

- npm-аккаунт с правом публикации в scope `@fozy-labs` (`npm whoami`); при 2FA `npm publish` запросит одноразовый код.
- `gh auth status` — для тега и GitHub Release.
- Node ≥ 20.19, Chromium для Playwright (`npx playwright install chromium`).

## Шаги

1. Чистое дерево, зелёные проверки:

   ```bash
   git status --porcelain      # пусто
   npm ci && npm run check:all
   ```

2. Версия `X.Y.Z` в обоих пакетах, без git-тега от npm; затем диапазон converter в viz и lockfile:

   ```bash
   npm version X.Y.Z -w packages/converter -w packages/viz --no-git-tag-version
   # packages/viz/package.json → "dependencies": { "@fozy-labs/statechart-converter": "^X.Y.Z" }
   npm install
   ```

3. `CHANGELOG.md`: содержимое `[Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD`, ссылки внизу
   (`[Unreleased]: …/compare/vX.Y.Z...HEAD`, `[X.Y.Z]: …/releases/tag/vX.Y.Z`).

4. Коммит и тег:

   ```bash
   git commit -am "chore(release): vX.Y.Z"
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push --follow-tags
   ```

5. Публикация — порядок важен, viz зависит от converter. `prepublishOnly` каждого пакета пересобирает его `dist`;
   viz при сборке читает типы converter из его `dist`, поэтому сначала общий `npm run build`.

   ```bash
   npm run build
   npm publish -w packages/converter --dry-run   # состав тарбола: dist, README, LICENSE, package.json
   npm publish -w packages/converter
   npm publish -w packages/viz --dry-run
   npm publish -w packages/viz
   ```

   Предрелиз (`X.Y.Z-rc.N`) публикуется с `--tag rc`, чтобы не сдвигать `latest`.

6. GitHub Release из тега, заметки — секция CHANGELOG (или опубликовать заранее созданный draft):

   ```bash
   gh release create vX.Y.Z --title vX.Y.Z --notes-file <файл с секцией CHANGELOG>
   ```

7. Проверка:

   ```bash
   npm view @fozy-labs/statechart-converter version
   npm view @fozy-labs/statechart-viz version
   ```

   и установка в пустой проект: `npm install @fozy-labs/statechart-viz @fozy-labs/rx-toolkit@rc mermaid react react-dom rxjs`.

## Откат до публикации

Тег ещё ничем не использован — его можно снять и поставить заново:

```bash
git tag -d vX.Y.Z && git push --delete origin vX.Y.Z
```

После `npm publish` версия в реестре необратима (unpublish ограничен 72 часами и политикой npm) — при ошибке выпускается следующая.
