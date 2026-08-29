/**
 * Payload editor model. The payload is a JSON object merged into the sent
 * event. Two edit modes over one logical value: a raw JSON text and a list of
 * key/value rows. Both texts are kept in the state so switching modes never
 * loses input; an explicit switch converts when the current mode parses.
 */

export type PayloadMode = "json" | "form";

export type PayloadRow = {
    /** Stable identity for React keys and row updates. */
    id: number;
    key: string;
    /** Raw value text: JSON when it parses, a bare string otherwise. */
    text: string;
};

export type PayloadState = {
    mode: PayloadMode;
    json: string;
    rows: PayloadRow[];
    /** Next row id. */
    nextId: number;
};

export type PayloadResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

/** The JSON payload text: empty → `{}`; otherwise a JSON object. */
export function parsePayload(text: string): PayloadResult {
    if (text.trim() === "") return { ok: true, value: {} };
    try {
        const value: unknown = JSON.parse(text);
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return { ok: false, error: "payload must be a JSON object" };
        }
        return { ok: true, value: value as Record<string, unknown> };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/** A row value: JSON when it parses (`12`, `true`, `"a"`, `{...}`), a bare string otherwise. */
export function parseRowValue(text: string): unknown {
    const trimmed = text.trim();
    if (trimmed === "") return "";
    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return text;
    }
}

/** Rows with an empty key are ignored; a duplicate key is an error, not a silent overwrite. */
export function buildRowsPayload(rows: readonly PayloadRow[]): PayloadResult {
    const value: Record<string, unknown> = {};
    for (const row of rows) {
        const key = row.key.trim();
        if (key === "") continue;
        if (key in value) return { ok: false, error: `duplicate key "${key}"` };
        value[key] = parseRowValue(row.text);
    }
    return { ok: true, value };
}

export function payloadResult(state: PayloadState): PayloadResult {
    return state.mode === "json" ? parsePayload(state.json) : buildRowsPayload(state.rows);
}

/** Inverse of `parseRowValue`: a text that round-trips back to the same value. */
export function rowTextOf(value: unknown): string {
    if (typeof value === "string") {
        try {
            JSON.parse(value);
        } catch {
            return value; // a bare string stays bare — parseRowValue keeps it a string
        }
        return JSON.stringify(value); // "12", "true", "[1]" need quotes to stay strings
    }
    return JSON.stringify(value) ?? "";
}

/** Fields is the default mode: key/value rows need no JSON syntax recall. */
export function initialPayloadState(mode: PayloadMode = "form"): PayloadState {
    return { mode, json: "{}", rows: [{ id: 1, key: "", text: "" }], nextId: 2 };
}

/**
 * Mode switch with conversion: the leaving mode's value is projected onto the
 * entering mode when it parses; otherwise both texts stay as they are — the
 * user can switch back without losing anything.
 */
export function withMode(state: PayloadState, mode: PayloadMode): PayloadState {
    if (mode === state.mode) return state;
    const result = payloadResult(state);
    if (!result.ok) return { ...state, mode };
    if (mode === "form") {
        const entries = Object.entries(result.value);
        let nextId = state.nextId;
        const rows: PayloadRow[] = entries.map(([key, value]) => ({ id: nextId++, key, text: rowTextOf(value) }));
        if (rows.length === 0) rows.push({ id: nextId++, key: "", text: "" });
        return { ...state, mode, rows, nextId };
    }
    const keys = Object.keys(result.value);
    const json = keys.length === 0 ? "{}" : JSON.stringify(result.value, null, 1).replace(/\n\s*/g, " ");
    return { ...state, mode, json };
}

export function withJson(state: PayloadState, json: string): PayloadState {
    return { ...state, json };
}

export function withRow(
    state: PayloadState,
    id: number,
    patch: Partial<Pick<PayloadRow, "key" | "text">>,
): PayloadState {
    return { ...state, rows: state.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) };
}

export function withAddedRow(state: PayloadState): PayloadState {
    return {
        ...state,
        rows: [...state.rows, { id: state.nextId, key: "", text: "" }],
        nextId: state.nextId + 1,
    };
}

/** Removing the last row leaves one empty row, so the form is never empty. */
export function withRemovedRow(state: PayloadState, id: number): PayloadState {
    const rows = state.rows.filter((row) => row.id !== id);
    if (rows.length === 0) {
        return { ...state, rows: [{ id: state.nextId, key: "", text: "" }], nextId: state.nextId + 1 };
    }
    return { ...state, rows };
}
