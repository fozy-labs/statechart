import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StatechartViz } from "../index";
import { createFakeVizMachine, fixtures, type VizFixture } from "../testing";
import type { VizMachine } from "../types";

/**
 * Dev playground and e2e harness. `?fixture=<name>` picks a fixture; the
 * default `machine` mode mounts `StatechartViz` on the fake machine,
 * `?mode=source` runs the real pipeline on the fixture's `.mmd` text (the
 * proposal's `square` and `trafficLight` examples verbatim) or on the text of
 * `?source=` — a `.mmd` text or a markdown document, whose machine `?machine=`
 * picks. `window.__scvPlayground` exposes the running machine to e2e tests:
 * the fake one, or the source-mode machine once its pipeline succeeded.
 */

declare global {
    interface Window {
        __scvPlayground?: {
            fixture: VizFixture<unknown>;
            mode: "machine" | "source";
            machine: VizMachine | null;
        };
    }
}

const params = new URLSearchParams(window.location.search);
const fixtureName = params.get("fixture") ?? "trafficLight";
const mode = params.get("mode") === "source" ? "source" : "machine";
const fixture = fixtures[fixtureName] ?? fixtures.trafficLight;
// A submitted textarea arrives with CRLF line ends.
const source = params.get("source")?.replace(/\r\n?/g, "\n") ?? fixture.source;
// An empty field of the form means "the first machine of the document".
const machineParam = params.get("machine");
const machineId = machineParam === null || machineParam === "" ? undefined : machineParam;
const fakeMachine = mode === "machine" ? createFakeVizMachine(fixture) : null;

const playground: NonNullable<Window["__scvPlayground"]> = { fixture, mode, machine: fakeMachine };
window.__scvPlayground = playground;

const navStyle = { display: "flex", gap: 12, font: "13px system-ui, sans-serif" } as const;

function Playground() {
    return (
        <div style={{ height: "100vh", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <nav style={navStyle}>
                {Object.keys(fixtures).map((name) => (
                    <a key={name} href={`?fixture=${name}`} style={{ fontWeight: name === fixture.name ? 600 : 400 }}>
                        {name}
                    </a>
                ))}
                <a href={`?fixture=${fixture.name}&mode=source`} style={{ fontWeight: mode === "source" ? 600 : 400 }}>
                    source mode
                </a>
            </nav>
            <div style={{ flex: 1, minHeight: 0 }}>
                {fakeMachine ? (
                    <StatechartViz machine={fakeMachine} />
                ) : (
                    <StatechartViz
                        source={source}
                        machineId={machineId}
                        title={`${fixture.name} (source)`}
                        onMachine={(machine) => {
                            playground.machine = machine;
                        }}
                    />
                )}
            </div>
            {mode === "source" && <SourceForm />}
        </div>
    );
}

/** Edits the source text (`.mmd` or markdown) and the machine to run; a GET submit re-runs the pipeline. */
function SourceForm() {
    return (
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="hidden" name="fixture" value={fixture.name} />
            <input type="hidden" name="mode" value="source" />
            <textarea
                name="source"
                defaultValue={source}
                rows={8}
                spellCheck={false}
                data-playground-source=""
                style={{ flex: 1, font: "12px/1.4 ui-monospace, Menlo, Consolas, monospace" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ font: "12px system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
                    machine
                    <input name="machine" defaultValue={machineId ?? ""} size={14} data-playground-machine="" />
                </label>
                <button type="submit">Run</button>
            </div>
        </form>
    );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("playground: #root not found");
createRoot(rootElement).render(
    <StrictMode>
        <Playground />
    </StrictMode>,
);
