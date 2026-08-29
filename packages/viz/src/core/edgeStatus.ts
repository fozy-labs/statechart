import type { DiagramEdge } from "../core/mermaidGraph";

/**
 * Interactivity of a diagram edge, projected from the machine state:
 *
 * - `enabled` — event edge whose source state is active and whose event the
 *   machine accepts right now: clickable, sends the event;
 * - `blocked` — event edge whose source state is active but whose event the
 *   machine refuses (a guard, typically): clickable, logs the refusal;
 * - `inert` — everything else: non-event edges (`after`, `done`, `always`),
 *   edges out of inactive states, or no running machine.
 *
 * With an invalid payload nothing is sendable, and the reason lives at the
 * payload field, not on the diagram — every edge is `inert`.
 */
export type EdgeInteractivity = "enabled" | "blocked" | "inert";

export type EdgeStatusMap = ReadonlyMap<number, EdgeInteractivity>;

export function computeEdgeStatuses(
    edges: readonly DiagramEdge[],
    activeIds: ReadonlySet<string>,
    canSend: ((event: string) => boolean) | null,
): EdgeStatusMap {
    const statuses = new Map<number, EdgeInteractivity>();
    for (const edge of edges) {
        if (canSend === null || edge.label.trigger.kind !== "event" || !activeIds.has(edge.start)) {
            statuses.set(edge.index, "inert");
            continue;
        }
        statuses.set(edge.index, canSend(edge.label.trigger.event) ? "enabled" : "blocked");
    }
    return statuses;
}
