import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// See vite.config.ts: the library is an installed package and the converter
// is the workspace link to its built `dist/` — nothing to dedupe or inline.
export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        setupFiles: ["src/__tests__/setup.ts"],
        pool: "forks",
    },
});
