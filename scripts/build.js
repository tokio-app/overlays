import { buildOverlays } from "./lib/build.js";
import { fail, findOverlays } from "./lib/overlays.js";

// Builds overlays into their dist/ folders and checks each one the way Tokio's import does.
// Usage: yarn build [id...]   (without ids: every overlay, the template included)
try {
  const overlays = await findOverlays(process.argv.slice(2));
  const { failed } = await buildOverlays(overlays);
  if (failed.length > 0)
    fail(`\n${failed.length} overlay(s) failed: ${failed.join(", ")}`);
  console.log(`\nBuilt ${overlays.length} overlay(s).`);
} catch (error) {
  fail(error);
}
