import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import svgPanZoom from "svg-pan-zoom";

import { annotateSvg, applyHighlight, flashDeniedEdge, resolveClickTarget, type ClickTarget } from "../core/svgIndex";
import { diagramCss } from "../styles";

import { useStatechartViz, type StatechartVizApi } from "./context";
import { cx } from "./cx";
import type { PartProps, SlotProps } from "./parts";

/**
 * Pan/zoom handle of the nearest rendered `Diagram`, for custom controls.
 * `reset` refits the whole diagram and re-enables the automatic refit on
 * container resize (a manual zoom or pan suspends it).
 */
export type DiagramControlsApi = {
    zoomIn(): void;
    zoomOut(): void;
    reset(): void;
};

const DiagramControlsContext = createContext<DiagramControlsApi | null>(null);

/** The handle for components rendered inside `Diagram`; `null` while no diagram is rendered. */
export function useDiagramControls(): DiagramControlsApi | null {
    return useContext(DiagramControlsContext);
}

/**
 * The rendered diagram with pan/zoom and click handling: a state click
 * toggles the selection, an enabled edge sends its event, a blocked edge
 * logs the refusal and blinks. The diagram follows the panel size (refit on
 * resize until the user zooms or pans; `reset` resumes following).
 *
 * `children` render over the diagram (the zoom controls by default; pass
 * `null` to drop them, or custom components on `useDiagramControls`).
 */
export function VizDiagram({ className, children }: SlotProps) {
    const api = useStatechartViz();
    const { diagram } = api;
    const hostRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const apiRef = useRef(api);
    const [controls, setControls] = useState<DiagramControlsApi | null>(null);
    useLayoutEffect(() => {
        apiRef.current = api;
    });

    useLayoutEffect(() => {
        const host = hostRef.current;
        if (!host || diagram.phase !== "ready") return;
        host.innerHTML = diagram.svg;
        const svg = host.querySelector("svg");
        if (!svg) return;
        // Mermaid sizes the svg for a document flow; the panel owns the size.
        svg.removeAttribute("height");
        svg.style.maxWidth = "";
        svg.style.width = "100%";
        svg.style.height = "100%";
        annotateSvg(svg, diagram.svgId, diagram.index);
        svgRef.current = svg;

        // `interacted` — the user zoomed or panned; the auto-refit stands off
        // until `reset`. `programmatic` masks our own fit/center calls, which
        // fire the same onZoom/onPan callbacks.
        let programmatic = false;
        let interacted = false;
        // The stock control icons (`controlIconsEnabled`) are drawn inside the
        // SVG at init-time coordinates and never follow the panel — the React
        // overlay (`DiagramControls`) replaces them.
        const panZoom = svgPanZoom(svg, {
            controlIconsEnabled: false,
            fit: true,
            center: true,
            minZoom: 0.1,
            maxZoom: 20,
            zoomScaleSensitivity: 0.25,
            dblClickZoomEnabled: false,
            onZoom: () => {
                if (!programmatic) interacted = true;
            },
            onPan: () => {
                if (!programmatic) interacted = true;
            },
        });
        const sized = () => host.clientWidth > 0 && host.clientHeight > 0;
        const withProgrammatic = (run: () => void) => {
            programmatic = true;
            try {
                run();
            } finally {
                programmatic = false;
            }
        };
        const refit = () =>
            withProgrammatic(() => {
                panZoom.resize();
                panZoom.fit();
                panZoom.center();
            });
        const observer = new ResizeObserver(() => {
            if (!sized()) return;
            if (interacted) {
                // Keep the user's viewport; only update the cached dimensions.
                withProgrammatic(() => panZoom.resize());
            } else {
                refit();
            }
        });
        observer.observe(host);
        setControls({
            // The un-masked onZoom marks the interaction.
            zoomIn: () => panZoom.zoomIn(),
            zoomOut: () => panZoom.zoomOut(),
            reset: () => {
                interacted = false;
                refit();
            },
        });

        const handleClick = (event: MouseEvent) => {
            const target = resolveClickTarget(event.target);
            if (target) onDiagramClick(apiRef.current, svg, target);
        };
        svg.addEventListener("click", handleClick);
        return () => {
            svg.removeEventListener("click", handleClick);
            observer.disconnect();
            setControls(null);
            panZoom.destroy();
            svgRef.current = null;
            host.innerHTML = "";
        };
    }, [diagram]);

    useLayoutEffect(() => {
        if (svgRef.current) {
            applyHighlight(svgRef.current, {
                activeIds: api.activeIds,
                selectedId: api.selectedId,
                edgeStatuses: api.edgeStatuses,
            });
        }
    });

    return (
        <div className={cx("scv-diagram", className)} data-scv-diagram={diagram.phase}>
            {diagram.phase === "ready" && <style>{diagramCss(diagram.svgId)}</style>}
            <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
            <DiagramControlsContext.Provider value={controls}>
                {children === undefined ? <VizDiagramControls /> : children}
            </DiagramControlsContext.Provider>
            {diagram.phase === "loading" && <div className="scv-message">Rendering diagram…</div>}
            {diagram.phase === "error" && <div className="scv-message scv-error">{diagram.message}</div>}
        </div>
    );
}

/** Zoom controls of the diagram: an HTML overlay in the panel corner, themed like the rest. */
export function VizDiagramControls({ className }: PartProps) {
    const controls = useDiagramControls();
    if (controls === null) return null;
    return (
        <div className={cx("scv-zoom", className)} data-scv-zoom="">
            <button
                type="button"
                className="scv-zoom-button"
                data-scv-zoom-in=""
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => controls.zoomIn()}
            >
                +
            </button>
            <button
                type="button"
                className="scv-zoom-button"
                data-scv-zoom-out=""
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => controls.zoomOut()}
            >
                −
            </button>
            <button
                type="button"
                className="scv-zoom-button"
                data-scv-zoom-reset=""
                title="Fit diagram"
                aria-label="Fit diagram"
                onClick={() => controls.reset()}
            >
                ⤢
            </button>
        </div>
    );
}

function onDiagramClick(api: StatechartVizApi, svg: SVGSVGElement, target: ClickTarget): void {
    if (target.kind === "state") {
        api.select(api.selectedId === target.id ? null : target.id);
        return;
    }
    if (api.diagram.phase !== "ready") return;
    const status = api.edgeStatuses.get(target.index);
    if (status !== "enabled" && status !== "blocked") return;
    const edge = api.diagram.index.edges[target.index];
    if (edge?.label.trigger.kind !== "event") return;
    const accepted = api.send(edge.label.trigger.event);
    if (!accepted) flashDeniedEdge(svg, target.index);
}
