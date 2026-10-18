import { zipSync } from "fflate";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { buildOverlays } from "./lib/build.js";
import {
  errorCode,
  errorMessage,
  fail,
  listOverlays,
  readJSON,
  ROOT,
} from "./lib/overlays.js";

// Builds every overlay and prepares the next release in release/:
// - assets/: what the release uploads. A zip (and preview) for each overlay that's new or whose
//   version changed, and overlays.json, the catalog of every overlay.
// - changes.json: the new, updated and removed overlays, for the release notes.
//
// Usage: yarn release:build [--base <url | file | none>] [--release]
//   --base     The catalog to compare with. Defaults to the latest release's overlays.json.
//   --release  For the release workflow: fail when nothing changed or the base can't be read.
//
// An overlay whose version the base already has keeps its entry, which points at the release
// holding its zip. So a release only uploads what changed, and GitHub's limit of 1,000 assets
// per release applies to the changed overlays, not to all of them.

const CATALOG_SCHEMA = 1;

// overlays.json, read by Tokio and the website. Adding a field is fine; renaming or removing
// one is a breaking change that needs a new CATALOG_SCHEMA. Keep pack's output in this order.
const CatalogEntrySchema = z.object({
  // The overlay's folder name.
  id: z.string(),
  // From info.yaml.
  name: z.string(),
  version: z.string(),
  // From the overlay's package.json.
  description: z.string(),
  // Whether it has settings.
  config: z.boolean(),
  // The release holding its zip, and the zip's name, URL, size in bytes and SHA-256 (hex).
  release: z.string(),
  file: z.string(),
  url: z.string(),
  size: z.number(),
  sha256: z.string(),
  // Its preview image's URL.
  preview: z.string().nullable(),
});

const CatalogSchema = z.object({
  schema: z.literal(CATALOG_SCHEMA),
  // The release it was published with.
  release: z.string(),
  // Every overlay, sorted by id.
  overlays: z.array(CatalogEntrySchema),
});

/**
 * @typedef {z.infer<typeof CatalogEntrySchema>} CatalogEntry
 * @typedef {z.infer<typeof CatalogSchema>} Catalog
 * @typedef {import("./lib/overlays.js").Overlay} Overlay
 * @typedef {import("./lib/validate.js").OverlayInfo} OverlayInfo
 */
const MAX_ASSETS = 1000;
// Every zip entry gets this date, so the same files always make the same zip. fflate writes
// local time fields, so a local date gives the same bytes in every time zone.
const ZIP_DATE = new Date(2000, 0, 1);

const RELEASE_DIR = join(ROOT, "release");
const ASSETS_DIR = join(RELEASE_DIR, "assets");

const { values: args } = parseArgs({
  options: {
    base: { type: "string" },
    release: { type: "boolean", default: false },
  },
});

const pkg = await readJSON(join(ROOT, "package.json"));
const repo =
  process.env.GITHUB_REPOSITORY ??
  pkg.repository.url.match(/github\.com[/:](.+?)(?:\.git)?$/)[1];
/** @type {string} */
const version = pkg.version;

/** @param {string} file */
const downloadURL = (file) =>
  `https://github.com/${repo}/releases/download/v${version}/${file}`;

try {
  const base = await loadBase(
    args.base ??
      `https://github.com/${repo}/releases/latest/download/overlays.json`,
  );
  // A rerun of this release reads the catalog it already published: rebuild what it holds.
  const rerun = base?.release === version;
  const previous = new Map((base?.overlays ?? []).map((e) => [e.id, e]));

  const overlays = await listOverlays();
  const { built, failed } = await buildOverlays(overlays);
  if (failed.length > 0) {
    throw new Error(
      `\n${failed.length} overlay(s) failed: ${failed.join(", ")}`,
    );
  }

  await rm(RELEASE_DIR, { recursive: true, force: true });
  await mkdir(ASSETS_DIR, { recursive: true });

  /** @type {CatalogEntry[]} */
  const entries = [];
  const changes = {
    release: version,
    base: base?.release ?? null,
    rerun,
    /** @type {{ id: string, name: string, version: string }[]} */
    added: [],
    /** @type {{ id: string, name: string, from: string, to: string }[]} */
    updated: [],
    /** @type {{ id: string, name: string, version: string }[]} */
    removed: [],
    /** @type {string[]} */
    unchanged: [],
    /** @type {string[]} */
    warnings: [],
  };

  for (const overlay of overlays.filter((o) => o.released)) {
    const info = built.get(overlay.id);
    // Every overlay built, or the script stopped above.
    if (!info) continue;
    const old = previous.get(overlay.id);
    const description = overlay.pkg.description?.trim() ?? "";

    if (old && old.version === info.version && old.release !== version) {
      // Same zip as before. Only fields that live in the catalog alone are refreshed.
      entries.push({ ...old, description });
      changes.unchanged.push(overlay.id);
      const warning = unbumped(overlay, old);
      if (warning) changes.warnings.push(warning);
      continue;
    }

    entries.push(await pack(overlay, info, description));
    if (old) {
      changes.updated.push({
        id: overlay.id,
        name: info.name,
        from: old.version,
        to: info.version,
      });
    } else {
      changes.added.push({
        id: overlay.id,
        name: info.name,
        version: info.version,
      });
    }
  }

  for (const old of previous.values()) {
    if (!entries.some((e) => e.id === old.id)) {
      changes.removed.push({
        id: old.id,
        name: old.name,
        version: old.version,
      });
    }
  }

  /** @type {Catalog} */
  const catalog = {
    schema: CATALOG_SCHEMA,
    release: version,
    overlays: entries,
  };
  await writeFile(
    join(ASSETS_DIR, "overlays.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  await writeFile(
    join(RELEASE_DIR, "changes.json"),
    `${JSON.stringify(changes, null, 2)}\n`,
  );

  const assets = await readdir(ASSETS_DIR);
  if (assets.length > MAX_ASSETS) {
    throw new Error(
      `The release would have ${assets.length} assets, over GitHub's limit of ${MAX_ASSETS}. Release fewer overlays at a time.`,
    );
  }

  for (const warning of changes.warnings) annotate(warning);

  console.log(
    `\nv${version}: ${changes.added.length} new, ${changes.updated.length} updated, ${changes.removed.length} removed, ${changes.unchanged.length} unchanged. ${assets.length} asset(s) in release/assets.`,
  );

  const unchanged =
    JSON.stringify(entries) === JSON.stringify(base?.overlays ?? []);
  if (unchanged && !rerun) {
    const message = base
      ? `Nothing changed since v${base.release}. Bump an overlay's version to release it.`
      : "There are no overlays to release.";
    if (args.release) throw new Error(message);
    console.log(message);
  }
} catch (error) {
  fail(error);
}

/**
 * Reads the catalog to compare with. Null when there's none yet.
 *
 * @param {string} source - A URL, a file, or "none".
 * @returns {Promise<Catalog | null>}
 */
async function loadBase(source) {
  if (source === "none") return null;
  try {
    let data;
    if (/^https?:\/\//.test(source)) {
      const res = await fetch(source, { signal: AbortSignal.timeout(15_000) });
      if (res.status === 404) {
        console.log("No published catalog yet, so every overlay is new.");
        return null;
      }
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
      data = await res.json();
    } else {
      data = await readJSON(source);
    }
    const catalog = CatalogSchema.safeParse(data);
    if (!catalog.success) {
      throw new Error(`it isn't a schema ${CATALOG_SCHEMA} catalog`);
    }
    return catalog.data;
  } catch (error) {
    const message = `Unable to read the base catalog ${source}: ${errorMessage(error)}`;
    if (args.release) throw new Error(message, { cause: error });
    console.warn(`${message}. Every overlay counts as new.`);
    return null;
  }
}

/**
 * Zips a built overlay into release/assets, with its preview, and returns its catalog entry.
 * The files sit at the zip's root, so the extracted folder is the one Tokio imports.
 *
 * @param {Overlay} overlay
 * @param {OverlayInfo} info
 * @param {string} description
 * @returns {Promise<CatalogEntry>}
 */
async function pack(overlay, info, description) {
  /** @type {import("fflate").Zippable} */
  const files = {};
  for (const file of await listFiles(overlay.dist)) {
    files[file] = [
      await readFile(join(overlay.dist, file)),
      { mtime: ZIP_DATE },
    ];
  }
  const zip = zipSync(files, { level: 9 });
  const file = `${overlay.id}.zip`;
  await writeFile(join(ASSETS_DIR, file), zip);

  let preview = null;
  try {
    await copyFile(
      join(overlay.dir, "preview.png"),
      join(ASSETS_DIR, `${overlay.id}.png`),
    );
    preview = downloadURL(`${overlay.id}.png`);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }

  return {
    id: overlay.id,
    name: info.name,
    version: info.version,
    description,
    config: info.config,
    release: version,
    file,
    url: downloadURL(file),
    size: zip.length,
    sha256: createHash("sha256").update(zip).digest("hex"),
    preview,
  };
}

/**
 * Every file under a folder, as sorted paths with forward slashes.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"),
    )
    .sort();
}

/**
 * A warning when an overlay changed since the release holding its zip but kept its version,
 * since it won't ship and Tokio couldn't tell it was updated.
 *
 * @param {Overlay} overlay
 * @param {CatalogEntry} entry
 * @returns {string | null}
 */
function unbumped(overlay, entry) {
  try {
    execFileSync(
      "git",
      ["diff", "--quiet", `v${entry.release}`, "--", `overlays/${overlay.id}`],
      { cwd: ROOT, stdio: "ignore" },
    );
    return null;
  } catch (error) {
    // 1 means it changed. Anything else means the tag isn't here (a shallow clone).
    const changed =
      error instanceof Error && "status" in error && error.status === 1;
    if (!changed) return null;
    return `${overlay.id} changed since v${entry.release} but is still version ${entry.version}, so it won't ship. Bump its version in info.yaml and package.json.`;
  }
}

/** @param {string} message */
function annotate(message) {
  if (process.env.GITHUB_ACTIONS === "true")
    console.log(`::warning::${message}`);
  else console.warn(`Warning: ${message}`);
}
