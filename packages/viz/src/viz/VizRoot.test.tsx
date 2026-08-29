import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DiagramEdge } from "../core/mermaidGraph";
import { parseTransitionLabel } from "../core/transitionLabel";
import { StatechartViz } from "../StatechartViz";
import { createFakeVizMachine } from "../testing/FakeVizMachine";
import { doorFixture } from "../testing/fixtures/door";

import { useStatechartViz, type StatechartVizApi } from "./context";

/**
 * The compound API over the fake `door` machine, with the mermaid rendering
 * stubbed out (jsdom cannot render mermaid; the `Diagram` part is covered by
 * the e2e suite). The stub mirrors the edges mermaid would index.
 */

function edge(index: number, start: string, end: string, label: string): DiagramEdge {
    return { index, id: `edge${index}`, start, end, label: parseTransitionLabel(label) };
}

const DOOR_EDGES = [
    edge(0, "root_start", "locked", ""),
    edge(1, "locked", "open", "OPEN [hasKey]"),
    edge(2, "locked", "locked", "PICK_KEY / pickUp"),
    edge(3, "open", "locked", "CLOSE / drop"),
];

vi.mock("./useDiagram", () => ({
    useDiagram: () => ({
        phase: "ready",
        svgId: "scv-test",
        svg: "<svg></svg>",
        index: { edges: DOOR_EDGES, byId: new Map(DOOR_EDGES.map((e) => [e.id, e])) },
    }),
}));

const probe: { api: StatechartVizApi } = { api: null as unknown as StatechartVizApi };

function Probe() {
    const current = useStatechartViz();
    // Captured in an effect (not during render); tests read it after `act`.
    useEffect(() => {
        probe.api = current;
    });
    return null;
}

function renderDoor() {
    const machine = createFakeVizMachine(doorFixture);
    const view = render(
        <StatechartViz.Root machine={machine}>
            <StatechartViz.Header />
            <StatechartViz.Events />
            <StatechartViz.Log />
            <Probe />
        </StatechartViz.Root>,
    );
    return { machine, view };
}

/** `useSignal` coalesces writes into a microtask notification. */
async function flush() {
    await act(async () => {
        await Promise.resolve();
    });
}

describe("StatechartViz compound API", () => {
    it("classifies edges: a failing guard blocks, others enable, the rest stay inert", async () => {
        renderDoor();
        await flush();
        expect(probe.api.edgeStatuses.get(1)).toBe("blocked");
        expect(probe.api.edgeStatuses.get(2)).toBe("enabled");
        expect(probe.api.edgeStatuses.get(0)).toBe("inert");
        expect(probe.api.edgeStatuses.get(3)).toBe("inert");

        await act(async () => {
            probe.api.send("PICK_KEY");
        });
        expect(probe.api.edgeStatuses.get(1)).toBe("enabled");
    });

    it("logs a refused event with its guard; the panel shows the guard on the blocked button", async () => {
        renderDoor();
        await flush();
        await act(async () => {
            probe.api.select("locked");
        });

        const open = screen.getByRole<HTMLButtonElement>("button", { name: /OPEN/ });
        expect(open.disabled).toBe(true);
        expect(open.textContent).toContain("⊘ hasKey");
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /PICK_KEY/ }).disabled).toBe(false);

        await act(async () => {
            expect(probe.api.send("OPEN")).toBe(false);
        });
        expect(probe.api.log[0]).toMatchObject({ accepted: false, reason: "[hasKey]" });
        expect(screen.getByText(/\[hasKey\]/)).toBeTruthy();
    });

    it("sends the form-mode payload merged into the event", async () => {
        renderDoor();
        await flush();
        expect(probe.api.payload.state.mode).toBe("form");

        await act(async () => {
            const row = probe.api.payload.state.rows[0];
            probe.api.payload.setRow(row.id, { key: "code", text: "12" });
        });
        await act(async () => {
            probe.api.send("PICK_KEY");
        });
        expect(probe.api.log[0].event).toEqual({ type: "PICK_KEY", code: 12 });
        expect(probe.api.log[0].accepted).toBe(true);
    });

    it("canSend and send agree when the payload carries a `type` key (the event type wins)", async () => {
        renderDoor();
        await flush();
        await act(async () => {
            const row = probe.api.payload.state.rows[0];
            probe.api.payload.setRow(row.id, { key: "type", text: "OPEN" });
        });

        // `OPEN` is guard-blocked in `locked`: if the payload's `type` won, both would refuse.
        expect(probe.api.canSend("PICK_KEY")).toBe(true);
        await act(async () => {
            expect(probe.api.send("PICK_KEY")).toBe(true);
        });
        expect(probe.api.log[0].event).toEqual({ type: "PICK_KEY" });
    });

    it("mode toggle: the JSON text edits the same payload; broken JSON freezes the Fields segment", async () => {
        renderDoor();
        await flush();
        fireEvent.click(screen.getByRole("button", { name: "JSON" }));
        await flush();
        const textarea = screen.getByLabelText<HTMLTextAreaElement>("Payload, a JSON object");
        expect(textarea.value).toBe("{}");

        fireEvent.change(textarea, { target: { value: "{ broken" } });
        await flush();
        expect(probe.api.payload.result.ok).toBe(false);
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Fields" }).disabled).toBe(true);

        fireEvent.change(textarea, { target: { value: '{ "a": 1 }' } });
        await flush();
        fireEvent.click(screen.getByRole("button", { name: "Fields" }));
        await flush();
        expect(probe.api.payload.state.rows.map((r) => [r.key, r.text])).toEqual([["a", "1"]]);
    });

    it("useStatechartViz outside Root throws", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        expect(() => render(<Probe />)).toThrow(/StatechartViz.Root/);
        spy.mockRestore();
    });
});
