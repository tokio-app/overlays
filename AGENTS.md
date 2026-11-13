# AGENTS.md

## Project

The overlays for Tokio, one folder each, and the tooling that builds, checks and releases them. Tokio (`tokio-app/tokio`, locally `../tokio`) is an Electron app that connects to a TikTok LIVE and serves overlays to streaming apps over a local HTTP/WebSocket server. It has its own `AGENTS.md`, as does the website (`tokio-app/website`, locally `../tokio-web`).

Stack: Yarn 1 workspaces, Node >= 24, Vite 8 and TypeScript 7 for the template, plain Node scripts (JS with JSDoc, type-checked) for the tooling. The repo is MIT.

## Commands

```sh
yarn new <id> ["Name"]  # copy overlays/_template to overlays/<id>
yarn delete <id>        # delete overlays/<id> and update yarn.lock (--force for uncommitted changes)
yarn dev <id>           # the overlay's dev server
yarn build [id...]      # build overlays into dist/ and check them like Tokio's import
yarn typecheck          # tsc for scripts/, packages/shared and every overlay with a typecheck script
yarn lint               # oxlint --type-aware
yarn format             # prettier --write .
yarn release:build      # build everything and prepare release/ (see Releases)
yarn release:notes      # print the next release's notes
```

Verify changes with `yarn format:check`, `yarn lint`, `yarn typecheck` and `yarn release:build`. To test an overlay in Tokio, import its `dist/` with **Overlays → Import overlay**, or connect `yarn dev` with a test ID from **Tools → Test Overlays** (`?id=<test ID>`).

## Agent models

- **Planning:** Opus 5.5 at high effort. Be 90–95% confident in the plan before implementing or handing off; otherwise keep reading code or ask the user.
- **Implementation subagents:** Sonnet 5.5 at high effort for well-scoped changes that follow existing patterns, such as a new overlay. Otherwise Opus 5.5: medium effort for moderate tasks, high for complex or cross-cutting ones (the release script, the catalog format, the workflows).

## Layout

| Path                            | Role                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `overlays/<id>/`                | One overlay, a workspace named `@tokio-overlays/<id>`                          |
| `overlays/_template/`           | What `yarn new` copies. Built and checked like an overlay, never released      |
| `packages/shared/`              | `@tokio-overlays/shared`, the code two or more overlays use (see Shared code)  |
| `scripts/lib/schema.js`         | Copy of Tokio's overlay schemas and setup block regex                          |
| `scripts/lib/validate.js`       | The checks on a built `dist/`                                                  |
| `scripts/lib/build.js`          | Runs an overlay's `build`, copies its YAML files into `dist/`, validates       |
| `scripts/lib/overlays.js`       | Lists overlays, runs yarn in a workspace, error helpers                        |
| `scripts/release.js`            | Builds the release into `release/`: changed zips, previews and `overlays.json` |
| `scripts/release-notes/`        | Release notes, adapted from Tokio's `scripts/release-notes`                    |
| `.github/workflows/ci.yml`      | Format, lint, typecheck and `yarn release:build` on PRs and `main`             |
| `.github/workflows/release.yml` | Publishes a release from a `v<version>` tag                                    |

Generated, don't edit: `overlays/*/dist/`, `release/`.

## Overlays

- An overlay is `overlays/<id>/`. `<id>` is kebab-case, names the zip and the catalog entry, and never changes once released: Tokio installs the overlay under it, so it's also the overlay's URL (`http://tokio-app.local:37891/<id>/`). `alerts`, `timer`, `games` and `studio` are taken: Tokio serves each alert's own overlay under `/alerts/`, its countdown timer's at `/timer/`, its games overlay's at `/games/` and its Overlay Studio overlays under `/studio/`. Folders starting with `_` are never released.
- `preview.png` is optional. Tokio's **Official Overlays** and the website's Overlays page show it at 16:9, so make it 1280×720.
- Delete an overlay with `yarn delete <id>`, not by hand: it refuses to drop uncommitted changes and updates `yarn.lock`. The next release lists it as removed and drops it from the catalog. `_template` can't be deleted.
- The contract is small: `package.json` with a `build` script that writes a static site to `dist/`, plus `info.yaml`, `config.yaml` (when `config: true`) and `index.html` with the setup block. `dev` and `typecheck` scripts are optional; `yarn typecheck` runs the ones that exist.
- Any framework works. Keep Vite's `base: "./"` (Tokio serves the overlay under `/<id>/`) and `build.license` (it writes `THIRD_PARTY_LICENSES.md` into the build). Keep the setup block in the HTML template.
- The setup block must be written exactly `<script id="tokio-setup">`, with no other attributes. Tokio finds it with a regex and rewrites it with the overlay's ID and saved settings. Its `__OVERLAY_CONFIG__` defaults must match `config.yaml`.
- `info.yaml` and `config.yaml` stay at the overlay's root, not in `public/`; the build copies them into `dist/`. Don't set `external` in `info.yaml`, Tokio sets it.
- Every section, field and column name, option label and placeholder in `config.yaml` gets its Spanish next to it (`translations: { es: … }`), in Tokio's Spanish (its `.claude/rules/i18n.md` and `es-419.json`), with a text shared by several overlays translated the same in each. A setting that does nothing for some values of another gets a `when`, checked against the code. The template shows the translations.
- `package.json` needs a `description` (shown in the catalog). Its `version` must equal `info.yaml`'s; Yarn 1 ignores workspaces without one.
- Connect with `window.__OVERLAY_ID__ || new URLSearchParams(location.search).get("id")`, as the template does, so dev and imported builds work without edits.
- Overlays use `@tokioapp/overlay` (`../tokio-event-loader`, MIT) from npm, bundled into the build. Don't load it from a CDN, so overlays work offline and pin the version they were tested with.
- Read config values defensively (`typeof config.title === "string"`): `ConfigData` values can be strings, numbers, booleans, gifts or a table's rows (objects of cells keyed by column id).
- `glow-jar`'s jars are pictures, so each frame works out only the gifts. `src/jars/<id>/` holds `back.png` and `front.png`, behind and over the gifts' canvas, and `walls.png`, the glass painted solid and open across the mouth, all the same size at twice the stage's scale. `src/jars/trace.ts` reads `walls.png` once at load into the edges the gifts collide with; each row may cross the glass once on each side. It's imported `?inline`, so its pixels can be read in Tokio's previews, which load from `local-resource:`. `back-tint.png` and `front-tint.png` hold how much of each pixel the jar's own `color` made, and `src/jars/tint.ts` repaints the layers in the main color at load and when it changes; it loads them with CORS, which Tokio's previews allow. The jar's `index.ts` holds its size, color and sparkles (drawn in code, behind the gifts), where the tag and bubbles attach and what the tag's cord is (a ribbon or a rope), and `?edges` draws the traced edges over the pictures. The gifts drop through the narrowest opening above the jar's `bodyTop`, so a flared rim like the crystal bowl's sizes them by its neck. The `jar` setting picks one of `JARS` (`src/jars/index.ts`), or `?jar=<id>` while developing: a new jar is a folder, an entry there and an option in `config.yaml`.

## Shared code

- Code two or more overlays use lives in `packages/shared`, the workspace `@tokio-overlays/shared`. Code only one overlay uses stays in its folder.
- An overlay lists `"@tokio-overlays/shared": "*"` first in its `dependencies` and imports files by path: `@tokio-overlays/shared/streaks`, `@tokio-overlays/shared/card/style.css`. Inside the package, files import each other relatively.
- It's TypeScript and CSS with no build of its own: each overlay's build bundles what it imports. Vite leaves it out of `THIRD_PARTY_LICENSES.md`, which lists only `node_modules`.
- Its `package.json` says only its CSS has side effects, so a build drops the modules it doesn't use. A module's top level only declares things: work a value out in the function that uses it, as `medal()` does its rosette, or every overlay importing the module bundles the work.
- What it holds:
  - At its root: the settings readers, colors, icons, the sample viewers and gifts' type, `Streaks` (what a gift event adds to its sender's combo) and small helpers (`util.ts`).
  - `entrances.ts`: how fan-level's banner and now-playing's card come in and leave. Each passes its own wipe radius. `ENTRANCES` must match the entrance options in both `config.yaml` files.
  - `card/`: the card last-gift and biggest-gift run, `startCard({ id, title, rule })`. The rule, `"last"` or `"biggest"`, decides which gift takes the card, whether a hidden card comes back when its gift is sent again, and the demo. The card's markup stays in each overlay's `index.html`, the same in both, and its defaults (`card/config.ts`) must match both `config.yaml` files.
  - `jar/`: the jars' physics engine (`Jar`, which bends the gifts behind the glass only for a design with `lenses`), the tally, gift pictures, geometry and shapes, and the app gift-jar and magic-jar run (`startJarApp`, given their jars and colors). glow-jar keeps its own page and uses the rest. Each overlay keeps its jar designs in `src/jars/`.
- Shared code gets what differs between overlays as arguments: a rule, a radius, the jars, the colors. Saved state stays under each overlay's own key (`<overlay id>:<overlayId>`).
- A change to shared code changes every overlay that bundles it. Check each one, and bump the ones `yarn release:build` warns about.

## Releases

- One `v<version>` tag (root `package.json`) publishes one release. It attaches only the overlays that are new or whose `info.yaml` version changed since the latest published release. Every release carries the full `overlays.json`, which points each overlay at the release holding its current zip.
- **To ship a change to an overlay, bump its version** in `info.yaml` and `package.json`. `release:build` warns when an overlay's build or `preview.png` changed since its release without a bump, including through `packages/shared` or a dependency; the change won't ship.
- **Bump the first number only for a breaking change**, one the PR template's box describes (streamers have to set the overlay up again). Tokio installs every other new version in the background and asks the streamer before this one (`catalogState` in Tokio's `src/common/util/catalog.ts`). Feat bumps the minor, fix the patch.
- **Never delete or replace old releases or their assets.** The catalog links to them.
- The base catalog is `https://github.com/tokio-app/overlays/releases/latest/download/overlays.json`. That URL needs no API call and has no rate limit. Prereleases (`-` in the version) are marked as such, so `latest` skips them.
- An entry is reused when the base has the same version from another release. A rerun of a release whose catalog is already published rebuilds what that release holds. Zips use a fixed date and sorted entries, so the same files give the same sha256, on Windows and Linux alike. `release:build` compares an unchanged version's zip with the catalog's hash to tell its build changed, so upgrading fflate or changing the zip options makes every overlay look changed.
- `--release` (the workflow) fails when nothing changed or the base can't be read. Without it, both are only logged, so CI passes with no overlays.
- GitHub allows 1,000 assets per release (a zip and a preview per overlay). `release:build` fails above that; release fewer overlays per tag.
- Asset names are fixed: `<id>.zip`, `<id>.png`, `overlays.json`. Tokio and the website depend on them and on the catalog's fields.
- After publishing a release that isn't a prerelease, the workflow sends a `repository_dispatch` (`release`) to `tokio-app/website`, which rebuilds its Overlays page. That needs the `WEBSITE_DISPATCH_TOKEN` secret (Contents read and write on `tokio-app/website`); without it the step only warns.
- Catalog format (`CatalogSchema` in `scripts/release.js`, documented in `README.md`): adding a field is fine. Renaming or removing one needs a new `CATALOG_SCHEMA`, and Tokio and the website must handle both.
- Release steps: bump the changed overlays' versions and the root version, commit (`chore(release): <version>`), push the tag `v<version>`.

## Keeping in sync with Tokio

- `scripts/lib/schema.js` mirrors `OverlayMetaSchema` (`tokio/src/common/schemas/store.ts`), `OverlayConfigSchema` (`tokio/src/common/schemas/overlay.ts`) and `SCRIPT_REGEX` (`tokio/src/main/services/overlay/common/index.ts`). Update it when those change.
- `validate.js` mirrors `processOverlay` and `hasSetupBlock` (same file as `SCRIPT_REGEX`). If Tokio's import accepts or rejects something new, follow it.
- Tokio installs from the catalog (`tokio/src/main/services/overlay/common/catalog.ts`). It reads schema 1 and checks each zip's size and SHA-256 against the catalog. It only downloads zips and previews from this repo's release URLs (`https://github.com/tokio-app/overlays/releases/download/`), and drops entries whose id isn't kebab-case or is `alerts`, `timer`, `games` or `studio`. An update keeps the settings whose field id and type are unchanged, so keep field ids stable across versions. A table also keeps its cells by column id and type, so keep column ids stable too.
- A new setting type works only from the Tokio release that adds it, since older versions refuse any `config.yaml` with it. Don't tag a release with an overlay that uses one before that Tokio release is out.
- `when` (a field shown only while earlier fields have certain values) and `translations` (beside each name, option label and placeholder, by language code) don't wait for a release: older Tokio versions ignore them, showing every field in English, and a save there writes `config.yaml` without them until the next update. The website's `building-an-overlay` docs describe both.
- The LIVE events in `.github/ISSUE_TEMPLATE/overlay_request.yml` mirror `TOKIO_EVENTS` (the `tokio:event:*` ones). Keep the server port (`37891`) and event names as Tokio has them.

## Licensing

- The repo's own code is MIT (`LICENSE`). `scripts/lib/schema.js` and `scripts/release-notes/` are copied from Tokio, whose source is MIT too.
- Check the license of every dependency you add or upgrade, in overlays too: it ships inside the zips. Ask before adding anything copyleft (GPL, AGPL, LGPL, MPL, CC BY-SA), including fonts, images and sounds.
- Assets you add (images, fonts, sounds) must be ours or under a license that allows redistribution; note third-party ones in the overlay's folder.
- Don't use TikTok's logo or branding in overlays or previews. Tokio is not affiliated with TikTok or ByteDance. The one exception, which the user approved, is TikTok in Social Links' list of platforms, so a streamer can list a TikTok account there. Its preview still shows no TikTok.

## Conventions

- Prettier (2 spaces, double quotes, semicolons, trailing commas) and oxlint `--type-aware`, run by lint-staged at commit. Fix lint warnings in code you touch; use type guards instead of casts on `unknown`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/), scoped to the overlay they change (`feat(gift-goal): ...`) or `shared` for `packages/shared`, enforced by commitlint in a husky hook. Don't bypass hooks.
- Scripts are JS with JSDoc so they run without a build step; `yarn typecheck` checks them with `tsc` (`checkJs`). Spawn yarn through `yarn()` in `scripts/lib/overlays.js` so it works on Windows.
