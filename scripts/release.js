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

// One version of an overlay.
const VersionSchema = z.object({
  // From info.yaml.
  name: z.string(),
  version: z.string(),
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

const CatalogEntrySchema = z.object({
  // The overlay's folder name.
  id: z.string(),
  // Its newest version that every Tokio build runs. Released Tokio builds read only these
  // fields, and strip the ones they don't know.
  ...VersionSchema.shape,
  // From the overlay's package.json.
  description: z.string(),
  // From the overlay's package.json: the platforms it works on (tiktok, twitch, youtube, kick).
  // Optional, since catalogs published before it have none. Tokio reads a missing one as every
  // platform.
  platforms: z.array(z.string()).optional(),
  // Newer versions that need a newer Tokio, newest first, each with the first Tokio release that
  // runs it (info.yaml's tokio). Tokio picks the newest it can run, or the fields above.
  versions: z.array(VersionSchema.extend({ tokio: z.string() })).optional(),
});

const CatalogSchema = z.object({
  schema: z.literal(CATALOG_SCHEMA),
  // The release it was published with.
  release: z.string(),
  // Every overlay, sorted by id.
  overlays: z.array(CatalogEntrySchema),
});

/**
 * @typedef {z.infer<typeof VersionSchema>} Version
 * @typedef {Version & { tokio: string }} GatedVersion
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
    const platforms = overlay.pkg.platforms;
    const same = old && versionsOf(old).find((v) => v.version === info.version);

    if (same && same.release !== version) {
      // Same zip as before. Only fields that live in the catalog alone are refreshed.
      entries.push({ ...old, description, platforms });
      changes.unchanged.push(overlay.id);
      const warning = await unbumped(overlay, same);
      if (warning) changes.warnings.push(warning);
      continue;
    }

    const packed = await pack(overlay, info);
    if (info.tokio) {
      // shortcut: an entry needs top-level fields for released Tokio builds; allow versions-only
      // entries when a new overlay first needs a newer Tokio
      if (!old) {
        throw new Error(
          `${overlay.id} is new and its info.yaml sets tokio, but released Tokio builds read only an entry's top level, which needs a version every build runs. Release a first version without tokio.`,
        );
      }
      // Older builds keep the base's top level. A rerun replaces the version it built before.
      const versions = prune([
        { ...packed, tokio: info.tokio },
        ...(old.versions ?? []).filter((v) => v.version !== info.version),
      ]);
      entries.push({
        id: overlay.id,
        ...VersionSchema.parse(old),
        description,
        platforms,
        versions,
      });
    } else {
      if (old?.versions?.length) {
        changes.warnings.push(
          `${overlay.id} ${info.version} sets no tokio in info.yaml, so every Tokio build gets it and the versions that need a newer Tokio (${old.versions.map((v) => `${v.version} for ${v.tokio}`).join(", ")}) leave the catalog. Keep tokio in the versions after one that needs it.`,
        );
      }
      entries.push({ id: overlay.id, ...packed, description, platforms });
    }
    if (old) {
      changes.updated.push({
        id: overlay.id,
        name: info.name,
        from: versionsOf(old)[0].version,
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
      const [newest] = versionsOf(old);
      changes.removed.push({
        id: old.id,
        name: newest.name,
        version: newest.version,
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
 * Zips a built overlay into release/assets, with its preview, and returns its version's fields
 * in the catalog.
 *
 * @param {Overlay} overlay
 * @param {OverlayInfo} info
 * @returns {Promise<Version>}
 */
async function pack(overlay, info) {
  const zip = await zipDist(overlay);
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
    name: info.name,
    version: info.version,
    config: info.config,
    release: version,
    file,
    url: downloadURL(file),
    size: zip.length,
    sha256: sha256(zip),
    preview,
  };
}

/**
 * An entry's versions, newest first: those that need a newer Tokio, then the top level's.
 *
 * @param {CatalogEntry} entry
 * @returns {Version[]}
 */
function versionsOf(entry) {
  const top = VersionSchema.safeParse(entry);
  return [...(entry.versions ?? []), ...(top.success ? [top.data] : [])];
}

/**
 * Keeps the versions some Tokio would pick: Tokio runs the newest version it can, so one is left
 * only while every newer one needs a higher Tokio.
 *
 * @param {GatedVersion[]} list - Newest first.
 * @returns {GatedVersion[]}
 */
function prune(list) {
  /** @type {string | undefined} */
  let lowest;
  return list.filter(({ tokio }) => {
    const kept = lowest === undefined || compareVersions(tokio, lowest) < 0;
    if (kept) lowest = tokio;
    return kept;
  });
}

/**
 * Orders versions as semver does: 0.1.3-beta.2 < 0.1.3-beta.10 < 0.1.3 < 0.1.10. A copy of
 * Tokio's compareVersions (src/common/util/index.ts), which picks the version: keep the two
 * identical.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersions(a, b) {
  const [coreA, preA] = a.split("-");
  const [coreB, preB] = b.split("-");
  /** @param {string} x @param {string} y */
  const byNumbers = (x, y) => x.localeCompare(y, "en", { numeric: true });

  const core = byNumbers(coreA, coreB);
  if (core !== 0) return core;
  // A release comes after its own prereleases
  if (!preA && !preB) return 0;
  if (!preA) return 1;
  if (!preB) return -1;
  return byNumbers(preA, preB);
}

/**
 * A built overlay's zip. The files sit at its root, so the extracted folder is the one Tokio
 * imports, and the same files always make the same bytes.
 *
 * @param {Overlay} overlay
 * @returns {Promise<Uint8Array>}
 */
async function zipDist(overlay) {
  /** @type {import("fflate").Zippable} */
  const files = {};
  for (const file of await listFiles(overlay.dist)) {
    files[file] = [
      await readFile(join(overlay.dist, file)),
      { mtime: ZIP_DATE },
    ];
  }
  return zipSync(files, { level: 9 });
}

/** @param {Uint8Array} data */
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
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
 * since it won't ship and Tokio couldn't tell it was updated. The same files make the same zip,
 * so a new hash means its build changed, whether through its own code, packages/shared or a
 * dependency.
 *
 * @param {Overlay} overlay
 * @param {Version} entry - The catalog's version equal to the built one.
 * @returns {Promise<string | null>}
 */
async function unbumped(overlay, entry) {
  const changed =
    sha256(await zipDist(overlay)) !== entry.sha256 ||
    previewChanged(overlay, entry);
  if (!changed) return null;
  return `${overlay.id} changed since v${entry.release} but is still version ${entry.version}, so it won't ship. Bump its version in info.yaml and package.json.`;
}

/**
 * Whether the overlay's preview changed since the release holding its zip. It's the one file
 * that ships outside the zip.
 *
 * @param {Overlay} overlay
 * @param {Version} entry
 * @returns {boolean}
 */
function previewChanged(overlay, entry) {
  try {
    execFileSync(
      "git",
      [
        "diff",
        "--quiet",
        `v${entry.release}`,
        "--",
        `overlays/${overlay.id}/preview.png`,
      ],
      { cwd: ROOT, stdio: "ignore" },
    );
    return false;
  } catch (error) {
    // 1 means it changed. Anything else means the tag isn't here (a shallow clone).
    return error instanceof Error && "status" in error && error.status === 1;
  }
}

/** @param {string} message */
function annotate(message) {
  if (process.env.GITHUB_ACTIONS === "true")
    console.log(`::warning::${message}`);
  else console.warn(`Warning: ${message}`);
}
