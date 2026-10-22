import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    license: { fileName: "THIRD_PARTY_LICENSES.md" },
  },
});
