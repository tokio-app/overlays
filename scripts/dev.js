import { fail, findOverlays, yarn } from "./lib/overlays.js";

// Starts an overlay's dev server. Usage: yarn dev <id> [args for the dev script]
const [id, ...args] = process.argv.slice(2);
if (!id) fail("Usage: yarn dev <id>");

try {
  const [overlay] = await findOverlays([id]);
  if (!overlay.pkg.scripts?.dev) fail(`${id} has no "dev" script.`);
  console.log(
    "Connect it to Tokio with a test ID from Tools → Test Overlays: open the page with ?id=<test ID>.\n",
  );
  await yarn(["run", "--silent", "dev", ...args], overlay.dir);
} catch (error) {
  fail(error);
}
