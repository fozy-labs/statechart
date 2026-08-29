import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { convert } from "../convert.js";
import { convertMarkdown } from "../markdown/convert.js";

import { defaultOutputPath, runCli } from "./runCli.js";

const VALID = "stateDiagram-v2\n%% @machine m\n[*] --> a\na --> b: X\n";

const F = "```";

function markdown(...lines: string[]): string {
    return `${lines.join("\n")}\n`;
}

/** Two machines, `order` and `payment`, with prose and a foreign diagram around them. */
const DOC = markdown(
    "# Flows",
    "",
    `${F}mermaid`,
    "flowchart TD",
    "A --> B",
    F,
    "",
    `${F}mermaid`,
    "stateDiagram-v2",
    "%% @machine order",
    "[*] --> idle",
    F,
    "",
    `${F}mermaid`,
    "stateDiagram-v2",
    "%% @machine payment",
    "[*] --> ready",
    F,
);

interface Capture {
    io: { stdout: { write(text: string): void }; stderr: { write(text: string): void } };
    stdout(): string;
    stderr(): string;
}

function capture(): Capture {
    const out: string[] = [];
    const err: string[] = [];
    return {
        io: {
            stdout: { write: (text: string) => void out.push(text) },
            stderr: { write: (text: string) => void err.push(text) },
        },
        stdout: () => out.join(""),
        stderr: () => err.join(""),
    };
}

describe("defaultOutputPath", () => {
    it("replaces the extension with .generated.ts next to the input", () => {
        expect(defaultOutputPath(path.join("dir", "x.mmd"))).toBe(path.join("dir", "x.generated.ts"));
        expect(defaultOutputPath("x")).toBe("x.generated.ts");
        expect(defaultOutputPath("a.b.mmd")).toBe("a.b.generated.ts");
    });
});

describe("runCli", () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(path.join(os.tmpdir(), "sc-cli-"));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("writes <name>.generated.ts next to the input and prints its path", () => {
        const input = path.join(dir, "m.mmd");
        writeFileSync(input, VALID, "utf8");
        const { io, stdout, stderr } = capture();
        expect(runCli([input], io)).toBe(0);
        const output = path.join(dir, "m.generated.ts");
        expect(stdout()).toBe(`${output}\n`);
        expect(stderr()).toBe("");
        expect(readFileSync(output, "utf8")).toBe(convert(VALID, { fileName: input }).code);
    });

    it("honours --out and -o", () => {
        const input = path.join(dir, "m.mmd");
        writeFileSync(input, VALID, "utf8");
        const long = path.join(dir, "long.ts");
        const short = path.join(dir, "short.ts");
        expect(runCli([input, "--out", long], capture().io)).toBe(0);
        expect(runCli(["-o", short, input], capture().io)).toBe(0);
        expect(readFileSync(long, "utf8")).toBe(readFileSync(short, "utf8"));
    });

    it("prints the usage on --help / -h", () => {
        for (const flag of ["--help", "-h"]) {
            const { io, stdout, stderr } = capture();
            expect(runCli([flag], io)).toBe(0);
            expect(stdout()).toContain("Usage: statechart-convert <in.mmd|in.md> [options]");
            expect(stderr()).toBe("");
        }
    });

    it("returns 2 with the usage on stderr for bad arguments", () => {
        const input = path.join(dir, "m.mmd");
        writeFileSync(input, VALID, "utf8");
        for (const argv of [[], [input, input], [input, "--bogus"]]) {
            const { io, stdout, stderr } = capture();
            expect(runCli(argv, io)).toBe(2);
            expect(stdout()).toBe("");
            expect(stderr()).toMatch(/^error: /);
            expect(stderr()).toContain("Usage: statechart-convert");
        }
    });

    it("returns 1 when the input cannot be read", () => {
        const missing = path.join(dir, "missing.mmd");
        const { io, stderr } = capture();
        expect(runCli([missing], io)).toBe(1);
        expect(stderr()).toContain(`error: cannot read ${missing}`);
    });

    it("returns 1 and prints file:line:column: message for a conversion error", () => {
        const input = path.join(dir, "bad.mmd");
        writeFileSync(input, "stateDiagram-v2\n%% @machine m\n[*] --> a\na --> b: X / f; g\n", "utf8");
        const { io, stdout, stderr } = capture();
        expect(runCli([input], io)).toBe(1);
        expect(stdout()).toBe("");
        expect(stderr()).toBe(
            `${input}:4:15: \`;\` is not allowed: mermaid reads it as a statement separator (one statement per line)\n`,
        );
    });

    it("prints file:line: message for errors without a column (root scope: no path suffix)", () => {
        const input = path.join(dir, "bad.mmd");
        writeFileSync(input, "stateDiagram-v2\n%% @machine m\na --> b: X\n", "utf8");
        const { io, stderr } = capture();
        expect(runCli([input], io)).toBe(1);
        expect(stderr()).toBe(`${input}:1: the root of the diagram has no initial state: add \`[*] --> <state>\`\n`);
    });

    it("prints the path suffix for errors inside a block", () => {
        const input = path.join(dir, "bad.mmd");
        writeFileSync(input, "stateDiagram-v2\n%% @machine m\n[*] --> a\nstate a {\n    x --> y: E\n}\n", "utf8");
        const { io, stderr } = capture();
        expect(runCli([input], io)).toBe(1);
        expect(stderr()).toBe(`${input}:4: state \`a\` has no initial state: add \`[*] --> <state>\` (at a)\n`);
    });

    describe("markdown input", () => {
        function writeDoc(name: string, text: string = DOC): string {
            const input = path.join(dir, name);
            writeFileSync(input, text, "utf8");
            return input;
        }

        it("converts the first machine into <name>.generated.ts", () => {
            const input = writeDoc("flows.md");
            const { io, stdout } = capture();
            expect(runCli([input], io)).toBe(0);
            const output = path.join(dir, "flows.generated.ts");
            expect(stdout()).toBe(`${output}\n`);
            expect(readFileSync(output, "utf8")).toBe(convertMarkdown(DOC, { fileName: input }).code);
        });

        it("converts the named machine into <id>.generated.ts", () => {
            const input = writeDoc("flows.md");
            const { io, stdout } = capture();
            expect(runCli([input, "--machine", "payment"], io)).toBe(0);
            const output = path.join(dir, "payment.generated.ts");
            expect(stdout()).toBe(`${output}\n`);
            expect(readFileSync(output, "utf8")).toContain('id: "payment"');
        });

        it("honours a per-machine output path", () => {
            const input = writeDoc("flows.md");
            const first = path.join(dir, "a.ts");
            const second = path.join(dir, "b.ts");
            const { io, stdout } = capture();
            expect(runCli([input, "-m", `order=${first}`, "-m", `payment=${second}`], io)).toBe(0);
            expect(stdout()).toBe(`${first}\n${second}\n`);
            expect(readFileSync(first, "utf8")).toContain('id: "order"');
            expect(readFileSync(second, "utf8")).toContain('id: "payment"');
        });

        it("converts every machine with --all", () => {
            const input = writeDoc("flows.md");
            const { io, stdout } = capture();
            expect(runCli([input, "--all"], io)).toBe(0);
            expect(stdout()).toBe(
                `${path.join(dir, "order.generated.ts")}\n${path.join(dir, "payment.generated.ts")}\n`,
            );
        });

        it("reads any extension as markdown with --format md", () => {
            const input = writeDoc("flows.txt");
            expect(runCli([input, "--format", "md", "--all"], capture().io)).toBe(0);
            expect(existsSync(path.join(dir, "order.generated.ts"))).toBe(true);
        });

        it("returns 1 and lists the machines for an unknown --machine", () => {
            const input = writeDoc("flows.md");
            const { io, stderr } = capture();
            expect(runCli([input, "--machine", "refund"], io)).toBe(1);
            expect(stderr()).toBe(`${input}:1: no machine \`refund\` in the document (available: order, payment)\n`);
        });

        it("returns 1 for a document without statechart blocks", () => {
            const input = writeDoc("prose.md", "# Doc\n\ntext\n");
            const { io, stderr } = capture();
            expect(runCli([input], io)).toBe(1);
            expect(stderr()).toContain("no ```mermaid block with a `%% @machine <id>` directive");
        });

        it("reports errors at their position in the document and writes nothing", () => {
            const input = writeDoc(
                "flows.md",
                markdown(
                    "# Flows",
                    "",
                    `${F}mermaid`,
                    "stateDiagram-v2",
                    "%% @machine order",
                    "[*] --> idle",
                    F,
                    "",
                    `${F}mermaid`,
                    "stateDiagram-v2",
                    "%% @machine payment",
                    "ready --> paid: PAY",
                    F,
                ),
            );
            const { io, stdout, stderr } = capture();
            expect(runCli([input, "--all"], io)).toBe(1);
            expect(stdout()).toBe("");
            expect(stderr()).toBe(
                `${input}:10: the root of the diagram has no initial state: add \`[*] --> <state>\`\n`,
            );
            expect(existsSync(path.join(dir, "order.generated.ts"))).toBe(false);
        });

        it("returns 1 when two machines would be written to the same file", () => {
            const input = writeDoc("flows.md");
            const output = path.join(dir, "same.ts");
            const { io, stderr } = capture();
            expect(runCli([input, "-m", `order=${output}`, "-m", `payment=${output}`], io)).toBe(1);
            expect(stderr()).toBe(`error: two machines would be written to ${output}\n`);
        });

        it("returns 2 for argument combinations that cannot be honoured", () => {
            const md = writeDoc("flows.md");
            const mmd = path.join(dir, "m.mmd");
            writeFileSync(mmd, VALID, "utf8");
            const combinations = [
                [mmd, "--machine", "m"],
                [mmd, "--all"],
                [md, "--all", "--machine", "order"],
                [md, "--all", "--out", path.join(dir, "x.ts")],
                [md, "-m", "order", "-m", "payment", "-o", path.join(dir, "x.ts")],
                [md, "-m", `order=${path.join(dir, "x.ts")}`, "-o", path.join(dir, "y.ts")],
                [md, "-m", "order", "-m", "order"],
                [md, "-m", "=x.ts"],
                [md, "-m", "order="],
                [md, "--format", "html"],
            ];
            for (const argv of combinations) {
                const { io, stdout, stderr } = capture();
                expect(runCli(argv, io), argv.join(" ")).toBe(2);
                expect(stdout()).toBe("");
                expect(stderr()).toMatch(/^error: /);
            }
        });

        it("returns 1 for an unterminated mermaid fence", () => {
            const input = writeDoc("broken.md", markdown("# Doc", `${F}mermaid`, "stateDiagram-v2"));
            const { io, stderr } = capture();
            expect(runCli([input], io)).toBe(1);
            expect(stderr()).toContain(`${input}:2: unterminated`);
        });
    });
});
