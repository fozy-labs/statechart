import { Signal, useConstant, useSignal } from "@fozy-labs/rx-toolkit";
import { useEffect } from "react";

import { indexDiagram, loadMermaid, nextSvgId, renderDiagram, type DiagramIndex } from "../core/mermaidGraph";

export type DiagramState =
    | { phase: "loading" }
    | { phase: "ready"; svgId: string; svg: string; index: DiagramIndex }
    | { phase: "error"; message: string };

/** Renders the source once (per source text) through mermaid; the empty text means "not resolved yet". */
export function useDiagram(source: string): DiagramState {
    const state$ = useConstant(() => Signal.state<DiagramState>({ phase: "loading" }), [source]);
    useEffect(() => {
        if (source === "") return;
        let cancelled = false;
        const svgId = nextSvgId();
        (async () => {
            const mermaid = await loadMermaid();
            const index = await indexDiagram(mermaid, source);
            const svg = await renderDiagram(mermaid, svgId, source);
            if (!cancelled) state$.set({ phase: "ready", svgId, svg, index });
        })().catch((error: unknown) => {
            if (!cancelled)
                state$.set({ phase: "error", message: error instanceof Error ? error.message : String(error) });
        });
        return () => {
            cancelled = true;
        };
    }, [source, state$]);
    return useSignal(state$);
}
