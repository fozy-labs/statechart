import type { VizEvent } from "../types";

export type LogEntry = {
    seq: number;
    time: string;
    event: VizEvent;
    from: string;
    to: string;
    /** `false` when `can(event)` was false and the event was not sent. */
    accepted: boolean;
    /** Why a refused event was refused: the guard names, when the config names any. */
    reason?: string;
};

export const LOG_LIMIT = 200;

/** Newest first, capped at `LOG_LIMIT`; `seq` grows monotonically. */
export function appendLog(entries: readonly LogEntry[], entry: Omit<LogEntry, "seq">): LogEntry[] {
    const seq = (entries[0]?.seq ?? 0) + 1;
    return [{ seq, ...entry }, ...entries].slice(0, LOG_LIMIT);
}

export function timeStamp(now = new Date()): string {
    return now.toISOString().slice(11, 23);
}
