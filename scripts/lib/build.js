import { copyFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { errorCode, errorMessage, yarn } from "./overlays.js";
import { validate } from "./validate.js";

// Copied next to the built index.html, so builds don't depend on a framework's public/ folder.
const META_FILES = ["info.yaml", "config.yaml"];

/**
 * @typedef {import("./overlays.js").Overlay} Overlay
 * @typedef {import("./validate.js").OverlayInfo} OverlayInfo
 */

/**
 * Builds each overlay into its dist/, copies its YAML files there and checks the result.
 * Keeps going after a failure, so every problem shows at once.
 *
 * @param {Overlay[]} overlays
 * @returns {Promise<{ built: Map<string, OverlayInfo>, failed: string[] }>} The info.yaml of each
 *   overlay that passed, by id, and the ids of those that didn't.
 */
export async function buildOverlays(overlays) {
  /** @type {Map<string, OverlayInfo>} */
  const built = new Map();
  /** @type {string[]} */
  const failed = [];

  for (const overlay of overlays) {
    console.log(`\n▸ ${overlay.id}`);
    const { info, errors } = await buildOverlay(overlay);
    if (!info || errors.length > 0) {
      failed.push(overlay.id);
      console.error(`✗ ${overlay.id}`);
      for (const error of errors) console.error(`  - ${error}`);
      continue;
    }
    built.set(overlay.id, info);
    console.log(`✓ ${overlay.id} ${info.version}`);
  }

  return { built, failed };
}

/**
 * @param {Overlay} overlay
 * @returns {Promise<{ info?: OverlayInfo, errors: string[] }>}
 */
async function buildOverlay(overlay) {
  if (!overlay.pkg.scripts?.build) {
    return { errors: ['package.json has no "build" script.'] };
  }

  // Files left from an older build would ship with this one.
  await rm(overlay.dist, { recursive: true, force: true });
  try {
    await yarn(["run", "--silent", "build"], overlay.dir);
  } catch (error) {
    return { errors: [errorMessage(error)] };
  }

  for (const file of META_FILES) {
    await copyFile(join(overlay.dir, file), join(overlay.dist, file)).catch(
      (error) => {
        if (errorCode(error) !== "ENOENT") throw error;
      },
    );
  }

  return validate(overlay);
}
