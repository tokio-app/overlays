# Tokio Overlays

Overlays for [Tokio](https://tokio.ialfaro.com), the desktop app that makes your TikTok LIVE react to chat, gifts, likes and more. Each overlay is a web page that Tokio serves to OBS Studio, TikTok LIVE Studio or any streaming app that can show one.

This repository holds the overlays' source, one folder each, and publishes their builds as GitHub releases.

## Using an overlay

In Tokio, open the **Overlays** page, click **Official Overlays** and **Install** the overlay you want. When a new version is released, a dot appears on **Official Overlays** and the overlay's button changes to **Update**, which keeps your settings. The website's [Overlays page](https://tokio.ialfaro.com/overlays/) shows them all.

To add one by hand instead:

1. Open the [latest release](https://github.com/tokio-app/overlays/releases/latest), or the release `overlays.json` lists for the overlay you want, and download its zip.
2. Extract it.
3. In Tokio, import the extracted folder in **Settings → Imported Overlays**. Imported overlays don't get updates.

See [Adding an overlay](https://tokio.ialfaro.com/docs/guides/adding-an-overlay/) to show it on stream.

## Making an overlay

You need Node 24 or later and Yarn 1.

```sh
yarn install
yarn new gift-goal "Gift Goal"   # copies overlays/_template to overlays/gift-goal
yarn dev gift-goal               # dev server, open it with ?id=<test ID>
yarn build gift-goal             # builds overlays/gift-goal/dist and checks it
```

An overlay is a folder in `overlays/`. The folder's name is the overlay's id: kebab-case, and it never changes once released.

```
overlays/gift-goal/
├── package.json   # name @tokio-overlays/<id>, version, description, "build" script
├── info.yaml      # name, version and config, read by Tokio
├── config.yaml    # the settings streamers see in Tokio's gallery (optional)
├── preview.png    # shown in Tokio and on the website, 16:9 (optional)
├── index.html     # with the <script id="tokio-setup"> block
└── src/
```

Use any framework, or none. The only requirement is that `yarn build` writes a static site to `dist/` with relative asset paths. The template uses Vite with plain TypeScript. For React, Svelte or Vue, add the framework's Vite plugin to `vite.config.ts`, and keep `base: "./"` and the setup block in `index.html`.

The build copies `info.yaml` and `config.yaml` into `dist/`. It then runs the checks Tokio's import does: the YAML files against Tokio's schemas, the exact setup block, and relative asset paths. The `dist/` folder is ready to import into Tokio.

See [Building an overlay](https://tokio.ialfaro.com/docs/developers/building-an-overlay/) for `info.yaml`, `config.yaml`, the setup block and the [`@tokioapp/overlay`](https://www.npmjs.com/package/@tokioapp/overlay) library.

### Testing with Tokio

1. In Tokio, turn on **Settings → Overlay Server**.
2. On **Tools → Test Overlays**, create a test ID.
3. Run `yarn dev <id>` and open the page with `?id=<test ID>`, for example `http://localhost:5173/?id=<test ID>`.
4. Click **Test** in Tokio. It sends the overlay a sample of every LIVE event.

The template connects with `window.__OVERLAY_ID__` and falls back to the `id` in the URL, so there's nothing to change before you import it.

### Commands

```sh
yarn new <id> ["Name"]  # start an overlay from the template
yarn delete <id>        # delete an overlay (--force if it has uncommitted changes)
yarn dev <id>           # its dev server
yarn build [id...]      # build and check overlays (all of them without ids)
yarn typecheck          # tsc for the scripts and every overlay with a typecheck script
yarn lint               # oxlint
yarn format             # prettier
yarn release:build      # build everything and prepare the next release in release/
yarn release:notes      # print the next release's notes (after release:build)
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), scoped to the overlay they change: `feat(gift-goal): show the goal in coins`.

## Releases

One release covers every overlay that is new or changed. Overlays have their own versions, in `info.yaml` and `package.json`, which must match. An overlay is only released when its version changes.

To release:

1. Bump the version of each overlay you changed.
2. Bump `version` in the root `package.json`, then commit.
3. Push a matching tag:

   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```

The [Release](.github/workflows/release.yml) workflow checks and builds everything. It then publishes a release with:

- `<id>.zip` for each new or updated overlay, with its files at the root of the zip;
- `<id>.png`, its preview, when it has one;
- `overlays.json`, the catalog of every overlay.

Overlays that didn't change aren't uploaded again: the catalog points at the release that holds them. This keeps each release under GitHub's limit of 1,000 files.

After a release that isn't a prerelease, the workflow asks the website to rebuild, so its Overlays page shows the new catalog. That needs a `WEBSITE_DISPATCH_TOKEN` secret, a fine-grained token with Contents read and write on `tokio-app/website`. Without it, the release still goes out with a warning.

Prerelease versions such as `0.2.0-beta.1` are marked as prereleases, so the catalog URL below skips them. Don't delete old releases: the catalog links to their files.

To retire an overlay, run `yarn delete <id>` and release. The new catalog no longer lists it, and its zips in older releases stay downloadable.

### The catalog

The latest catalog is always at:

```
https://github.com/tokio-app/overlays/releases/latest/download/overlays.json
```

```json
{
  "schema": 1,
  "release": "0.2.0",
  "overlays": [
    {
      "id": "gift-goal",
      "name": "Gift Goal",
      "version": "1.1.0",
      "description": "A bar that fills up with gifts until it reaches a goal.",
      "config": true,
      "release": "0.2.0",
      "file": "gift-goal.zip",
      "url": "https://github.com/tokio-app/overlays/releases/download/v0.2.0/gift-goal.zip",
      "size": 18342,
      "sha256": "…",
      "preview": "https://github.com/tokio-app/overlays/releases/download/v0.2.0/gift-goal.png"
    }
  ]
}
```

| Field         | Description                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `schema`      | The catalog format. It changes only when a field is renamed or removed. |
| `release`     | The release this catalog was published with.                            |
| `id`          | The overlay's folder name. Stable across versions.                      |
| `name`        | From `info.yaml`.                                                       |
| `version`     | From `info.yaml`. Compare it to tell whether an overlay was updated.    |
| `description` | From the overlay's `package.json`.                                      |
| `config`      | Whether the overlay has settings.                                       |
| `release`     | The release that holds this version's zip.                              |
| `url`, `file` | Where to download the zip, and its name.                                |
| `size`        | The zip's size in bytes.                                                |
| `sha256`      | The zip's SHA-256, to check the download.                               |
| `preview`     | The preview image's URL, or `null`.                                     |

Read the catalog and the zips from a server, a build script or a desktop app, not from a browser page: GitHub's download links send no CORS headers.

## License

[MIT](LICENSE). The zips also carry the licenses of the npm packages bundled into each overlay, in `THIRD_PARTY_LICENSES.md`.
