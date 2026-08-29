import { useVizStore } from "./viz/context";
import { VizDiagram, VizDiagramControls } from "./viz/DiagramPanel";
import {
    VizBody,
    VizContextPanel,
    VizEvents,
    VizHeader,
    VizLog,
    VizNotice,
    VizPayloadEditor,
    VizSide,
} from "./viz/parts";
import { createVizStore } from "./viz/store";
import { VizRoot, type StatechartVizRootProps } from "./viz/VizRoot";

/** The layout `<StatechartViz />` has always rendered; `Root` falls back to it without children. */
function DefaultLayout() {
    return (
        <>
            <VizHeader />
            <VizBody>
                <VizDiagram />
                <VizSide>
                    <VizNotice />
                    <VizEvents />
                    <VizLog />
                    <VizContextPanel />
                </VizSide>
            </VizBody>
        </>
    );
}

function Root(props: StatechartVizRootProps) {
    return <VizRoot {...props} defaultChildren={<DefaultLayout />} />;
}

/**
 * Interactive mermaid view of a statechart. `machine` mode renders
 * `definition.source ?? definition.toMermaid()` and follows the running
 * machine; `source` mode runs the playground pipeline (see
 * `playground/createSourceMachine`) over a `.mmd` text or over one
 * ```` ```mermaid ```` block of a markdown document.
 *
 * `<StatechartViz {...props} />` renders the default layout. The compound
 * parts compose a custom one — every part reads the same headless API
 * (`useStatechartViz`), so any of them can be replaced by a host component:
 *
 * ```tsx
 * <StatechartViz.Root machine={machine$}>
 *     <StatechartViz.Diagram />
 *     <MyInspector /> // built on useStatechartViz()
 * </StatechartViz.Root>
 * ```
 *
 * The selection, the log and the payload live in a store. `Root` creates one
 * per machine; `StatechartViz.createStore()` makes one the host owns instead
 * — pass it as `store` to read or write that state from outside React. Either
 * way `StatechartViz.useStore()` reaches it from inside, for a component that
 * follows a single signal rather than the whole API.
 */
export const StatechartViz = Object.assign(
    function StatechartViz(props: StatechartVizRootProps) {
        return <Root {...props} />;
    },
    {
        /** Provider and frame; renders the default layout when given no children. */
        Root,
        /**
         * Creates the store `Root` drives (selection, log, payload) — pass it
         * to `Root` to own that state, or let `Root` create its own.
         */
        createStore: createVizStore,
        /** The store `Root` drives, to subscribe to one of its signals alone. */
        useStore: useVizStore,
        /** Title, machine status, current state value. */
        Header: VizHeader,
        /** Layout slot: the diagram + side column grid. */
        Body: VizBody,
        /** The interactive diagram (pan/zoom, clicks); children overlay it (zoom controls by default). */
        Diagram: VizDiagram,
        /** The zoom controls alone, for a custom `Diagram` overlay. */
        DiagramControls: VizDiagramControls,
        /** Layout slot: the scrolling side column. */
        Side: VizSide,
        /** Source-mode pipeline / runtime error; renders nothing when there is none. */
        Notice: VizNotice,
        /** Outgoing events of the selected state, with the payload editor. */
        Events: VizEvents,
        /** The payload editor alone (it is part of `Events` already). */
        PayloadEditor: VizPayloadEditor,
        /** The attempts log. */
        Log: VizLog,
        /** The machine's `context`, pretty-printed. */
        Context: VizContextPanel,
    },
);

export type { StatechartVizRootProps };
