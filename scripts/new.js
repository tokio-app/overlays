import { existsSync } from "node:fs";
import { cp, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseDocument } from "yaml";
import { fail, ID_REGEX, OVERLAYS_DIR, readJSON } from "./lib/overlays.js";

// Starts a new overlay from overlays/_template.
// Usage: yarn new <id> ["Name"]   (id in kebab-case, e.g. gift-goal)
const [id, name = titleCase(id ?? "")] = process.argv.slice(2);

if (!id || id.startsWith("_") || !ID_REGEX.test(id)) {
  fail(
    'Usage: yarn new <id> ["Name"], with the id in kebab-case, e.g. gift-goal.',
  );
}

const template = join(OVERLAYS_DIR, "_template");
const dir = join(OVERLAYS_DIR, id);
if (existsSync(dir)) fail(`overlays/${id} already exists.`);

try {
  await cp(template, dir, {
    recursive: true,
    filter: (src) => !["node_modules", "dist"].includes(basename(src)),
  });

  const pkgPath = join(dir, "package.json");
  const pkg = await readJSON(pkgPath);
  pkg.name = `@tokio-overlays/${id}`;
  pkg.version = "1.0.0";
  // Left empty so the build asks for one.
  pkg.description = "";
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const infoPath = join(dir, "info.yaml");
  const info = parseDocument(await readFile(infoPath, "utf8"));
  info.set("name", name);
  info.set("version", "1.0.0");
  await writeFile(infoPath, info.toString());

  const htmlPath = join(dir, "index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(
    htmlPath,
    html.replace(/<title>.*?<\/title>/, `<title>${name}</title>`),
  );
} catch (error) {
  fail(error);
}

console.log(`Created overlays/${id}. Next:
  - describe it in overlays/${id}/package.json ("description", shown in the catalog)
  - edit info.yaml, config.yaml and index.html's setup block
  - yarn dev ${id}`);

/** @param {string} value */
function titleCase(value) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
