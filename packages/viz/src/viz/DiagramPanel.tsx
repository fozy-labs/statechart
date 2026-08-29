import { useLayoutEffect, useRef } from "react";
import svgPanZoom from "svg-pan-zoom";

import { annotateSvg, applyHighlight, flashDeniedEdge, resolveClickTarget, type ClickTarget } from "../core/svgIndex";
import { diagramCss } from "../styles";

import { useStatechartViz, type StatechartVizApi } from "./context";
import { cx } from "./cx";
import type { PartProps } from "./parts";

/**
 * The rendered diagram with pan/zoom and click handling: a state click
 * toggles the selection, an enabled edge sends its event, a blocked edge
 * logs the refusal and blinks.
 */
export function VizDiagram({ className }: PartProps) {
    const api = useStatechartViz();
    const { diagram } = api;
    const hostRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const apiRef = useRef(api);
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

        const panZoom = svgPanZoom(svg, {
            controlIconsEnabled: true,
            fit: true,
            center: true,
            minZoom: 0.1,
            maxZoom: 20,
            zoomScaleSensitivity: 0.25,
            dblClickZoomEnabled: false,
        });
        const handleClick = (event: MouseEvent) => {
            const target = resolveClickTarget(event.target);
            if (target) onDiagramClick(apiRef.current, svg, target);
        };
        svg.addEventListener("click", handleClick);
        return () => {
            svg.removeEventListener("click", handleClick);
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
            {diagram.phase === "loading" && <div className="scv-message">Rendering diagram…</div>}
            {diagram.phase === "error" && <div className="scv-message scv-error">{diagram.message}</div>}
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
