import {
    ACTIVE_CLASS,
    BLOCKED_CLASS,
    DENIED_CLASS,
    EDGE_ATTR,
    ENABLED_CLASS,
    EVENT_ATTR,
    SELECTED_CLASS,
    STATE_ATTR,
} from "./core/svgIndex";

/**
 * Theme tokens: every colour of the component is a `--scv-*` custom property
 * declared on `.scv`, so a host re-themes (incl. dark) by overriding the
 * variables only.
 *
 * Since 0.3 the tokens also reach *inside* the mermaid SVG: the inert
 * topology is repainted onto `--scv-bg` / `--scv-border-strong` so that the
 * running state is the only filled node in the field. Mermaid's own theme
 * still supplies everything not listed here (geometry, arrowheads, edge
 * strokes), and `mermaid.initialize` is still never called.
 *
 * Each predicate owns one instrument, and no instrument carries two:
 *
 * | predicate            | instrument                          |
 * | -------------------- | ----------------------------------- |
 * | the machine is here  | the only filled node + heavy stroke |
 * | you picked this      | a dashed node stroke                |
 * | sendable now         | green stroke / green control border |
 * | refused by a guard   | amber dashed edge stroke            |
 * | something is broken  | red, and red is used for nothing else |
 */
export const THEME_TOKENS = {
    /** Diagram field, inputs, buttons. */
    "--scv-bg": "#fff",
    /**
     * Side-panel substrate. Equal to the field by default: a 2% plate under a
     * titled section separates nothing that the title and the spacing do not
     * already separate. Set it if the host wants panels to read as plates.
     */
    "--scv-panel": "#fff",
    /** Body text, and the labels inside the diagram. */
    "--scv-text": "#222",
    /** Secondary text: hints, log time, panel titles. */
    "--scv-muted": "#7a7a7a",
    /** Panel and diagram borders. */
    "--scv-border": "#d9d9d9",
    /** Edges of interactive controls, and the outline of an inert state. */
    "--scv-border-strong": "#b5b5b5",
    /**
     * The state the machine is in. Violet rather than red: for a developer a
     * red-outlined node reads "this state is faulty", and the predicate being
     * carried here is position, not failure. Red is left to `--scv-error`.
     */
    "--scv-active": "#6d28d9",
    /** Interior of the active state — the only filled node in the diagram. */
    "--scv-active-fill": "#e9dffb",
    /** Outline of the state the user clicked. */
    "--scv-selected": "#1a6ee0",
    /** Enabled (sendable) transitions and event buttons. */
    "--scv-enabled": "#1f8a3b",
    /** Guard-blocked transitions and the guard hints. */
    "--scv-blocked": "#b45309",
    /** Error text, and the `error` machine status. */
    "--scv-error": "#b00020",
} as const;

const tokenDeclarations = Object.entries(THEME_TOKENS)
    .map(([name, value]) => `    ${name}: ${value};`)
    .join("\n");

/** `var(--scv-x, <default>)` — the default keeps the diagram readable for `unstyled` hosts. */
function token(name: keyof typeof THEME_TOKENS): string {
    return `var(${name}, ${THEME_TOKENS[name]})`;
}

/**
 * Component styles, injected once per instance (unless `unstyled`). Colours
 * are CSS custom properties so hosts can re-theme without fighting
 * specificity.
 *
 * Spacing runs one progression — control padding 3, sibling rows 5, title to
 * content 9, group to group 15, column to field 16 — at a ratio of about 1.7
 * between steps. The final step is short of the progression on purpose: the
 * diagram's own border already separates the field from the column, so the
 * distance does not have to.
 */
export const BASE_CSS = `
.scv {
${tokenDeclarations}
    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--scv-text);
    display: flex;
    flex-direction: column;
    gap: 9px;
    min-height: var(--scv-min-height, 480px);
    height: 100%;
    box-sizing: border-box;
}
.scv *, .scv *::before, .scv *::after { box-sizing: inherit; }
.scv-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 9px; }
.scv-title { font-weight: 600; font-size: 13px; margin: 0; }
.scv-status { color: var(--scv-muted); }
.scv-status[data-scv-status="error"] { color: var(--scv-error); }
.scv-value { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 15px; font-weight: 600; color: var(--scv-active); }
.scv-body { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; flex: 1; min-height: 0; }
.scv-diagram { position: relative; border: 1px solid var(--scv-border); border-radius: 6px; background: var(--scv-bg); min-height: var(--scv-diagram-min-height, 420px); overflow: hidden; }
.scv-diagram > svg { display: block; width: 100%; height: 100%; }
.scv-message { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; color: var(--scv-muted); }
.scv-message.scv-error { color: var(--scv-error); white-space: pre-wrap; }
.scv-zoom { position: absolute; right: 9px; bottom: 9px; display: flex; flex-direction: column; border: 1px solid var(--scv-border); border-radius: 5px; background: var(--scv-bg); overflow: hidden; }
.scv-zoom-button { width: 24px; height: 24px; display: grid; place-items: center; padding: 0; font: 14px/1 system-ui, sans-serif; border: 0; background: transparent; color: var(--scv-muted); cursor: pointer; }
.scv-zoom-button + .scv-zoom-button { border-top: 1px solid var(--scv-border); }
.scv-zoom-button:hover { color: var(--scv-text); }
.scv-side { display: flex; flex-direction: column; gap: 15px; min-height: 0; overflow: auto; }
/* No plate by default: the title and the group spacing already separate a
   section. The two scrolling readouts keep a frame, because a list that
   clips at nothing has no boundary to clip against. */
.scv-panel { background: var(--scv-panel); }
.scv-panel[data-scv-log], .scv-panel[data-scv-context] { border: 1px solid var(--scv-border); border-radius: 6px; padding: 6px 9px; }
.scv-panel-title { margin: 0 0 9px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scv-muted); }
.scv-hint { margin: 0; color: var(--scv-muted); }
.scv-notice { margin: 0; color: var(--scv-error); white-space: pre-wrap; }
.scv-events { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 9px; }
.scv-event { font: inherit; padding: 3px 9px; border: 1px solid var(--scv-border-strong); border-radius: 4px; background: var(--scv-bg); color: inherit; cursor: pointer; }
/* Green is a code here, not an accent: it says "the machine takes this now",
   so it repeats on every sendable control and matches the enabled edges. */
.scv-event:not(:disabled) { border-color: var(--scv-enabled); color: var(--scv-enabled); }
.scv-event:hover:not(:disabled) { background: var(--scv-active-fill); }
.scv-event:disabled { cursor: not-allowed; opacity: 0.45; }
.scv-event-blocked:disabled { opacity: 1; border-color: var(--scv-blocked); color: var(--scv-blocked); }
.scv-event-guard { font-size: 11px; color: var(--scv-blocked); margin-left: 5px; }
.scv-payload-editor { margin-top: 9px; }
.scv-payload-head { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
.scv-payload-caption { color: var(--scv-muted); }
.scv-payload-toggle { display: inline-flex; border: 1px solid var(--scv-border); border-radius: 4px; overflow: hidden; }
.scv-payload-segment { font: inherit; font-size: 11px; padding: 2px 9px; border: 0; background: transparent; color: var(--scv-muted); cursor: pointer; }
.scv-payload-segment:disabled { cursor: not-allowed; opacity: 0.45; }
.scv-payload-segment-active { background: var(--scv-bg); color: var(--scv-text); }
.scv-payload { display: block; width: 100%; margin-top: 5px; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; border: 1px solid var(--scv-border-strong); border-radius: 4px; background: var(--scv-bg); color: inherit; }
.scv-payload-rows { display: flex; flex-direction: column; gap: 5px; margin-top: 5px; }
.scv-payload-row { display: grid; grid-template-columns: 2fr 3fr auto; gap: 5px; align-items: center; }
.scv-payload-key, .scv-payload-value { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 3px 5px; border: 1px solid var(--scv-border-strong); border-radius: 4px; background: var(--scv-bg); color: inherit; min-width: 0; }
.scv-payload-remove { font: inherit; border: 0; background: transparent; color: var(--scv-muted); cursor: pointer; padding: 0 5px; }
.scv-payload-remove:hover { color: var(--scv-error); }
.scv-payload-add { font: inherit; font-size: 12px; border: 0; background: transparent; color: var(--scv-muted); cursor: pointer; padding: 0; text-align: left; }
.scv-payload-add:hover { color: var(--scv-text); }
.scv-payload-error { margin: 5px 0 0; color: var(--scv-error); }
.scv-log { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow: auto; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.scv-log li { display: grid; grid-template-columns: auto 1fr; gap: 9px; align-items: baseline; }
.scv-log time { color: var(--scv-muted); }
.scv-log .scv-rejected { color: var(--scv-muted); }
.scv-context { margin: 0; max-height: 240px; overflow: auto; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
@keyframes scv-deny { 50% { opacity: 0.2; } }
`;

/**
 * Rules for one rendered diagram. Mermaid scopes its own rules with the svg id
 * (`#<svgId> .node rect`, specificity 1,1,1) and its `<style>` sits *after*
 * this one in the DOM, so every rule below has to **exceed** that specificity,
 * not match it — hence the extra class or element in each selector. Every
 * colour is a token with its default as the fallback: an `unstyled` host that
 * sets no variables still gets a readable diagram.
 *
 * Two layers, in order:
 *
 * 1. **The topology, de-charged.** Mermaid fills every node with the same
 *    lavender, which makes the running state one chip among N identical ones.
 *    Emptying the inert nodes onto the field colour is what buys the active
 *    state its exclusivity; the highlight below only spends it.
 * 2. **The live status**, which is the thing that changes between snapshots.
 *
 * Deliberately left to mermaid: edge strokes and arrowheads (they share one
 * marker definition, so a recoloured edge would keep a foreign arrowhead), the
 * graph geometry, and the label font — the boxes were measured with it at
 * render time, and restyling it afterwards overflows them. A host that wants
 * another face sets `fontFamily` through `mermaid.initialize`.
 */
export function diagramCss(svgId: string): string {
    const s = `#${svgId}`;
    const node = `${s} g.node`;
    const cluster = `${s} g.statediagram-cluster`;
    return `
${s} [${STATE_ATTR}] { cursor: pointer; }
${s} [${EDGE_ATTR}] { cursor: default; }
${s} [${EVENT_ATTR}].${ENABLED_CLASS} { cursor: pointer; }
${s} [${EDGE_ATTR}].${BLOCKED_CLASS} { cursor: not-allowed; }

/* 1 — the topology recedes: no node keeps a fill, so one can have it.
   Three node bodies to cover — a rect, a choice diamond nested in a bare
   \`g\`, and the \`[*]\` marker, whose ring and dot are two paths told apart
   by the presentation attribute mermaid wrote on them. */
${node} > rect.basic, ${node} > polygon { fill: ${token("--scv-bg")}; stroke: ${token("--scv-border-strong")}; }
${node} > g:not(.outer-path) > path { fill: ${token("--scv-bg")}; stroke: ${token("--scv-border-strong")}; }
${node} > g.outer-path > path[stroke="none"] { fill: ${token("--scv-bg")}; }
${node} > g.outer-path > path[fill="none"] { stroke: ${token("--scv-border-strong")}; }
${node} > g.outer-path > g > path[stroke="none"] { fill: ${token("--scv-border-strong")}; }
${node} > g.outer-path > g > path[fill="none"] { stroke: ${token("--scv-border-strong")}; }
${node} circle.state-start { fill: ${token("--scv-border-strong")}; stroke: ${token("--scv-border-strong")}; }
${node} span.nodeLabel { color: ${token("--scv-text")}; }
/* A composite is already bounded by its own outline and named by its label;
   a fill on top of that duplicates a separation that exists. */
${cluster} rect.outer { fill: none; stroke: ${token("--scv-border")}; }
${cluster}.statediagram-cluster rect.inner { fill: none; stroke: ${token("--scv-border")}; }
${cluster}.statediagram-cluster-alt rect.divider { fill: none; stroke: ${token("--scv-border")}; }
${cluster} .cluster-label { color: ${token("--scv-muted")}; }
/* The label plate stays — it occludes the line running under the text — but
   it carries the field colour and nothing else. */
${s} g.edgeLabel g.label rect { fill: ${token("--scv-bg")}; opacity: 1; }
${s} g.edgeLabel span.edgeLabel, ${s} g.edgeLabel span.edgeLabel p { background-color: ${token("--scv-bg")}; }
${s} g.edgeLabel .label div span.edgeLabel { color: ${token("--scv-muted")}; }

/* 2 — the live status. */
${node}.${ACTIVE_CLASS} > rect.basic, ${node}.${ACTIVE_CLASS} > polygon { fill: ${token("--scv-active-fill")}; stroke: ${token("--scv-active")}; stroke-width: 2.5px; }
${node}.${ACTIVE_CLASS} > g:not(.outer-path) > path { fill: ${token("--scv-active-fill")}; stroke: ${token("--scv-active")}; stroke-width: 2.5px; }
${node}.${ACTIVE_CLASS} > g.outer-path > path[fill="none"] { stroke: ${token("--scv-active")}; }
${node}.${ACTIVE_CLASS} > g.outer-path > g > path[stroke="none"] { fill: ${token("--scv-active")}; }
${node}.${ACTIVE_CLASS} > g.outer-path > g > path[fill="none"] { stroke: ${token("--scv-active")}; }
${node}.${ACTIVE_CLASS} span.nodeLabel { color: ${token("--scv-text")}; }
${cluster}.${ACTIVE_CLASS} rect.outer { stroke: ${token("--scv-active")}; stroke-width: 2.5px; }
${cluster}.${ACTIVE_CLASS} .cluster-label { color: ${token("--scv-active")}; }
/* Selection is the user's own mark, so it takes the dash and leaves the
   stroke colour to the machine: a node that is both stays violet. */
${node}.${SELECTED_CLASS}:not(.${ACTIVE_CLASS}) > rect.basic, ${node}.${SELECTED_CLASS}:not(.${ACTIVE_CLASS}) > polygon, ${node}.${SELECTED_CLASS}:not(.${ACTIVE_CLASS}) > g:not(.outer-path) > path { stroke: ${token("--scv-selected")}; stroke-width: 2px; }
${node}.${SELECTED_CLASS} > rect.basic, ${node}.${SELECTED_CLASS} > polygon, ${node}.${SELECTED_CLASS} > g:not(.outer-path) > path { stroke-dasharray: 4 3; }
${cluster}.${SELECTED_CLASS}:not(.${ACTIVE_CLASS}) rect.outer { stroke: ${token("--scv-selected")}; stroke-width: 2px; }
${cluster}.${SELECTED_CLASS} rect.outer { stroke-dasharray: 4 3; }
${s} path.transition.${ENABLED_CLASS} { stroke: ${token("--scv-enabled")}; stroke-width: 2px; }
${s} g.edgeLabel.${ENABLED_CLASS} .label div span.edgeLabel { color: ${token("--scv-enabled")}; text-decoration: underline; }
${s} path.transition.${BLOCKED_CLASS} { stroke: ${token("--scv-blocked")}; stroke-width: 2px; stroke-dasharray: 6 4; }
${s} g.edgeLabel.${BLOCKED_CLASS} .label div span.edgeLabel { color: ${token("--scv-blocked")}; }
${s} [${EDGE_ATTR}].${DENIED_CLASS} { animation: scv-deny 160ms linear 2; }
`;
}
