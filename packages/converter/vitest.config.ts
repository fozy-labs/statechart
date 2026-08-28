import { defineConfig } from "vitest/config";

// `@fozy-labs/rx-toolkit` is the installed package (see package.json): no
// alias — the tests exercise the same build a consumer gets.
export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts", "test/**/*.test.ts"],
        // mermaid is loaded once per worker with jsdom globals installed by test/mermaidOracle.ts
        pool: "forks",
        testTimeout: 60_000,
    },
});
