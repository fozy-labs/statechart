# Релиз

Пакеты версионируются синхронно: одна версия на `@fozy-labs/statechart-converter` и `@fozy-labs/statechart-viz`,
один git-тег `vX.Y.Z`, одна секция в [CHANGELOG.md](./CHANGELOG.md). Публикация — вручную, по шагам ниже.

## Предпосылки

- npm-аккаунт с правом публикации в scope `@fozy-labs` (`pnpm whoami`); при 2FA код передаётся как `--otp <код>`.
- `gh auth status` — для тега и GitHub Release.
- Node ≥ 20.19, pnpm (версия из поля `packageManager`), Chromium для Playwright
  (`pnpm --filter ./packages/viz exec playwright install chromium`).

## Шаги

1. Чистое дерево, зелёные проверки:

   ```bash
   git status --porcelain      # пусто
   pnpm install --frozen-lockfile && pnpm run check:all
   ```

2. Версия `X.Y.Z` в обоих пакетах, без git-тега:

   ```bash
   pnpm version X.Y.Z --filter "@fozy-labs/statechart-*" --no-git-tag-version
   ```

   Диапазон converter в viz править не нужно: он записан как `workspace:^` и подменяется на `^X.Y.Z` при публикации.
   `pnpm-lock.yaml` версии workspace-пакетов не хранит (там `link:../converter`), поэтому переустановка не требуется.

3. `CHANGELOG.md`: содержимое `[Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD`, ссылки внизу
   (`[Unreleased]: …/compare/vX.Y.Z...HEAD`, `[X.Y.Z]: …/releases/tag/vX.Y.Z`).

4. Коммит и тег:

   ```bash
   git commit -am "chore(release): vX.Y.Z"
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push --follow-tags
   ```

5. Публикация — порядок важен, viz зависит от converter. `prepublishOnly` каждого пакета пересобирает его `dist`;
   viz при сборке читает типы converter из его `dist`, поэтому сначала общий `pnpm run build`.

   ```bash
   pnpm run build
   pnpm --filter ./packages/converter publish --dry-run   # состав тарбола: dist, README, LICENSE, package.json
   pnpm --filter ./packages/converter publish
   pnpm --filter ./packages/viz publish --dry-run
   pnpm --filter ./packages/viz publish
   ```

   `pnpm publish` подменяет `workspace:^` на `^X.Y.Z` в публикуемом `package.json` — проверьте это в выводе
   `--dry-run`. Перед публикацией pnpm требует чистое дерево и ветку `main`, синхронизированную с remote; из другой
   ветки — `--no-git-checks`.

   Предрелиз (`X.Y.Z-rc.N`) публикуется с `--tag rc`, чтобы не сдвигать `latest`.

6. GitHub Release из тега, заметки — секция CHANGELOG (или опубликовать заранее созданный draft):

   ```bash
   gh release create vX.Y.Z --title vX.Y.Z --notes-file <файл с секцией CHANGELOG>
   ```

7. Проверка:

   ```bash
   pnpm view @fozy-labs/statechart-converter version
   pnpm view @fozy-labs/statechart-viz version
   ```

   и установка в пустой проект: `npm install @fozy-labs/statechart-viz @fozy-labs/rx-toolkit@rc mermaid react react-dom rxjs`.

## Откат до публикации

Тег ещё ничем не использован — его можно снять и поставить заново:

```bash
git tag -d vX.Y.Z && git push --delete origin vX.Y.Z
```
