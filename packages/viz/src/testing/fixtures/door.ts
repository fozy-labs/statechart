import type { VizFixture } from "./types";

export type DoorContext = { hasKey: boolean };

const source = `stateDiagram-v2
    direction LR
    %% @machine door
    %% @context type: { hasKey: boolean }
    %% @context initial: { hasKey: false }

    [*] --> locked

    %% @guard hasKey: context.hasKey
    locked --> open: OPEN [hasKey]

    %% @action pickUp: context.hasKey = true
    locked --> locked: PICK_KEY / pickUp

    %% @action drop: context.hasKey = false
    open --> locked: CLOSE / drop
`;

/**
 * A machine whose guard actually refuses in the initial context: `OPEN` is
 * blocked until `PICK_KEY` sets `hasKey` — the fixture of the guard-blocked
 * edge and button visuals.
 */
export const doorFixture: VizFixture<DoorContext> = {
    name: "door",
    source,
    config: {
        id: "door",
        source,
        initial: "locked",
        states: {
            locked: {
                on: {
                    OPEN: { target: "open", guard: "hasKey" },
                    PICK_KEY: { target: "locked", actions: ["pickUp"] },
                },
            },
            open: { on: { CLOSE: { target: "locked", actions: ["drop"] } } },
        },
    },
    context: { hasKey: false },
    guards: {
        hasKey: ({ context }) => context.hasKey,
    },
    actions: {
        pickUp: () => ({ hasKey: true }),
        drop: () => ({ hasKey: false }),
    },
};
