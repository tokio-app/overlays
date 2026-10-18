import { fail, listOverlays, yarn } from "./lib/overlays.js";

// Runs a package script in every overlay that has it. Usage: node scripts/workspaces.js <script>
const script = process.argv[2];
if (!script) fail("Usage: node scripts/workspaces.js <script>");

/** @type {string[]} */
const failed = [];
for (const overlay of await listOverlays()) {
  if (!overlay.pkg.scripts?.[script]) continue;
  console.log(`▸ ${overlay.id}: ${script}`);
  await yarn(["run", "--silent", script], overlay.dir).catch(() =>
    failed.push(overlay.id),
  );
}
if (failed.length > 0) fail(`${script} failed in ${failed.join(", ")}`);
