import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { errorMessage } from "./overlays.js";
import {
  OverlayConfigSchema,
  OverlayMetaSchema,
  SCRIPT_REGEX,
} from "./schema.js";

// A src or href starting with one slash. Tokio serves the overlay under /<id>/, so these don't
// resolve. Protocol-relative URLs (//cdn...) are fine.
const ABSOLUTE_PATH_REGEX = /\s(?:src|href)=["']?(\/(?!\/)[^"'\s>]*)/i;

/**
 * @typedef {import("zod").infer<typeof OverlayMetaSchema>} OverlayInfo
 * @typedef {import("./overlays.js").Overlay} Overlay
 */

/**
 * Checks a built overlay the way Tokio's import does (processOverlay and hasSetupBlock in
 * tokio's src/main/services/overlay/common/index.ts), plus what releases need.
 *
 * @param {Overlay} overlay
 * @returns {Promise<{ info?: OverlayInfo, errors: string[] }>} The parsed info.yaml and every problem found.
 */
export async function validate(overlay) {
  /** @type {string[]} */
  const errors = [];

  const files = await readdir(overlay.dist).catch(() => null);
  if (!files) return { errors: ["dist/ is missing. Did the build write it?"] };

  if (!overlay.pkg.description?.trim()) {
    errors.push("package.json needs a description, shown in the catalog.");
  }

  const info = await readYAML(overlay.dist, "info.yaml", errors);
  let parsedInfo;
  if (info !== undefined) {
    const res = OverlayMetaSchema.safeParse(info);
    if (res.success) {
      parsedInfo = res.data;
      if (res.data.version !== overlay.pkg.version) {
        errors.push(
          `info.yaml has version ${res.data.version} but package.json has ${overlay.pkg.version}. Keep them equal.`,
        );
      }
    } else {
      errors.push(...formatIssues("info.yaml", res.error));
    }
  }

  const hasConfig = files.includes("config.yaml");
  if (parsedInfo?.config) {
    const config = await readYAML(overlay.dist, "config.yaml", errors);
    if (config !== undefined) {
      const res = OverlayConfigSchema.safeParse(config);
      if (!res.success) errors.push(...formatIssues("config.yaml", res.error));
    }
  } else if (parsedInfo && hasConfig) {
    errors.push(
      "config.yaml is ignored unless info.yaml sets config: true. Set it, or delete config.yaml.",
    );
  }

  if (!files.includes("index.html")) {
    errors.push("index.html is missing from dist/.");
  } else {
    const html = await readFile(join(overlay.dist, "index.html"), "utf8");
    if (!SCRIPT_REGEX.test(html)) {
      errors.push(
        'index.html has no <script id="tokio-setup"> block. Tokio needs it written exactly like that, with no other attributes.',
      );
    }
    const absolute = html.match(ABSOLUTE_PATH_REGEX);
    if (absolute) {
      errors.push(
        `index.html loads ${absolute[1]}, an absolute path that won't resolve in Tokio. Use relative paths (base: "./" in Vite).`,
      );
    }
  }

  return { info: parsedInfo, errors };
}

/**
 * Reads a YAML file from a folder, adding to `errors` when it's missing or invalid.
 *
 * @param {string} dir
 * @param {string} file
 * @param {string[]} errors
 * @returns {Promise<unknown>} The parsed value, or undefined if it couldn't be read.
 */
async function readYAML(dir, file, errors) {
  let text;
  try {
    text = await readFile(join(dir, file), "utf8");
  } catch {
    errors.push(`${file} is missing.`);
    return undefined;
  }
  try {
    return parse(text);
  } catch (error) {
    errors.push(`${file} isn't valid YAML: ${errorMessage(error)}`);
    return undefined;
  }
}

/**
 * @param {string} file
 * @param {import("zod").ZodError} error
 * @returns {string[]}
 */
function formatIssues(file, error) {
  return error.issues.map(
    (issue) => `${file}: ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
}
