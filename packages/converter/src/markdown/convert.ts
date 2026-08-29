/**
 * Conversion of a block of a markdown document. The block text is a plain
 * `.mmd` document, so the whole single-file pipeline (`parse` →
 * `validateMachineConfig` → `emit`) runs unchanged; the only addition is that
 * every `StatechartParseError` is re-anchored to the position of the block in
 * the document, so a CLI prints `doc.md:57:12: …` and not the line inside the
 * fence.
 */
import { convert } from "../convert.js";
import { parse } from "../parse/parse.js";
import { StatechartParseError } from "../StatechartParseError.js";
import { type ConvertOptions, type ConvertResult, type DirectiveBody, type ParseResult } from "../types.js";

import { findStatechartBlocks, selectStatechartBlock, type MermaidBlock, type StatechartBlock } from "./blocks.js";

export interface MarkdownSelectOptions {
    /** `@machine` id to convert; the first block of the document when absent. */
    machine?: string;
}

export interface MarkdownConvertOptions extends ConvertOptions, MarkdownSelectOptions {}

/** Re-throws a parse error at its position in the document. */
function rethrowAtDocument(error: unknown, block: MermaidBlock): never {
    if (!(error instanceof StatechartParseError)) throw error;
    const moved = new StatechartParseError(error.message, {
        line: error.line + block.line - 1,
        column: error.column === undefined ? undefined : error.column + block.column,
        path: error.path,
    });
    moved.stack = error.stack;
    throw moved;
}

function baseName(fileName: string): string {
    return fileName.split(/[\\/]/).pop() ?? fileName;
}

/** `doc.md (@machine order)` for the header comment of the generated file. */
function sourceLabel(fileName: string, block: StatechartBlock): string {
    const name = baseName(fileName);
    return block.machineId === undefined ? name : `${name} (@machine ${block.machineId})`;
}

/**
 * Moves every source position of a parse result from the block to the
 * document, so that a consumer of the result (the library's config gate, a
 * playground compiling the bodies) reports document lines as well.
 * `config.source` stays the block text: what is derived from it — the
 * generated file, the header line — is block-local by nature.
 */
function anchor(parsed: ParseResult, block: MermaidBlock): ParseResult {
    const offset = block.line - 1;
    if (offset === 0) return parsed;
    const body = (value: DirectiveBody): DirectiveBody => ({ ...value, line: value.line + offset });
    const table = (values: Record<string, DirectiveBody>): Record<string, DirectiveBody> =>
        Object.fromEntries(Object.entries(values).map(([name, value]) => [name, body(value)]));
    const { initial } = parsed.context;
    return {
        ...parsed,
        context: initial === undefined ? parsed.context : { ...parsed.context, initial: body(initial) },
        guards: table(parsed.guards),
        actions: table(parsed.actions),
        delays: table(parsed.delays),
        states: parsed.states.map((state) => ({ ...state, line: state.line + offset })),
    };
}

/** `parse` of one block; errors and the positions of the result are those of the document. */
export function parseStatechartBlock(block: StatechartBlock): ParseResult {
    try {
        return anchor(parse(block.text), block);
    } catch (error) {
        rethrowAtDocument(error, block);
    }
}

/** `convert` of one block; errors and `parsed` positions are those of the document. */
export function convertStatechartBlock(block: StatechartBlock, options: ConvertOptions): ConvertResult {
    try {
        const { code, parsed } = convert(block.text, { sourceLabel: sourceLabel(options.fileName, block), ...options });
        return { code, parsed: anchor(parsed, block) };
    } catch (error) {
        rethrowAtDocument(error, block);
    }
}

/** Parses one machine of a markdown document (the first one when `machine` is absent). */
export function parseMarkdown(markdown: string, options: MarkdownSelectOptions = {}): ParseResult {
    return parseStatechartBlock(selectStatechartBlock(findStatechartBlocks(markdown), options.machine));
}

/** Converts one machine of a markdown document (the first one when `machine` is absent). */
export function convertMarkdown(markdown: string, options: MarkdownConvertOptions): ConvertResult {
    const block = selectStatechartBlock(findStatechartBlocks(markdown), options.machine);
    return convertStatechartBlock(block, options);
}
