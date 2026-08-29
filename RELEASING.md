# Releasing

`@fozy-labs/statechart-converter` and `@fozy-labs/statechart-viz` are released together: one version for both, one
`vX.Y.Z` git tag, one [CHANGELOG](CHANGELOG.md) section. Publishing is manual, by the steps below.

## Prerequisites

- An npm account allowed to publish into the `@fozy-labs` scope — check with `pnpm whoami`. With 2FA on, pass the
  one-time code as `--otp <code>`.
- GitHub CLI authenticated: `gh auth status`. Needed for the tag and the release.
- Node `>=20.19.0`, and pnpm at the version pinned by the root `packageManager` field.
- A Playwright browser: `pnpm --filter ./packages/viz exec playwright install chromium`.

## Steps

#### 1. Start from a clean tree and green checks

```sh
git status --porcelain   # must print nothing
pnpm install --frozen-lockfile && pnpm run check:all
```

#### 2. Set the version in both packages

```sh
pnpm version X.Y.Z --filter "@fozy-labs/statechart-*" --no-git-tag-version
```

Nothing else to touch. viz depends on the converter through `workspace:^`, which `pnpm publish` rewrites to `^X.Y.Z`
in the published manifest, and `pnpm-lock.yaml` records the workspace link rather than a version, so it needs no
refresh.

#### 3. Close the CHANGELOG section

Move everything under `[Unreleased]` into a new `## [X.Y.Z] - YYYY-MM-DD` heading, and update the reference links at
the bottom of the file: `[Unreleased]` now compares `vX.Y.Z...HEAD`, and `[X.Y.Z]` points at the new tag.

#### 4. Commit and tag

```sh
git commit -am "chore(release): vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push --follow-tags
```

#### 5. Publish, converter first

The order matters: viz depends on the converter, and building viz reads the converter's types out of its `dist/`.
Each package's `prepublishOnly` rebuilds its own `dist`, but the shared build has to run first.

```sh
pnpm run build
pnpm --filter ./packages/converter publish --dry-run   # inspect the tarball: dist, README, LICENSE, package.json
pnpm --filter ./packages/converter publish
pnpm --filter ./packages/viz publish --dry-run
pnpm --filter ./packages/viz publish
```

Check in the `--dry-run` output that `workspace:^` came out as `^X.Y.Z`. Publish a prerelease (`X.Y.Z-rc.N`) with
`--tag rc`, so it does not move `latest`.

> [!NOTE]
> `pnpm publish` refuses to run unless the tree is clean and the current branch is `main`, in sync with its remote.
> Releasing from any other branch needs `--no-git-checks`.

#### 6. Create the GitHub release

Notes are the CHANGELOG section for this version — either from a file, or by publishing a draft prepared earlier.

```sh
gh release create vX.Y.Z --title vX.Y.Z --notes-file <file holding the CHANGELOG section>
```

#### 7. Verify

```sh
pnpm view @fozy-labs/statechart-converter version
pnpm view @fozy-labs/statechart-viz version
```

Then install into an empty project and check that it resolves:

```sh
npm install @fozy-labs/statechart-viz @fozy-labs/rx-toolkit@rc mermaid react react-dom rxjs
```

## Rolling back

Before publishing, the tag is not yet load-bearing and can be removed and recreated:

```sh
git tag -d vX.Y.Z && git push --delete origin vX.Y.Z
```

> [!WARNING]
> Once published, a version is permanent — unpublishing is limited to 72 hours and to npm's policy. Fix a bad release
> by publishing the next version, not by removing the broken one.
