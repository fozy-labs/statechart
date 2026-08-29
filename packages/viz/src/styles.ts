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
 * variables only. The interior of the mermaid SVG (state fills, edge default
 * strokes) is mermaid's own theme and is not covered.
 */
export const THEME_TOKENS = {
    /** Diagram field, inputs, buttons. */
    "--scv-bg": "#fff",
    /** Side-panel substrate. */
    "--scv-panel": "#fafafa",
    /** Body text. */
    "--scv-text": "#222",
    /** Secondary text: hints, log time, panel titles. */
    "--scv-muted": "#7a7a7a",
    /** Panel and diagram borders. */
    "--scv-border": "#d9d9d9",
    /** Edges of interactive controls (buttons, inputs). */
    "--scv-border-strong": "#b5b5b5",
    /** Active state outline. */
    "--scv-active": "#d0342c",
    /** Active state fill. */
    "--scv-active-fill": "#fff0ee",
    /** Selected state outline. */
    "--scv-selected": "#1a6ee0",
    /** Enabled (sendable) transitions and event buttons. */
    "--scv-enabled": "#1f8a3b",
    /** Guard-blocked transitions and the guard hints. */
    "--scv-blocked": "#b45309",
    /** Error text. */
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
 */
export const BASE_CSS = `
.scv {
${tokenDeclarations}
    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--scv-text);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 480px;
    height: 100%;
    box-sizing: border-box;
}
.scv *, .scv *::before, .scv *::after { box-sizing: inherit; }
.scv-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }
.scv-title { font-weight: 600; font-size: 15px; margin: 0; }
.scv-status { color: var(--scv-muted); }
.scv-value { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.scv-body { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 8px; flex: 1; min-height: 0; }
.scv-diagram { position: relative; border: 1px solid var(--scv-border); border-radius: 6px; background: var(--scv-bg); min-height: 420px; overflow: hidden; }
.scv-diagram > svg { display: block; width: 100%; height: 100%; }
.scv-message { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; color: var(--scv-muted); }
.scv-message.scv-error { color: var(--scv-error); white-space: pre-wrap; }
.scv-side { display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow: auto; }
.scv-panel { border: 1px solid var(--scv-border); border-radius: 6px; padding: 8px 10px; background: var(--scv-panel); }
.scv-panel-title { margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scv-muted); }
.scv-hint { margin: 0; color: var(--scv-muted); }
.scv-notice { margin: 0; color: var(--scv-error); white-space: pre-wrap; }
.scv-events { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 6px; }
.scv-event { font: inherit; padding: 4px 9px; border: 1px solid var(--scv-border-strong); border-radius: 4px; background: var(--scv-bg); color: inherit; cursor: pointer; }
.scv-event:hover:not(:disabled) { border-color: var(--scv-enabled); color: var(--scv-enabled); }
.scv-event:disabled { cursor: not-allowed; opacity: 0.45; }
.scv-event-blocked:disabled { opacity: 1; border-color: var(--scv-blocked); }
.scv-event-guard { font-size: 11px; color: var(--scv-blocked); margin-left: 6px; }
.scv-payload-editor { margin-top: 6px; }
.scv-payload-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.scv-payload-caption { color: var(--scv-muted); }
.scv-payload-toggle { display: inline-flex; border: 1px solid var(--scv-border); border-radius: 4px; overflow: hidden; }
.scv-payload-segment { font: inherit; font-size: 11px; padding: 2px 8px; border: 0; background: transparent; color: var(--scv-muted); cursor: pointer; }
.scv-payload-segment:disabled { cursor: not-allowed; opacity: 0.45; }
.scv-payload-segment-active { background: var(--scv-bg); color: var(--scv-text); }
.scv-payload { display: block; width: 100%; margin-top: 3px; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; border: 1px solid var(--scv-border-strong); border-radius: 4px; background: var(--scv-bg); color: inherit; }
.scv-payload-rows { display: flex; flex-direction: column; gap: 4px; margin-top: 3px; }
.scv-payload-row { display: grid; grid-template-columns: 2fr 3fr auto; gap: 4px; align-items: center; }
.scv-payload-key, .scv-payload-value { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 2px 5px; border: 1px solid var(--scv-border-strong); border-radius: 4px; background: var(--scv-bg); color: inherit; min-width: 0; }
.scv-payload-remove { font: inherit; border: 0; background: transparent; color: var(--scv-muted); cursor: pointer; padding: 0 4px; }
.scv-payload-remove:hover { color: var(--scv-error); }
.scv-payload-add { font: inherit; font-size: 12px; border: 0; background: transparent; color: var(--scv-muted); cursor: pointer; padding: 0; text-align: left; }
.scv-payload-add:hover { color: var(--scv-text); }
.scv-payload-error { margin: 4px 0 0; color: var(--scv-error); }
.scv-log { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow: auto; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.scv-log li { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: baseline; }
.scv-log time { color: var(--scv-muted); }
.scv-log .scv-rejected { color: var(--scv-muted); }
.scv-context { margin: 0; max-height: 240px; overflow: auto; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
@keyframes scv-deny { 50% { opacity: 0.2; } }
`;

/**
 * Rules for one rendered diagram. Mermaid scopes its own rules with the svg id
 * (`#<svgId> .node rect`, specificity 1,1,1); these use the same id plus the
 * toggled class, so they win without `!important`. Every colour is a token
 * with its default as the fallback: an `unstyled` host that sets no variables
 * still gets a readable highlight.
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
${node}.${ACTIVE_CLASS} > rect, ${node}.${ACTIVE_CLASS} > g > path { stroke: ${token("--scv-active")}; stroke-width: 2.5px; fill: ${token("--scv-active-fill")}; }
${cluster}.${ACTIVE_CLASS} rect.outer { stroke: ${token("--scv-active")}; stroke-width: 2.5px; }
${node}.${SELECTED_CLASS} > rect, ${node}.${SELECTED_CLASS} > g > path { stroke: ${token("--scv-selected")}; stroke-width: 2.5px; stroke-dasharray: 5 3; }
${cluster}.${SELECTED_CLASS} rect.outer { stroke: ${token("--scv-selected")}; stroke-width: 2.5px; stroke-dasharray: 5 3; }
${s} path.transition.${ENABLED_CLASS} { stroke: ${token("--scv-enabled")}; stroke-width: 2.5px; }
${s} g.edgeLabel.${ENABLED_CLASS} .label span.edgeLabel { color: ${token("--scv-enabled")}; text-decoration: underline; }
${s} path.transition.${BLOCKED_CLASS} { stroke: ${token("--scv-blocked")}; stroke-width: 2px; stroke-dasharray: 6 4; }
${s} g.edgeLabel.${BLOCKED_CLASS} .label span.edgeLabel { color: ${token("--scv-blocked")}; }
${s} [${EDGE_ATTR}].${DENIED_CLASS} { animation: scv-deny 160ms linear 2; }
`;
}
