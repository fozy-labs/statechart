import { Batcher, Signal, type StateSignal } from "@fozy-labs/rx-toolkit";

import type { LogEntry } from "./log";
import { initialPayloadState, type PayloadState } from "./payload";

/**
 * The state `StatechartViz` owns: what the user selected, what they typed
 * into the payload editor, what they already sent. Everything else the viz
 * shows is derived — the machine's snapshot, the rendered diagram — and does
 * not live here.
 *
 * `StatechartViz.Root` creates one per machine when it is given none. A store
 * passed in belongs to whoever created it: the viz reads and writes it, but
 * never recreates or resets it, not even on a machine change.
 *
 * The signals are the point: `StatechartViz.useStore()` hands the store to a
 * component that wants to follow one of them alone, without re-rendering with
 * the rest of the API.
 *
 * ```tsx
 * const log = useSignal(StatechartViz.useStore().log$);
 * ```
 */
export type VizStore = {
    /** Mermaid id of the selected state; `null` when nothing is selected. */
    readonly selected$: StateSignal<string | null>;
    /** The attempts, newest first, capped at `LOG_LIMIT`. */
    readonly log$: StateSignal<LogEntry[]>;
    /** The payload editor's own state: the mode and both of its texts. */
    readonly payload$: StateSignal<PayloadState>;
    /** Puts every signal back to the value `createStore` gave it, in one batch. */
    reset(): void;
};

/**
 * A store to hand to `StatechartViz.Root`, or to let it create itself. Holds
 * no subscription of its own, so there is nothing to dispose — it lives as
 * long as its owner keeps a reference.
 */
export function createVizStore(): VizStore {
    const selected$ = Signal.state<string | null>(null);
    const log$ = Signal.state<LogEntry[]>([]);
    const payload$ = Signal.state<PayloadState>(initialPayloadState());
    return {
        selected$,
        log$,
        payload$,
        reset: () =>
            Batcher.run(() => {
                selected$.set(null);
                log$.set([]);
                payload$.set(initialPayloadState());
            }),
    };
}
