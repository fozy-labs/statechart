export { StatechartViz, type StatechartVizRootProps } from "./StatechartViz";
export { useStatechartViz, type PayloadApi, type StatechartVizApi } from "./viz/context";
export { type LogEntry } from "./viz/log";
export {
    buildRowsPayload,
    parsePayload,
    parseRowValue,
    type PayloadMode,
    type PayloadResult,
    type PayloadRow,
    type PayloadState,
} from "./viz/payload";
export { type DiagramState } from "./viz/useDiagram";
export { computeEdgeStatuses, type EdgeInteractivity, type EdgeStatusMap } from "./core/edgeStatus";
export { BASE_CSS, diagramCss, THEME_TOKENS } from "./styles";
export type {
    ActionLike,
    ActionsLike,
    DisposableVizMachine,
    GuardLike,
    ImplementationLike,
    MachineConfigLike,
    StateNodeLike,
    StateValue,
    StatechartVizProps,
    StatesLike,
    TransitionLike,
    TransitionListLike,
    TransitionTargetLike,
    VizEvent,
    VizMachine,
    VizSnapshot,
} from "./types";

export {
    collectGuardsForEvent,
    collectOutgoingEvents,
    describeTarget,
    findStateChain,
    implementationName,
    normalizeTransitions,
    type OutgoingEvent,
    type StateChainEntry,
    type TransitionObject,
} from "./core/configWalk";
export { collectActivePaths, formatStateValue, projectActiveIds } from "./core/stateValue";
export { parseTransitionLabel, type TransitionLabel, type TransitionTrigger } from "./core/transitionLabel";

export * from "./playground";
export {
    createSourceMachine,
    looksLikeMarkdown,
    resolveDiagramSource,
    SourceMachineError,
    type SourceMachine,
    type SourceMachineOptions,
    type SourceStage,
} from "./playground/createSourceMachine";
