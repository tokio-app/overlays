import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../..");
export const OVERLAYS_DIR = join(ROOT, "overlays");

// Overlay folder names: kebab-case. A leading underscore keeps it out of releases.
export const ID_REGEX = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @typedef {object} OverlayPackage
 * @property {string} name - The workspace name, `@tokio-overlays/<id>`.
 * @property {string} version - Must equal info.yaml's version.
 * @property {string} [description] - Shown in the catalog.
 * @property {Record<string, string>} [scripts]
 */

/**
 * @typedef {object} Overlay
 * @property {string} id - The folder name, also the zip's name and the catalog id.
 * @property {string} dir - The overlay's folder.
 * @property {string} dist - Its build output, the folder Tokio imports.
 * @property {boolean} released - Whether releases include it.
 * @property {OverlayPackage} pkg - Its package.json.
 */

/**
 * Every overlay in overlays/, sorted by id. Folders without a package.json are skipped.
 *
 * @returns {Promise<Overlay[]>}
 */
export async function listOverlays() {
  const entries = await readdir(OVERLAYS_DIR, { withFileTypes: true }).catch(
    () => [],
  );
  /** @type {Overlay[]} */
  const overlays = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const dir = join(OVERLAYS_DIR, entry.name);
    const pkg = await readJSON(join(dir, "package.json")).catch(() => null);
    if (!pkg) continue;
    overlays.push({
      id: entry.name,
      dir,
      dist: join(dir, "dist"),
      released: !entry.name.startsWith("_"),
      pkg,
    });
  }
  return overlays;
}

/**
 * The overlays with these ids, or every overlay without any.
 *
 * @param {string[]} ids
 * @returns {Promise<Overlay[]>}
 */
export async function findOverlays(ids) {
  const overlays = await listOverlays();
  if (ids.length === 0) return overlays;

  const missing = ids.filter((id) => !overlays.some((o) => o.id === id));
  if (missing.length > 0) {
    throw new Error(`No overlay named ${missing.join(", ")} in overlays/.`);
  }
  return overlays.filter((o) => ids.includes(o.id));
}

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/**
 * Runs yarn in a folder, with its output shown. Rejects when it fails.
 *
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<void>}
 */
export function yarn(args, cwd) {
  // Started through yarn, it's a JS file node can run, on every system.
  const execPath = process.env.npm_execpath;
  const child =
    execPath && /\.c?js$/.test(execPath)
      ? spawn(process.execPath, [execPath, ...args], { cwd, stdio: "inherit" })
      : // Otherwise let the shell find it (yarn.cmd on Windows).
        spawn(["yarn", ...args].join(" "), {
          cwd,
          stdio: "inherit",
          shell: true,
        });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`yarn ${args.join(" ")} exited with ${code}`)),
    );
  });
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A Node error's code, such as ENOENT.
 *
 * @param {unknown} error
 * @returns {string | undefined}
 */
export function errorCode(error) {
  return error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

/**
 * Prints an error and exits, for the CLI scripts.
 *
 * @param {unknown} error
 * @returns {never}
 */
export function fail(error) {
  console.error(errorMessage(error));
  process.exit(1);
}
