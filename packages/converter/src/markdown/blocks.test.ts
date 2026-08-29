import { describe, expect, it } from "vitest";

import { StatechartParseError } from "../StatechartParseError.js";

import { extractMermaidBlocks, findStatechartBlocks, selectStatechartBlock } from "./blocks.js";

const F = "```";
const F4 = "````";
const T = "~~~";

function document(...lines: string[]): string {
    return `${lines.join("\n")}\n`;
}

function failing(run: () => unknown): StatechartParseError {
    try {
        run();
    } catch (error) {
        if (error instanceof StatechartParseError) return error;
        throw error;
    }
    throw new Error("expected a StatechartParseError");
}

describe("extractMermaidBlocks", () => {
    it("returns the block text, its first line, its indentation and its info string", () => {
        const text = document("# Doc", "", `${F}mermaid`, "stateDiagram-v2", "[*] --> a", F, "", "after");
        expect(extractMermaidBlocks(text)).toEqual([
            { text: "stateDiagram-v2\n[*] --> a", line: 4, column: 0, info: "mermaid" },
        ]);
    });

    it("keeps the info string and accepts any case and any suffix", () => {
        const text = document(`${F}MERMAID title="Order flow"`, "stateDiagram-v2", F);
        expect(extractMermaidBlocks(text)).toEqual([
            { text: "stateDiagram-v2", line: 2, column: 0, info: 'MERMAID title="Order flow"' },
        ]);
    });

    it("returns every block of the document in source order", () => {
        const text = document(`${F}mermaid`, "one", F, "prose", `${F}mermaid`, "two", F);
        expect(extractMermaidBlocks(text).map((block) => [block.text, block.line])).toEqual([
            ["one", 2],
            ["two", 6],
        ]);
    });

    it("skips fences of other languages and does not read inside them", () => {
        const text = document(`${F}ts`, "// ```mermaid", "const a = 1;", F, `${F}mermaid`, "stateDiagram-v2", F);
        expect(extractMermaidBlocks(text)).toEqual([{ text: "stateDiagram-v2", line: 6, column: 0, info: "mermaid" }]);
    });

    it("reads a fence of three backticks inside a four-backtick block as content, not as a fence", () => {
        const text = document(`${F4}md`, `${F}mermaid`, "not a diagram", F, F4, `${F}mermaid`, "real", F);
        expect(extractMermaidBlocks(text)).toEqual([{ text: "real", line: 7, column: 0, info: "mermaid" }]);
    });

    it("supports tilde fences and a closing fence longer than the opening one", () => {
        const text = document(`${T}mermaid`, "stateDiagram-v2", `${T}~~`);
        expect(extractMermaidBlocks(text)).toEqual([{ text: "stateDiagram-v2", line: 2, column: 0, info: "mermaid" }]);
    });

    it("does not close a backtick fence with a tilde fence", () => {
        const text = document(`${F}mermaid`, "a", T, "b", F);
        expect(extractMermaidBlocks(text)).toEqual([{ text: "a\n~~~\nb", line: 2, column: 0, info: "mermaid" }]);
    });

    it("does not treat a closing fence with trailing text as a fence", () => {
        const text = document(`${F}mermaid`, "a", `${F} tail`, "b", F);
        expect(extractMermaidBlocks(text)[0]!.text).toBe("a\n``` tail\nb");
    });

    it("ignores a backtick fence whose info string contains a backtick (CommonMark)", () => {
        const text = document("```mermaid`", "stateDiagram-v2", F);
        expect(extractMermaidBlocks(text)).toEqual([]);
    });

    it("removes the indentation of the fence and reports it as the column offset", () => {
        const text = document("1. item", "", `  ${F}mermaid`, "  stateDiagram-v2", "      [*] --> a", `  ${F}`);
        expect(extractMermaidBlocks(text)).toEqual([
            { text: "stateDiagram-v2\n    [*] --> a", line: 4, column: 2, info: "mermaid" },
        ]);
    });

    it("does not recognise a fence indented by four spaces (an indented code block)", () => {
        const text = document(`    ${F}mermaid`, "    stateDiagram-v2", `    ${F}`);
        expect(extractMermaidBlocks(text)).toEqual([]);
    });

    it("reads CRLF documents", () => {
        const text = [`${F}mermaid`, "stateDiagram-v2", "[*] --> a", F].join("\r\n");
        expect(extractMermaidBlocks(text)).toEqual([
            { text: "stateDiagram-v2\n[*] --> a", line: 2, column: 0, info: "mermaid" },
        ]);
    });

    it("rejects an unterminated mermaid block at the line of its fence", () => {
        const error = failing(() => extractMermaidBlocks(document("# Doc", `${F}mermaid`, "stateDiagram-v2")));
        expect(error.message).toContain("unterminated");
        expect(error.line).toBe(2);
    });

    it("ignores an unterminated block of another language", () => {
        expect(extractMermaidBlocks(document("# Doc", `${F}ts`, "const a = 1;"))).toEqual([]);
    });
});

describe("findStatechartBlocks", () => {
    const doc = document(
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
        "  %%  @machine payment",
        "[*] --> idle",
        F,
    );

    it("keeps only the blocks that declare a machine and records id and line", () => {
        expect(findStatechartBlocks(doc).map((block) => [block.machineId, block.line, block.machineLine])).toEqual([
            ["order", 7, 8],
            ["payment", 13, 14],
        ]);
    });

    it("keeps a block whose @machine id is malformed, without an id (the parser reports it)", () => {
        const blocks = findStatechartBlocks(document(`${F}mermaid`, "stateDiagram-v2", "%% @machine 1bad", F));
        expect(blocks).toHaveLength(1);
        expect(blocks[0]!.machineId).toBeUndefined();
        expect(blocks[0]!.machineLine).toBe(3);
    });

    it("rejects two blocks declaring the same id", () => {
        const text = document(
            `${F}mermaid`,
            "stateDiagram-v2",
            "%% @machine m",
            F,
            `${F}mermaid`,
            "stateDiagram-v2",
            "%% @machine m",
            F,
        );
        const error = failing(() => findStatechartBlocks(text));
        expect(error.message).toBe("duplicate `%% @machine m` in the document (first declared at line 3)");
        expect(error.line).toBe(7);
    });
});

describe("selectStatechartBlock", () => {
    const doc = document(
        `${F}mermaid`,
        "stateDiagram-v2",
        "%% @machine order",
        F,
        `${F}mermaid`,
        "stateDiagram-v2",
        "%% @machine payment",
        F,
    );

    it("takes the first block when no machine is named", () => {
        expect(selectStatechartBlock(findStatechartBlocks(doc)).machineId).toBe("order");
    });

    it("takes the named block", () => {
        expect(selectStatechartBlock(findStatechartBlocks(doc), "payment").machineId).toBe("payment");
    });

    it("lists the available machines for an unknown name", () => {
        const error = failing(() => selectStatechartBlock(findStatechartBlocks(doc), "refund"));
        expect(error.message).toBe("no machine `refund` in the document (available: order, payment)");
    });

    it("reports a document without statechart blocks", () => {
        const error = failing(() => selectStatechartBlock(findStatechartBlocks(document("# Doc", "prose"))));
        expect(error.message).toContain("no ```mermaid block with a `%% @machine <id>` directive");
        expect(error.line).toBe(1);
    });
});
