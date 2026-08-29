import { createContext, useContext } from "react";

import type { OutgoingEvent } from "../core/configWalk";
import type { EdgeStatusMap } from "../core/edgeStatus";
import type { VizMachine, VizSnapshot } from "../types";

import type { LogEntry } from "./log";
import type { PayloadMode, PayloadResult, PayloadState } from "./payload";
import type { VizStore } from "./store";
import type { DiagramState } from "./useDiagram";

export type PayloadApi = {
    state: PayloadState;
    /** The object the current mode's input builds, or its error. */
    result: PayloadResult;
    setMode(mode: PayloadMode): void;
    setJson(text: string): void;
    setRow(id: number, patch: { key?: string; text?: string }): void;
    addRow(): void;
    removeRow(id: number): void;
};

/**
 * Everything `StatechartViz.Root` computes, exposed to the parts and to the
 * host through `useStatechartViz` — the headless surface: any part can be
 * replaced by a custom component built on this object.
 */
export type StatechartVizApi = {
    machine: VizMachine | null;
    /**
     * The store behind `selectedId`, `log` and `payload.state`. Reach for it
     * when a value is needed outside a render — for a subscription, or for a
     * write from non-React code; `useVizStore` is the way in for a component
     * that wants one signal and not the rest of this object.
     */
    store: VizStore;
    snapshot: VizSnapshot | null;
    title: string;
    /** Source-mode pipeline or runtime error, `null` otherwise. */
    notice: string | null;
    diagram: DiagramState;
    /** Mermaid ids of the active states (parents and children). */
    activeIds: ReadonlySet<string>;
    /** Interactivity of every diagram edge, by edge index. */
    edgeStatuses: EdgeStatusMap;
    selectedId: string | null;
    select(id: string | null): void;
    /** Events of the selected state (own and inherited), empty without a selection. */
    outgoing: OutgoingEvent[];
    /** Whether the machine accepts the event built from the current payload. */
    canSend(type: string): boolean;
    /**
     * Sends the event built from the current payload and logs the attempt;
     * a refused event is logged with the guard names. Returns acceptance.
     * A missing machine or an invalid payload is a silent no-op (`false`).
     */
    send(type: string): boolean;
    log: LogEntry[];
    clearLog(): void;
    payload: PayloadApi;
};

export const VizContext = createContext<StatechartVizApi | null>(null);

export const VizStoreContext = createContext<VizStore | null>(null);

/** The headless hook of the compound API; must be used under `StatechartViz.Root`. */
export function useStatechartViz(): StatechartVizApi {
    const api = useContext(VizContext);
    if (api === null) {
        throw new Error("useStatechartViz: no <StatechartViz.Root> above this component");
    }
    return api;
}

/**
 * The store `StatechartViz.Root` drives. Its identity is stable across the
 * Root's renders — unlike the `useStatechartViz` object, which is rebuilt on
 * every one of them — so a component reading a single signal off it wakes up
 * only for that signal:
 *
 * ```tsx
 * function MyLog() {
 *     const log = useSignal(StatechartViz.useStore().log$);
 *     return <ol>{log.map((e) => <li key={e.seq}>{e.event.type}</li>)}</ol>;
 * }
 * ```
 *
 * A `Root` that creates its own store replaces it when the machine changes;
 * a store passed into `Root` is never replaced.
 */
export function useVizStore(): VizStore {
    const store = useContext(VizStoreContext);
    if (store === null) {
        throw new Error("useVizStore: no <StatechartViz.Root> above this component");
    }
    return store;
}
