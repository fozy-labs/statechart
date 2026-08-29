import type { ReactNode } from "react";

import { describeTarget, type OutgoingEvent } from "../core/configWalk";
import { formatStateValue } from "../core/stateValue";

import { useStatechartViz } from "./context";
import { cx } from "./cx";
import type { LogEntry } from "./log";

export type PartProps = { className?: string };

export type SlotProps = PartProps & { children?: ReactNode };

/** Title, machine status and the current state value. */
export function VizHeader({ className }: PartProps) {
    const { title, snapshot } = useStatechartViz();
    return (
        <header className={cx("scv-header", className)}>
            <h2 className="scv-title">{title}</h2>
            {snapshot && (
                <>
                    <span className="scv-status" data-scv-status={snapshot.status}>
                        {snapshot.status}
                    </span>
                    <span className="scv-value" data-scv-value="">
                        {formatStateValue(snapshot.value)}
                    </span>
                </>
            )}
        </header>
    );
}

/** Layout slot: the diagram + side panels grid of the default layout. */
export function VizBody({ className, children }: SlotProps) {
    return <div className={cx("scv-body", className)}>{children}</div>;
}

/** Layout slot: the scrolling side column of the default layout. */
export function VizSide({ className, children }: SlotProps) {
    return <aside className={cx("scv-side", className)}>{children}</aside>;
}

/** Source-mode pipeline / runtime error; renders nothing when there is none. */
export function VizNotice({ className }: PartProps) {
    const { notice } = useStatechartViz();
    if (notice === null) return null;
    return (
        <section className={cx("scv-panel", className)}>
            <h3 className="scv-panel-title">Source mode</h3>
            <p className="scv-notice" data-scv-notice="">
                {notice}
            </p>
        </section>
    );
}

/** Outgoing events of the selected state, with the payload editor. */
export function VizEvents({ className }: PartProps) {
    const api = useStatechartViz();
    const { machine, selectedId, outgoing, activeIds, canSend, send, payload } = api;
    const machineId = machine?.definition.id ?? "";

    /**
     * The guard that blocks an event right now — shown only when the refusal
     * is the machine's own (payload valid, selected state active) and the
     * config names a guard; any other disablement keeps the plain style.
     */
    const blockingGuard = (item: OutgoingEvent): string | undefined => {
        if (machine === null || !payload.result.ok || canSend(item.event)) return undefined;
        if (selectedId === null || !activeIds.has(selectedId)) return undefined;
        return item.transitions.find((t) => t.guard !== undefined)?.guard;
    };

    return (
        <section className={cx("scv-panel", className)} data-scv-events="">
            <h3 className="scv-panel-title">Events{selectedId ? ` · ${selectedId}` : ""}</h3>
            {selectedId === null ? (
                <p className="scv-hint">Click a state to list its events; click an enabled transition to send it.</p>
            ) : outgoing.length === 0 ? (
                <p className="scv-hint">No event transitions from this state.</p>
            ) : (
                <div className="scv-events">
                    {outgoing.map((item) => {
                        const guard = blockingGuard(item);
                        return (
                            <button
                                key={item.event}
                                type="button"
                                className={cx("scv-event", guard !== undefined && "scv-event-blocked")}
                                data-scv-event={item.event}
                                data-scv-blocked={guard}
                                disabled={!canSend(item.event)}
                                title={describeTransitions(item, machineId)}
                                onClick={() => send(item.event)}
                            >
                                {item.event}
                                {guard !== undefined && <span className="scv-event-guard">⊘ {guard}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
            <VizPayloadEditor />
        </section>
    );
}

function describeTransitions(item: OutgoingEvent, machineId: string): string {
    const lines = item.transitions.map((t) => {
        const guard = t.guard ? ` [${t.guard}]` : "";
        const actions = t.actions.length ? ` / ${t.actions.join(", ")}` : "";
        return `→ ${describeTarget(t.target, machineId)}${guard}${actions}`;
    });
    return `${item.event} (from ${item.definedBy})\n${lines.join("\n")}`;
}

/** The payload input: key/value rows or a raw JSON object, merged into the sent event. */
export function VizPayloadEditor({ className }: PartProps) {
    const { payload } = useStatechartViz();
    const { state, result } = payload;
    // Leaving a broken JSON for the form would misrepresent it; the segment waits.
    const formSwitchDisabled = state.mode === "json" && !result.ok;
    return (
        <div className={cx("scv-payload-editor", className)} data-scv-payload-mode={state.mode}>
            <div className="scv-payload-head">
                <span className="scv-payload-caption" title="Merged into the sent event">
                    Payload
                </span>
                <div className="scv-payload-toggle" role="group" aria-label="Payload editor mode">
                    <button
                        type="button"
                        className={cx("scv-payload-segment", state.mode === "form" && "scv-payload-segment-active")}
                        data-scv-mode="form"
                        disabled={formSwitchDisabled}
                        onClick={() => payload.setMode("form")}
                    >
                        Fields
                    </button>
                    <button
                        type="button"
                        className={cx("scv-payload-segment", state.mode === "json" && "scv-payload-segment-active")}
                        data-scv-mode="json"
                        onClick={() => payload.setMode("json")}
                    >
                        JSON
                    </button>
                </div>
            </div>
            {state.mode === "json" ? (
                <textarea
                    className="scv-payload"
                    data-scv-payload=""
                    rows={2}
                    value={state.json}
                    onChange={(event) => payload.setJson(event.target.value)}
                    spellCheck={false}
                    aria-label="Payload, a JSON object"
                />
            ) : (
                <div className="scv-payload-rows">
                    {state.rows.map((row) => (
                        <div key={row.id} className="scv-payload-row">
                            <input
                                className="scv-payload-key"
                                data-scv-field-key=""
                                placeholder="key"
                                value={row.key}
                                onChange={(event) => payload.setRow(row.id, { key: event.target.value })}
                                spellCheck={false}
                                aria-label="Field key"
                            />
                            <input
                                className="scv-payload-value"
                                data-scv-field-value=""
                                placeholder="value — JSON or text"
                                value={row.text}
                                onChange={(event) => payload.setRow(row.id, { text: event.target.value })}
                                spellCheck={false}
                                aria-label="Field value, JSON or bare text"
                            />
                            <button
                                type="button"
                                className="scv-payload-remove"
                                data-scv-field-remove=""
                                title="Remove field"
                                aria-label={`Remove field ${row.key || "(empty)"}`}
                                onClick={() => payload.removeRow(row.id)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="scv-payload-add"
                        data-scv-field-add=""
                        onClick={() => payload.addRow()}
                    >
                        + Add field
                    </button>
                </div>
            )}
            {!result.ok && <p className="scv-payload-error">{result.error}</p>}
        </div>
    );
}

/** The attempts log, newest first; refused events keep their guard. */
export function VizLog({ className }: PartProps) {
    const { log } = useStatechartViz();
    return (
        <section className={cx("scv-panel", className)} data-scv-log="">
            <h3 className="scv-panel-title">Event log</h3>
            {log.length === 0 ? (
                <p className="scv-hint">No events sent yet.</p>
            ) : (
                <ol className="scv-log">
                    {log.map((entry) => (
                        <li key={entry.seq} className={entry.accepted ? undefined : "scv-rejected"}>
                            <time>{entry.time}</time>
                            {entry.accepted ? (
                                <span>
                                    {formatEvent(entry.event)} {entry.from} → {entry.to}
                                </span>
                            ) : (
                                <span>
                                    ⊘ <s>{formatEvent(entry.event)}</s>
                                    {entry.reason ? ` ${entry.reason}` : ""} {entry.from}
                                </span>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function formatEvent(event: LogEntry["event"]): string {
    const { type, ...rest } = event;
    return Object.keys(rest).length === 0 ? type : `${type} ${safeStringify(rest)}`;
}

/** The machine's current `context`, pretty-printed. */
export function VizContextPanel({ className }: PartProps) {
    const { snapshot } = useStatechartViz();
    return (
        <section className={cx("scv-panel", className)} data-scv-context="">
            <h3 className="scv-panel-title">Context</h3>
            {snapshot ? (
                <pre className="scv-context">{safeStringify(snapshot.context, 2)}</pre>
            ) : (
                <p className="scv-hint">No running machine.</p>
            )}
        </section>
    );
}

function safeStringify(value: unknown, indent = 0): string {
    try {
        return JSON.stringify(value, null, indent) ?? String(value);
    } catch {
        return String(value);
    }
}
