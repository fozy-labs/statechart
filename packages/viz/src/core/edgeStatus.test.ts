import { describe, expect, it } from "vitest";

import { computeEdgeStatuses } from "./edgeStatus";
import type { DiagramEdge } from "./mermaidGraph";
import { parseTransitionLabel } from "./transitionLabel";

function edge(index: number, start: string, end: string, label: string): DiagramEdge {
    return { index, id: `edge${index}`, start, end, label: parseTransitionLabel(label) };
}

const EDGES = [
    edge(0, "root_start", "locked", ""),
    edge(1, "locked", "open", "OPEN [hasKey]"),
    edge(2, "locked", "locked", "PICK_KEY / pickUp"),
    edge(3, "open", "locked", "CLOSE / drop"),
    edge(4, "green", "yellow", "after 3000"),
];

describe("computeEdgeStatuses", () => {
    it("splits event edges from an active state into enabled and blocked", () => {
        const statuses = computeEdgeStatuses(EDGES, new Set(["locked"]), (event) => event === "PICK_KEY");
        expect(statuses.get(1)).toBe("blocked");
        expect(statuses.get(2)).toBe("enabled");
        // Inactive source, non-event triggers, the initial edge: inert.
        expect(statuses.get(0)).toBe("inert");
        expect(statuses.get(3)).toBe("inert");
        expect(statuses.get(4)).toBe("inert");
    });

    it("everything is inert without a sendable machine (no machine / invalid payload)", () => {
        const statuses = computeEdgeStatuses(EDGES, new Set(["locked"]), null);
        expect([...statuses.values()].every((status) => status === "inert")).toBe(true);
    });
});
