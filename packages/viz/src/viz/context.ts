import { createContext, useContext } from "react";

import type { OutgoingEvent } from "../core/configWalk";
import type { EdgeStatusMap } from "../core/edgeStatus";
import type { VizMachine, VizSnapshot } from "../types";

import type { LogEntry } from "./log";
import type { PayloadMode, PayloadResult, PayloadState } from "./payload";
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

/** The headless hook of the compound API; must be used under `StatechartViz.Root`. */
export function useStatechartViz(): StatechartVizApi {
    const api = useContext(VizContext);
    if (api === null) {
        throw new Error("useStatechartViz: no <StatechartViz.Root> above this component");
    }
    return api;
}
