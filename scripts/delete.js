import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  errorCode,
  errorMessage,
  fail,
  findOverlays,
  ROOT,
  yarn,
} from "./lib/overlays.js";

// Deletes an overlay's folder, then updates yarn.lock. Refuses when the folder has changes git
// can't bring back, unless --force.
// Usage: yarn delete <id> [--force]
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { force: { type: "boolean", default: false } },
});
const [id] = positionals;

if (!id || positionals.length > 1) fail("Usage: yarn delete <id> [--force]");
if (id === "_template") {
  fail("overlays/_template is what yarn new copies, so it can't be deleted.");
}

try {
  const [overlay] = await findOverlays([id]);
  const path = `overlays/${id}`;

  const changes = git(["status", "--porcelain", "--", path]);
  if (changes === null && !values.force) {
    fail(
      `Unable to check ${path} for uncommitted changes. Pass --force to delete it anyway.`,
    );
  }
  if (changes && !values.force) {
    fail(
      `${path} has changes that aren't committed:\n${changes}\nCommit them first, or pass --force to delete them too.`,
    );
  }
  const tracked = !!git(["ls-files", "--", path]);

  try {
    await rm(overlay.dir, { recursive: true, force: true });
  } catch (error) {
    const code = errorCode(error);
    fail(
      code === "EBUSY" || code === "EPERM"
        ? `${path} is in use. Stop its dev server and try again.`
        : error,
    );
  }
  console.log(`Deleted ${path}.`);

  // Drops the packages only this overlay used.
  await yarn(["install", "--silent"], ROOT).catch((error) =>
    console.warn(
      `Unable to update yarn.lock, run yarn install: ${errorMessage(error)}`,
    ),
  );

  if (tracked) {
    console.log(
      `Restore it with: git checkout HEAD -- ${path}\nIf it was released, the next release drops it from overlays.json. Its zips in older releases stay.`,
    );
  }
} catch (error) {
  fail(error);
}

/**
 * Runs git in the repo and returns its trimmed output, or null when it fails.
 *
 * @param {string[]} args
 * @returns {string | null}
 */
function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
