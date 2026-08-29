import { describe, expect, it } from "vitest";

import {
    buildRowsPayload,
    initialPayloadState,
    parsePayload,
    parseRowValue,
    payloadResult,
    rowTextOf,
    withAddedRow,
    withMode,
    withRemovedRow,
    withRow,
    type PayloadRow,
    type PayloadState,
} from "./payload";

function rows(...items: Array<[key: string, text: string]>): PayloadRow[] {
    return items.map(([key, text], i) => ({ id: i + 1, key, text }));
}

describe("parsePayload", () => {
    it("accepts an empty text and a JSON object", () => {
        expect(parsePayload("")).toEqual({ ok: true, value: {} });
        expect(parsePayload("  ")).toEqual({ ok: true, value: {} });
        expect(parsePayload('{ "value": 12 }')).toEqual({ ok: true, value: { value: 12 } });
    });

    it("rejects non-objects and broken JSON", () => {
        expect(parsePayload("12").ok).toBe(false);
        expect(parsePayload("[1]").ok).toBe(false);
        expect(parsePayload("null").ok).toBe(false);
        expect(parsePayload("{ not json").ok).toBe(false);
    });
});

describe("parseRowValue", () => {
    it("parses JSON scalars and structures", () => {
        expect(parseRowValue("12")).toBe(12);
        expect(parseRowValue("true")).toBe(true);
        expect(parseRowValue("null")).toBe(null);
        expect(parseRowValue('"12"')).toBe("12");
        expect(parseRowValue('{"a":1}')).toEqual({ a: 1 });
        expect(parseRowValue("[1, 2]")).toEqual([1, 2]);
    });

    it("keeps everything else a string; empty is an empty string", () => {
        expect(parseRowValue("hello world")).toBe("hello world");
        expect(parseRowValue("{ not json")).toBe("{ not json");
        expect(parseRowValue("")).toBe("");
        expect(parseRowValue("   ")).toBe("");
    });
});

describe("rowTextOf", () => {
    it("round-trips through parseRowValue", () => {
        for (const value of [12, true, null, "hello", "12", "true", '{"x":1}', { a: 1 }, [1, 2], ""]) {
            expect(parseRowValue(rowTextOf(value))).toEqual(value);
        }
    });

    it("bare strings stay bare, JSON-looking strings get quotes", () => {
        expect(rowTextOf("hello")).toBe("hello");
        expect(rowTextOf("12")).toBe('"12"');
        expect(rowTextOf(12)).toBe("12");
    });
});

describe("buildRowsPayload", () => {
    it("builds an object, skipping empty keys", () => {
        expect(buildRowsPayload(rows(["value", "12"], ["", "ignored"], ["name", "bob"]))).toEqual({
            ok: true,
            value: { value: 12, name: "bob" },
        });
    });

    it("reports a duplicate key", () => {
        const result = buildRowsPayload(rows(["a", "1"], ["a", "2"]));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain('"a"');
    });
});

describe("withMode", () => {
    it("converts json → form when the JSON parses", () => {
        const state: PayloadState = { ...initialPayloadState("json"), json: '{ "value": 12, "name": "bob" }' };
        const next = withMode(state, "form");
        expect(next.mode).toBe("form");
        expect(next.rows.map((r) => [r.key, r.text])).toEqual([
            ["value", "12"],
            ["name", "bob"],
        ]);
        expect(payloadResult(next)).toEqual({ ok: true, value: { value: 12, name: "bob" } });
    });

    it("converts form → json", () => {
        const state: PayloadState = { ...initialPayloadState("form"), rows: rows(["value", "12"]) };
        const next = withMode(state, "json");
        expect(next.mode).toBe("json");
        expect(JSON.parse(next.json)).toEqual({ value: 12 });
    });

    it("an empty payload converts to at least one empty row and back to {}", () => {
        const form = withMode(initialPayloadState("json"), "form");
        expect(form.rows).toHaveLength(1);
        expect(withMode(form, "json").json).toBe("{}");
    });

    it("keeps both texts when the current mode does not parse", () => {
        const state: PayloadState = { ...initialPayloadState("json"), json: "{ broken" };
        const next = withMode(state, "form");
        expect(next.mode).toBe("form");
        expect(next.json).toBe("{ broken");
        expect(next.rows).toEqual(state.rows);
    });

    it("row ids never collide after conversions", () => {
        let state = withMode({ ...initialPayloadState("json"), json: '{ "a": 1 }' }, "form");
        state = withAddedRow(state);
        const ids = state.rows.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("row editing", () => {
    it("updates, adds and removes rows; the last removal leaves one empty row", () => {
        let state: PayloadState = { ...initialPayloadState("form"), rows: rows(["a", "1"]) };
        state = withRow(state, 1, { text: "2" });
        expect(state.rows[0].text).toBe("2");
        state = withAddedRow(state);
        expect(state.rows).toHaveLength(2);
        state = withRemovedRow(state, state.rows[1].id);
        state = withRemovedRow(state, 1);
        expect(state.rows).toHaveLength(1);
        expect(state.rows[0]).toMatchObject({ key: "", text: "" });
    });
});
