import { useSignal } from "@fozy-labs/rx-toolkit";
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StatechartViz } from "../StatechartViz";
import { createFakeVizMachine } from "../testing/FakeVizMachine";
import { doorFixture } from "../testing/fixtures/door";

import { useStatechartViz, useVizStore, type StatechartVizApi } from "./context";
import { createVizStore } from "./store";

/**
 * The store as the seam between `Root` and its host: who owns it, who may
 * write it, and what a component subscribed to one of its signals wakes up
 * for. The diagram is stubbed out — jsdom cannot render mermaid, and none of
 * this depends on the edges.
 */
vi.mock("./useDiagram", () => ({
    useDiagram: () => ({
        phase: "ready",
        svgId: "scv-test",
        svg: "<svg></svg>",
        index: { edges: [], byId: new Map() },
    }),
}));

const probe: { api: StatechartVizApi; store: unknown } = {
    api: null as unknown as StatechartVizApi,
    store: null,
};
/** Commits, counted in an effect — a re-render that reaches the DOM. */
const commits = { api: 0, log: 0 };

function ApiProbe() {
    const current = useStatechartViz();
    // Captured in an effect (not during render); tests read it after `act`.
    useEffect(() => {
        probe.api = current;
        commits.api += 1;
    });
    return null;
}

/** A host panel on the store alone — the shape `useStore` exists for. */
function LogProbe() {
    const store = useVizStore();
    const log = useSignal(store.log$);
    useEffect(() => {
        probe.store = store;
        commits.log += 1;
    });
    return <span data-testid="log-size">{log.length}</span>;
}

/** `useSignal` coalesces writes into a microtask notification. */
async function flush() {
    await act(async () => {
        await Promise.resolve();
    });
}

beforeEach(() => {
    commits.api = 0;
    commits.log = 0;
    probe.store = null;
});

describe("StatechartViz store", () => {
    it("drives the store it was given, and follows a write made from outside React", async () => {
        const store = StatechartViz.createStore();
        render(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)} store={store}>
                <StatechartViz.Events />
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        expect(probe.api.store).toBe(store);

        // React → store.
        await act(async () => {
            probe.api.select("locked");
        });
        expect(store.selected$()).toBe("locked");
        await act(async () => {
            probe.api.send("PICK_KEY");
        });
        expect(store.log$()).toHaveLength(1);
        expect(store.log$()[0]).toMatchObject({ accepted: true });

        // store → React: a write no component made still reaches the view.
        await act(async () => {
            store.selected$.set(null);
        });
        expect(probe.api.selectedId).toBe(null);
        expect(screen.getByText(/Click a state to list its events/)).toBeTruthy();
    });

    it("useStore wakes a consumer for its own signal only", async () => {
        render(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)}>
                <LogProbe />
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        const before = { ...commits };

        // A payload keystroke rebuilds the whole API object...
        await act(async () => {
            const row = probe.api.payload.state.rows[0];
            probe.api.payload.setRow(row.id, { key: "code", text: "12" });
        });
        expect(commits.api).toBeGreaterThan(before.api);
        expect(commits.log).toBe(before.log);
        expect(screen.getByTestId("log-size").textContent).toBe("0");

        // ...while `log$` is what the log panel is actually waiting for.
        await act(async () => {
            probe.api.send("PICK_KEY");
        });
        expect(commits.log).toBeGreaterThan(before.log);
        expect(screen.getByTestId("log-size").textContent).toBe("1");
    });

    it("useStore and the api agree on the instance Root created for itself", async () => {
        render(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)}>
                <LogProbe />
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        expect(probe.store).toBe(probe.api.store);
    });

    it("a Root-owned store starts over with the machine; a store passed in does not", async () => {
        const view = render(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)}>
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        await act(async () => {
            probe.api.select("locked");
        });
        const own = probe.api.store;

        view.rerender(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)}>
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        expect(probe.api.store).not.toBe(own);
        expect(probe.api.selectedId).toBe(null);

        const store = createVizStore();
        const hosted = render(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)} store={store}>
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        await act(async () => {
            probe.api.select("locked");
        });
        hosted.rerender(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)} store={store}>
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        expect(probe.api.store).toBe(store);
        expect(probe.api.selectedId).toBe("locked");
    });

    it("reset() puts selection, log and payload back", async () => {
        const store = createVizStore();
        render(
            <StatechartViz.Root machine={createFakeVizMachine(doorFixture)} store={store}>
                <ApiProbe />
            </StatechartViz.Root>,
        );
        await flush();
        await act(async () => {
            probe.api.select("locked");
            probe.api.payload.setRow(probe.api.payload.state.rows[0].id, { key: "code", text: "12" });
        });
        await act(async () => {
            probe.api.send("PICK_KEY");
        });
        expect(probe.api.log).toHaveLength(1);

        await act(async () => {
            store.reset();
        });
        expect(probe.api.selectedId).toBe(null);
        expect(probe.api.log).toEqual([]);
        expect(probe.api.payload.state.rows.map((r) => [r.key, r.text])).toEqual([["", ""]]);
    });

    it("useVizStore outside Root throws", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        function Bare() {
            useVizStore();
            return null;
        }
        expect(() => render(<Bare />)).toThrow(/StatechartViz.Root/);
        spy.mockRestore();
    });
});
