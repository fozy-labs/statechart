import { Signal, useConstant, useSignal } from "@fozy-labs/rx-toolkit";
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";

import { collectGuardsForEvent, collectOutgoingEvents } from "../core/configWalk";
import { computeEdgeStatuses } from "../core/edgeStatus";
import { formatStateValue, projectActiveIds } from "../core/stateValue";
import {
    createSourceMachine,
    looksLikeMarkdown,
    resolveDiagramSource,
    type SourceMachine,
} from "../playground/createSourceMachine";
import { BASE_CSS } from "../styles";
import type { StatechartVizProps, VizMachine, VizSnapshot } from "../types";

import { VizContext, VizStoreContext, type StatechartVizApi } from "./context";
import { cx } from "./cx";
import { appendLog, timeStamp } from "./log";
import { payloadResult, withAddedRow, withJson, withMode, withRemovedRow, withRow } from "./payload";
import { createVizStore, type VizStore } from "./store";
import { useDiagram } from "./useDiagram";

export type StatechartVizRootProps = StatechartVizProps & {
    className?: string;
    style?: CSSProperties;
    /**
     * Skip the built-in stylesheet; the host styles the `scv-*` class names
     * and `data-scv-*` attributes itself. The per-diagram interaction rules
     * (cursors, highlight strokes) are still injected — they are scoped to
     * the rendered SVG and read `--scv-*` custom properties the host can set.
     */
    unstyled?: boolean;
    /**
     * The store to drive, from `StatechartViz.createStore()`. Pass one to
     * read or write the selection, the log and the payload from outside
     * React; `Root` then treats it as the host's — it is never replaced, not
     * even when the machine changes, where `Root`'s own store would have
     * started over (`store.reset()` does that by hand).
     */
    store?: VizStore;
    /** Custom layout built from `StatechartViz.*` parts; the default layout otherwise. */
    children?: ReactNode;
};

/**
 * The provider of the compound API: resolves the machine (`machine` prop, or
 * the `source` pipeline), renders the diagram, owns selection / log / payload
 * and exposes it all through `useStatechartViz`. Without children it renders
 * the default layout the monolithic `<StatechartViz />` always rendered.
 */
export function VizRoot({
    className,
    style,
    unstyled,
    store,
    children,
    defaultChildren,
    ...props
}: StatechartVizRootProps & {
    defaultChildren: ReactNode;
}) {
    const resolved = useResolvedMachine(props as StatechartVizProps);
    const vizStore = useVizStoreInstance(resolved.machine, store);
    const api = useVizApi(resolved, vizStore);
    return (
        <div className={cx("scv", className)} style={style} data-scv-root="">
            {!unstyled && <style>{BASE_CSS}</style>}
            <VizStoreContext.Provider value={vizStore}>
                <VizContext.Provider value={api}>{children ?? defaultChildren}</VizContext.Provider>
            </VizStoreContext.Provider>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Machine resolution (the `machine` prop, or the `source` pipeline)
// ---------------------------------------------------------------------------

type ResolvedMachine = {
    machine: VizMachine | null;
    /** Mermaid text to render; empty while a markdown block is being resolved. */
    diagramSource: string;
    notice: string | null;
    title: string;
};

type SourceState =
    { phase: "loading" } | { phase: "ready"; machine: SourceMachine } | { phase: "error"; message: string };

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * `source` mode: the pipeline runs once per source text, in an effect. The
 * machine lives as long as its text — a new text, an unmount (and StrictMode's
 * rehearsal) dispose it. Pipeline failures and runtime errors of bodies go to
 * the notice. In `machine` mode all the source hooks are inert.
 */
function useResolvedMachine(props: StatechartVizProps): ResolvedMachine {
    const isMachineMode = "machine" in props;
    const propMachine = isMachineMode ? props.machine : null;
    const source = isMachineMode ? null : props.source;
    const machineId = isMachineMode ? undefined : props.machineId;
    const onMachine = isMachineMode ? undefined : props.onMachine;

    const state$ = useConstant(() => Signal.state<SourceState>({ phase: "loading" }), [source, machineId]);
    const runtimeError$ = useConstant(() => Signal.state<string | null>(null), [source, machineId]);
    // A markdown document renders the selected block, known once the converter
    // is loaded; a plain `.mmd` text renders at once (empty = still resolving).
    const diagram$ = useConstant(
        () => Signal.state(source !== null && looksLikeMarkdown(source) ? "" : (source ?? "")),
        [source, machineId],
    );
    const onMachineRef = useRef(onMachine);
    useLayoutEffect(() => {
        onMachineRef.current = onMachine;
    });

    useEffect(() => {
        if (source === null || !looksLikeMarkdown(source)) return;
        let cancelled = false;
        void resolveDiagramSource(source, machineId).then(
            (text) => {
                if (!cancelled) diagram$.set(text);
            },
            // A converter that fails to load fails the pipeline below too, and that failure is the notice.
            () => undefined,
        );
        return () => {
            cancelled = true;
        };
    }, [source, machineId, diagram$]);

    useEffect(() => {
        if (source === null) return;
        let cancelled = false;
        let machine: SourceMachine | null = null;
        createSourceMachine(source, {
            machineId,
            onError: (error) => runtimeError$.set(`Runtime error: ${messageOf(error)}`),
        }).then(
            (created) => {
                if (cancelled) {
                    created.dispose();
                    return;
                }
                machine = created;
                state$.set({ phase: "ready", machine: created });
                onMachineRef.current?.(created);
            },
            (error: unknown) => {
                if (!cancelled) state$.set({ phase: "error", message: messageOf(error) });
            },
        );
        return () => {
            cancelled = true;
            if (machine) {
                machine.dispose();
                onMachineRef.current?.(null);
            }
        };
    }, [source, machineId, state$, runtimeError$]);

    const sourceState = useSignal(state$);
    const runtimeError = useSignal(runtimeError$);
    const resolvedDiagram = useSignal(diagram$);

    if (isMachineMode) {
        const machine = propMachine as VizMachine;
        return {
            machine,
            diagramSource: machine.definition.source ?? machine.definition.toMermaid(),
            notice: null,
            title: props.title ?? machine.definition.id,
        };
    }
    const machine = sourceState.phase === "ready" ? sourceState.machine : null;
    return {
        machine,
        diagramSource: resolvedDiagram,
        notice: sourceState.phase === "error" ? sourceState.message : runtimeError,
        title: props.title ?? machine?.definition.id ?? "statechart",
    };
}

// ---------------------------------------------------------------------------
// The store and the API object
// ---------------------------------------------------------------------------

/**
 * The host's store when it gave one, a fresh one per machine otherwise: a
 * `Root`-owned store starts over with the machine it belongs to, since a
 * selection and a log of another machine mean nothing for this one.
 */
function useVizStoreInstance(machine: VizMachine | null, external: VizStore | undefined): VizStore {
    const own = useConstant(createVizStore, [machine]);
    return external ?? own;
}

function useMachineSnapshot(machine: VizMachine | null): VizSnapshot | null {
    const signalLike = useMemo(
        () => (machine ? { obs: machine.obs, peek: () => machine() } : { obs: NEVER_SNAPSHOT.obs, peek: () => null }),
        [machine],
    );
    return useSignal(signalLike);
}

const NEVER_SNAPSHOT = Signal.state<VizSnapshot | null>(null);

function useVizApi(resolved: ResolvedMachine, store: VizStore): StatechartVizApi {
    const { machine, diagramSource, notice, title } = resolved;
    const snapshot = useMachineSnapshot(machine);
    const selectedId = useSignal(store.selected$);
    const log = useSignal(store.log$);
    const payloadState = useSignal(store.payload$);
    const diagram = useDiagram(diagramSource);

    const payload = payloadResult(payloadState);
    const activeIds = snapshot ? projectActiveIds(snapshot.value) : new Set<string>();
    // The event is built exactly as in `send`: a payload key named `type` never wins over the event type.
    const canSend = (type: string): boolean =>
        machine !== null && payload.ok && machine.can({ ...payload.value, type });

    const edgeStatuses = computeEdgeStatuses(
        diagram.phase === "ready" ? diagram.index.edges : [],
        activeIds,
        machine !== null && payload.ok ? canSend : null,
    );

    const send = (type: string): boolean => {
        if (!machine || !payload.ok) return false;
        const event = { ...payload.value, type };
        const from = formatStateValue(machine().value);
        const accepted = machine.can(event);
        if (accepted) machine.send(event);
        const to = formatStateValue(machine().value);
        const reason = accepted ? undefined : refusalReason(machine, type);
        store.log$.update((entries) => appendLog(entries, { time: timeStamp(), event, from, to, accepted, reason }));
        return accepted;
    };

    const outgoing = machine && selectedId ? collectOutgoingEvents(machine.definition.config, selectedId) : [];

    return {
        machine,
        store,
        snapshot,
        title,
        notice,
        diagram,
        activeIds,
        edgeStatuses,
        selectedId,
        select: (id) => store.selected$.set(id),
        outgoing,
        canSend,
        send,
        log,
        clearLog: () => store.log$.set([]),
        payload: {
            state: payloadState,
            result: payload,
            setMode: (mode) => store.payload$.update((state) => withMode(state, mode)),
            setJson: (text) => store.payload$.update((state) => withJson(state, text)),
            setRow: (id, patch) => store.payload$.update((state) => withRow(state, id, patch)),
            addRow: () => store.payload$.update(withAddedRow),
            removeRow: (id) => store.payload$.update((state) => withRemovedRow(state, id)),
        },
    };
}

/** Guard names of the refused event's candidate transitions, in `[name]` label notation. */
function refusalReason(machine: VizMachine, type: string): string | undefined {
    const guards = collectGuardsForEvent(machine.definition.config, projectActiveIds(machine().value), type);
    return guards.length === 0 ? undefined : guards.map((name) => `[${name}]`).join(" ");
}
