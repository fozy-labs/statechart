import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// How the two `@fozy-labs` dependencies reach this package in the workspace:
//
// - `@fozy-labs/rx-toolkit` is an ordinary installed package (the registry
//   build, linked into this package's own `node_modules` by pnpm), and it
//   resolves the same `react` / `rxjs` instances this package uses — its
//   peer ranges are satisfied from here, so there is nothing to dedupe.
// - `@fozy-labs/statechart-converter` is the workspace link
//   `node_modules/@fozy-labs/statechart-converter` → `../converter` (the
//   `workspace:^` protocol), resolved through its `exports` to the built
//   `dist/`: build the converter before this package (the root scripts do).
//   Vite treats a linked package as source — served from `dist/` as is,
//   never pre-bundled, a rebuilt `dist` is picked up without `--force`. Its
//   `typescript` import (a CommonJS package) is found by the dependency
//   scanner at server start, through the literal
//   `import("@fozy-labs/statechart-converter")` of
//   `playground/createSourceMachine`, and pre-bundled before the first
//   request; the lazy load in `source` mode therefore does not trigger a
//   "new dependencies optimized" reload (the e2e suite would catch one).
export default defineConfig({
    plugins: [react()],
    server: { port: 3100, strictPort: false },
    build: {
        lib: {
            entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
            formats: ["es"],
            fileName: "index",
        },
        sourcemap: true,
        rollupOptions: {
            // The converter and its `typescript` dependency are loaded lazily by
            // `source` mode and must never end up in the library bundle.
            external: [
                "react",
                "react-dom",
                "react/jsx-runtime",
                "rxjs",
                "mermaid",
                "@fozy-labs/rx-toolkit",
                "@fozy-labs/statechart-converter",
                "typescript",
            ],
        },
    },
});
