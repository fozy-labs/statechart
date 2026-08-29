import { describe, expect, it } from "vitest";

import { StatechartParseError } from "../StatechartParseError.js";

import { findStatechartBlocks, selectStatechartBlock } from "./blocks.js";
import { convertMarkdown, convertStatechartBlock, parseMarkdown } from "./convert.js";

const F = "```";

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

const DOC = document(
    "# Order",
    "",
    `${F}mermaid`,
    "stateDiagram-v2",
    "%% @machine order",
    "[*] --> idle",
    "idle --> done: PAY",
    F,
    "",
    "Prose between the diagrams.",
    "",
    `${F}mermaid`,
    "stateDiagram-v2",
    "%% @machine payment",
    "[*] --> ready",
    F,
);

describe("parseMarkdown", () => {
    it("parses the first machine of the document", () => {
        expect(parseMarkdown(DOC).machineId).toBe("order");
    });

    it("parses the named machine", () => {
        expect(parseMarkdown(DOC, { machine: "payment" }).machineId).toBe("payment");
    });

    it("keeps the block text as the source of the machine", () => {
        expect(parseMarkdown(DOC).config.source).toBe(
            "stateDiagram-v2\n%% @machine order\n[*] --> idle\nidle --> done: PAY",
        );
    });
});

describe("convertMarkdown", () => {
    it("names the document and the machine in the header comment", () => {
        const { code } = convertMarkdown(DOC, { fileName: "docs/flows/order.md" });
        expect(code.split("\n")[0]).toBe("// AUTO-GENERATED from order.md (@machine order) — do not edit");
    });

    it("emits the named machine", () => {
        const { code, parsed } = convertMarkdown(DOC, { fileName: "order.md", machine: "payment" });
        expect(parsed.machineId).toBe("payment");
        expect(code).toContain('id: "payment"');
    });

    it("honours an explicit sourceLabel", () => {
        const { code } = convertMarkdown(DOC, { fileName: "order.md", sourceLabel: "custom" });
        expect(code.split("\n")[0]).toBe("// AUTO-GENERATED from custom — do not edit");
    });
});

describe("error positions", () => {
    it("reports a label error at its line and column in the document", () => {
        const text = document(
            "# Doc",
            "",
            `${F}mermaid`,
            "stateDiagram-v2",
            "%% @machine m",
            "[*] --> a",
            "a --> b: X / f; g",
            F,
        );
        const error = failing(() => convertMarkdown(text, { fileName: "doc.md" }));
        expect(error.message).toContain("`;` is not allowed");
        expect(error.format()).toBe(
            "7:15: `;` is not allowed: mermaid reads it as a statement separator (one statement per line)",
        );
    });

    it("shifts the column by the indentation of the fence", () => {
        const text = document(
            "1. A machine in a list:",
            "",
            `  ${F}mermaid`,
            "  stateDiagram-v2",
            "  %% @machine m",
            "  [*] --> a",
            "  a --> b: X / f; g",
            `  ${F}`,
        );
        const error = failing(() => convertMarkdown(text, { fileName: "doc.md" }));
        expect(error.format()).toBe(
            "7:17: `;` is not allowed: mermaid reads it as a statement separator (one statement per line)",
        );
    });

    it("reports a diagram error of the second block at its own position", () => {
        const text = document(
            `${F}mermaid`,
            "stateDiagram-v2",
            "%% @machine first",
            "[*] --> a",
            F,
            "",
            `${F}mermaid`,
            "stateDiagram-v2",
            "%% @machine second",
            "a --> b: X",
            F,
        );
        const error = failing(() => convertMarkdown(text, { fileName: "doc.md", machine: "second" }));
        expect(error.format()).toBe("8: the root of the diagram has no initial state: add `[*] --> <state>`");
    });

    it("reports an emitter error (a directive) at its line in the document", () => {
        const text = document(
            "# Doc",
            "",
            `${F}mermaid`,
            "stateDiagram-v2",
            "%% @machine m",
            "%% @context type: { total: number }",
            "[*] --> a",
            F,
        );
        const error = failing(() => convertMarkdown(text, { fileName: "doc.md" }));
        expect(error.format()).toBe("6: `@context type` requires `@context initial`");
    });

    it("keeps the path suffix of a scoped error", () => {
        const text = document(
            `${F}mermaid`,
            "stateDiagram-v2",
            "%% @machine m",
            "[*] --> a",
            "state a {",
            "    x --> y: E",
            "}",
            F,
        );
        const error = failing(() => convertMarkdown(text, { fileName: "doc.md" }));
        expect(error.format()).toBe("5: state `a` has no initial state: add `[*] --> <state>` (at a)");
    });
});

describe("positions of the parse result", () => {
    const text = document(
        "# Doc",
        "",
        `${F}mermaid`,
        "stateDiagram-v2",
        "%% @machine m",
        "%% @context type: { n: number }",
        "%% @context initial: { n: 0 }",
        "%% @guard ok: true",
        "[*] --> a",
        "a --> b: X [ok]",
        F,
    );

    it("moves directive and state lines to the document", () => {
        const parsed = parseMarkdown(text);
        expect(parsed.context.initial?.line).toBe(7);
        expect(parsed.guards.ok?.line).toBe(8);
        expect(parsed.states.map((state) => [state.path, state.line])).toEqual([
            ["a", 9],
            ["b", 10],
        ]);
    });

    it("keeps the block text as `config.source`, so the generated file is unchanged", () => {
        const { code, parsed } = convertMarkdown(text, { fileName: "doc.md" });
        expect(parsed.config.source.split("\n")[0]).toBe("stateDiagram-v2");
        expect(code).toContain("export const source = `stateDiagram-v2\n");
    });
});

describe("convertStatechartBlock", () => {
    it("converts a block selected by hand", () => {
        const block = selectStatechartBlock(findStatechartBlocks(DOC), "payment");
        expect(convertStatechartBlock(block, { fileName: "order.md" }).parsed.machineId).toBe("payment");
    });
});
