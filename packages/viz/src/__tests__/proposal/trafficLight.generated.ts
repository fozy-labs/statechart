// AUTO-GENERATED from trafficLight.mmd — do not edit
import { createMachine, mutate, type ActionArgs, type GuardArgs } from "@fozy-labs/rx-toolkit";

export type Context = { power: boolean; retries: number };

export type Events =
    | { type: "POWER_ON" }
    | { type: "POWER_OFF" }
    | { type: "RESET" }
    | { type: "FAULT" };

export type StateId = "off" | "working" | "working.green" | "working.yellow" | "working.red" | "broken";

export const source = `stateDiagram-v2
    %% @machine trafficLight
    %% @context type: { power: boolean; retries: number }
    %% @context initial: { power: true, retries: 0 }

    [*] --> off

    %% @guard hasPower: context.power
    %% @action logStart: console.log("start")
    off --> working: POWER_ON [hasPower] / logStart
    working --> off: POWER_OFF
    working --> broken: done

    %% @action retry: context.retries += 1
    broken --> off: RESET / retry

    state working {
        [*] --> green
        green --> yellow: after 3000
        %% @action warn: console.warn("yellow -> red")
        yellow --> red: after 1000 / warn
        red --> green: after 3000
        red --> [*]: FAULT
    }
`;

export const definition = createMachine<Context, Events>(
    {
        id: "trafficLight",
        source,
        context: { power: true, retries: 0 },
        initial: "off",
        states: {
            off: { on: { POWER_ON: { target: "working", guard: "hasPower", actions: ["logStart"] } } },
            working: {
                initial: "green",
                on: { POWER_OFF: "off" },
                onDone: "broken",
                states: {
                    green: { after: { 3000: "yellow" } },
                    yellow: { after: { 1000: { target: "red", actions: ["warn"] } } },
                    red: { on: { FAULT: "$final" }, after: { 3000: "green" } },
                    $final: { type: "final" },
                },
            },
            broken: { on: { RESET: { target: "off", actions: ["retry"] } } },
        },
    },
    {
        guards: {
            hasPower: ({ context }: GuardArgs<Context, Extract<Events, { type: "POWER_ON" }>>) => (context.power),
        },
        actions: {
            logStart: () => {
                console.log("start")
            },
            retry: mutate(({ context }: ActionArgs<Context, Extract<Events, { type: "RESET" }>>) => {
                context.retries += 1
            }),
            warn: () => {
                console.warn("yellow -> red")
            },
        },
    },
);
