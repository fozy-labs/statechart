/**
 * Markdown as a container: a `.md` file carries statechart diagrams inside
 * ```` ```mermaid ```` fenced blocks, and every such block is an independent
 * `.mmd` document — nothing (directives, context, guards) is shared between
 * blocks, and the prose around them is ignored.
 *
 * A block counts as a statechart when it holds a `%% @machine` line; the
 * directive is mandatory for the converter anyway, so flowcharts, sequence
 * diagrams and foreign state diagrams in the same document are skipped
 * without a word.
 *
 * The scan steps over *every* fence, not only the mermaid ones: a ``` inside
 * a ````` ````ts ````` example must not be read as the end of a block. Fence
 * recognition follows the CommonMark rules (3+ backticks or tildes, up to 3
 * spaces of indentation, closing fence of the same character and at least the
 * same length, content dedented by the indentation of the opening fence).
 */
import { splitLines } from "../parse/lines.js";
import { isName } from "../parse/names.js";
import { StatechartParseError } from "../StatechartParseError.js";

/** One ```` ```mermaid ```` block of a markdown document. */
export interface MermaidBlock {
    /** Block content, dedented by the fence indentation; no trailing newline. */
    text: string;
    /** 1-based line of the first content line (the line after the opening fence) in the document. */
    line: number;
    /** Number of leading spaces removed from every content line — the column offset of the block. */
    column: number;
    /** Info string of the opening fence: `mermaid`, `mermaid title="Order"`, … */
    info: string;
}

/** A `MermaidBlock` that declares a machine (`%% @machine <id>`). */
export interface StatechartBlock extends MermaidBlock {
    /** Id of the declaration; absent when the directive carries no valid name (the parser reports it). */
    machineId?: string;
    /** 1-based line of the `%% @machine` line in the document. */
    machineLine: number;
}

interface Fence {
    char: string;
    length: number;
    indent: number;
    info: string;
}

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const MACHINE_DIRECTIVE = /^[ \t]*%%[ \t]*@machine\b[ \t]*([^\s:]*)/;

function openingFence(text: string): Fence | null {
    const match = FENCE_LINE.exec(text);
    if (match === null) return null;
    const [, indent = "", marker = "", rest = ""] = match;
    // CommonMark: the info string of a backtick fence may not contain a backtick.
    if (marker.startsWith("`") && rest.includes("`")) return null;
    return { char: marker[0]!, length: marker.length, indent: indent.length, info: rest.trim() };
}

function isClosingFence(text: string, open: Fence): boolean {
    const match = FENCE_LINE.exec(text);
    if (match === null) return false;
    const marker = match[2]!;
    return marker.startsWith(open.char) && marker.length >= open.length && match[3]!.trim() === "";
}

/** The first word of the info string, case-insensitive — `mermaid title="X"` is a mermaid block too. */
function isMermaidInfo(info: string): boolean {
    return info.split(/\s+/)[0]!.toLowerCase() === "mermaid";
}

/**
 * Removes up to `indent` leading spaces (CommonMark). A content line indented
 * less than its fence keeps its own indentation, so `column` is an upper bound
 * of the shift for such a line — the only case where a reported column may be
 * off, and only inside markdown that is itself malformed.
 */
function stripIndent(text: string, indent: number): string {
    let cut = 0;
    while (cut < indent && text[cut] === " ") cut += 1;
    return text.slice(cut);
}

/** Every ```` ```mermaid ```` block of the document, in source order. */
export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
    const lines = splitLines(markdown);
    const blocks: MermaidBlock[] = [];
    let index = 0;
    while (index < lines.length) {
        const fence = openingFence(lines[index]!.text);
        if (fence === null) {
            index += 1;
            continue;
        }
        const openLine = lines[index]!.number;
        let end = index + 1;
        while (end < lines.length && !isClosingFence(lines[end]!.text, fence)) end += 1;
        if (isMermaidInfo(fence.info)) {
            if (end === lines.length) {
                throw new StatechartParseError(
                    `unterminated \`${fence.char.repeat(fence.length)}${fence.info}\` block (no closing fence)`,
                    { line: openLine },
                );
            }
            blocks.push({
                text: lines
                    .slice(index + 1, end)
                    .map((line) => stripIndent(line.text, fence.indent))
                    .join("\n"),
                line: openLine + 1,
                column: fence.indent,
                info: fence.info,
            });
        }
        index = end + 1;
    }
    return blocks;
}

function findMachineDirective(block: MermaidBlock): Pick<StatechartBlock, "machineId" | "machineLine"> | null {
    const lines = block.text.split("\n");
    for (let offset = 0; offset < lines.length; offset += 1) {
        const match = MACHINE_DIRECTIVE.exec(lines[offset]!);
        if (match === null) continue;
        const id = match[1]!;
        const machineLine = block.line + offset;
        return isName(id) ? { machineId: id, machineLine } : { machineLine };
    }
    return null;
}

function checkDuplicateIds(blocks: readonly StatechartBlock[]): void {
    const seen = new Map<string, number>();
    for (const block of blocks) {
        if (block.machineId === undefined) continue;
        const first = seen.get(block.machineId);
        if (first !== undefined) {
            throw new StatechartParseError(
                `duplicate \`%% @machine ${block.machineId}\` in the document (first declared at line ${first})`,
                { line: block.machineLine },
            );
        }
        seen.set(block.machineId, block.machineLine);
    }
}

/**
 * The mermaid blocks that declare a machine, in source order. Throws when two
 * blocks declare the same id — the document could not be addressed by name.
 */
export function findStatechartBlocks(markdown: string): StatechartBlock[] {
    const blocks: StatechartBlock[] = [];
    for (const block of extractMermaidBlocks(markdown)) {
        const declaration = findMachineDirective(block);
        if (declaration === null) continue;
        blocks.push({ ...block, ...declaration });
    }
    checkDuplicateIds(blocks);
    return blocks;
}

function available(blocks: readonly StatechartBlock[]): string {
    const ids = blocks.map((block) => block.machineId).filter((id): id is string => id !== undefined);
    return ids.length === 0 ? "the document declares no valid machine id" : `available: ${ids.join(", ")}`;
}

/** The requested machine, or the first one when `machine` is absent. Throws when the document has nothing to offer. */
export function selectStatechartBlock(blocks: readonly StatechartBlock[], machine?: string): StatechartBlock {
    if (blocks.length === 0) {
        throw new StatechartParseError("the document has no ```mermaid block with a `%% @machine <id>` directive", {
            line: 1,
        });
    }
    if (machine === undefined) return blocks[0]!;
    const found = blocks.find((block) => block.machineId === machine);
    if (found === undefined) {
        throw new StatechartParseError(`no machine \`${machine}\` in the document (${available(blocks)})`, { line: 1 });
    }
    return found;
}
