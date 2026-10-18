import { defineConfig } from "vite";

export default defineConfig({
  // Tokio serves the overlay under /<overlay id>/, so assets need relative paths.
  base: "./",
  build: {
    // The licenses of the npm packages bundled into the overlay, shipped with it.
    license: { fileName: "THIRD_PARTY_LICENSES.md" },
  },
});
