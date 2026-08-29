import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { convert } from "../convert.js";
import { findStatechartBlocks, selectStatechartBlock, type StatechartBlock } from "../markdown/blocks.js";
import { convertStatechartBlock } from "../markdown/convert.js";
import { StatechartParseError } from "../StatechartParseError.js";

export interface CliIo {
    stdout: { write(text: string): unknown };
    stderr: { write(text: string): unknown };
}

const USAGE = `Usage: statechart-convert <in.mmd|in.md> [options]

Converts a Mermaid stateDiagram-v2 with %% @directives into a typed statechart
definition. In a Markdown document every \`\`\`mermaid block carrying a
%% @machine directive is a machine; without --machine / --all the first one is
converted.

Default output: <in>.generated.ts next to the input, <id>.generated.ts for a
machine named with --machine / --all.

Options:
  -m, --machine <id[=file]>  machine to convert, repeatable (Markdown only)
      --all                  every machine of the document (Markdown only)
  -o, --out <file>           output file; only with a single machine
      --format <mmd|md>      input format; default: by file extension
  -h, --help                 show this help
`;

const MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set([".md", ".markdown"]);

type Format = "mmd" | "md";

/** `--machine <id>` or `--machine <id>=<file>`. */
interface MachineRequest {
    id: string;
    output: string | null;
}

interface ConvertArgs {
    kind: "convert";
    input: string;
    format: Format;
    machines: MachineRequest[];
    all: boolean;
    out: string | null;
}

type CliArgs = { kind: "help" } | ConvertArgs | { kind: "error"; message: string };

/** One conversion; `output` is `null` when the path follows from the machine id. */
interface Target {
    block: StatechartBlock;
    output: string | null;
}

/** Default output: the input path with its extension replaced by `.generated.ts`. */
export function defaultOutputPath(input: string): string {
    const parsed = path.parse(input);
    return path.join(parsed.dir, `${parsed.name}.generated.ts`);
}

/** Default output of a named machine: `<id>.generated.ts` next to the input. */
function machineOutputPath(input: string, machineId: string): string {
    return path.join(path.dirname(input), `${machineId}.generated.ts`);
}

function parseMachineRequest(entry: string): MachineRequest | { error: string } {
    const separator = entry.indexOf("=");
    const id = separator === -1 ? entry : entry.slice(0, separator);
    const output = separator === -1 ? null : entry.slice(separator + 1);
    if (id === "") return { error: `--machine ${JSON.stringify(entry)}: missing machine id` };
    if (output === "") return { error: `--machine ${JSON.stringify(entry)}: missing output file after \`=\`` };
    return { id, output };
}

function parseCliArgs(argv: string[]): CliArgs {
    let values: {
        out?: string | undefined;
        machine?: string[] | undefined;
        all?: boolean | undefined;
        format?: string | undefined;
        help?: boolean | undefined;
    };
    let positionals: string[];
    try {
        ({ values, positionals } = parseArgs({
            args: argv,
            options: {
                out: { type: "string", short: "o" },
                machine: { type: "string", short: "m", multiple: true },
                all: { type: "boolean" },
                format: { type: "string" },
                help: { type: "boolean", short: "h" },
            },
            allowPositionals: true,
        }));
    } catch (error) {
        return { kind: "error", message: error instanceof Error ? error.message : String(error) };
    }

    if (values.help === true) return { kind: "help" };
    if (positionals.length !== 1) return { kind: "error", message: "expected exactly one input file" };
    const input = positionals[0]!;

    if (values.format !== undefined && values.format !== "mmd" && values.format !== "md") {
        return { kind: "error", message: `unknown --format ${JSON.stringify(values.format)} (expected mmd or md)` };
    }
    const format: Format = values.format ?? (MARKDOWN_EXTENSIONS.has(path.extname(input).toLowerCase()) ? "md" : "mmd");

    const machines: MachineRequest[] = [];
    for (const entry of values.machine ?? []) {
        const request = parseMachineRequest(entry);
        if ("error" in request) return { kind: "error", message: request.error };
        if (machines.some((existing) => existing.id === request.id)) {
            return { kind: "error", message: `--machine ${request.id} is given twice` };
        }
        machines.push(request);
    }

    const all = values.all === true;
    const out = values.out ?? null;
    if (all && machines.length > 0) return { kind: "error", message: "--all and --machine are mutually exclusive" };
    if (format === "mmd" && (all || machines.length > 0)) {
        return { kind: "error", message: "--machine and --all need a Markdown input (--format md)" };
    }
    if (out !== null && machines.some((machine) => machine.output !== null)) {
        return { kind: "error", message: "--out conflicts with the output file given in --machine <id>=<file>" };
    }
    if (out !== null && (all || machines.length > 1)) {
        return { kind: "error", message: "--out takes a single machine; use --machine <id>=<file> per machine" };
    }
    return { kind: "convert", input, format, machines, all, out };
}

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** The blocks to convert, in the order the user asked for them. Throws `StatechartParseError` on selection problems. */
function markdownTargets(text: string, args: ConvertArgs): Target[] {
    const blocks = findStatechartBlocks(text);
    if (args.all) {
        // Raises the same "nothing to convert" error as an explicit selection.
        if (blocks.length === 0) selectStatechartBlock(blocks);
        return blocks.map((block) => ({ block, output: null }));
    }
    if (args.machines.length > 0) {
        return args.machines.map((machine) => ({
            block: selectStatechartBlock(blocks, machine.id),
            output: machine.output,
        }));
    }
    return [{ block: selectStatechartBlock(blocks), output: args.out ?? defaultOutputPath(args.input) }];
}

interface Output {
    path: string;
    code: string;
}

/**
 * Converts everything before writing anything: a document with several
 * machines either produces every file or leaves the tree untouched.
 */
function convertAll(text: string, args: ConvertArgs, io: CliIo): Output[] | null {
    const outputs: Output[] = [];
    const errors: string[] = [];

    if (args.format === "mmd") {
        try {
            outputs.push({
                path: args.out ?? defaultOutputPath(args.input),
                code: convert(text, { fileName: args.input }).code,
            });
        } catch (error) {
            if (!(error instanceof StatechartParseError)) throw error;
            errors.push(`${args.input}:${error.format()}`);
        }
    } else {
        let targets: Target[];
        try {
            targets = markdownTargets(text, args);
        } catch (error) {
            if (!(error instanceof StatechartParseError)) throw error;
            io.stderr.write(`${args.input}:${error.format()}\n`);
            return null;
        }
        for (const target of targets) {
            try {
                const result = convertStatechartBlock(target.block, { fileName: args.input });
                outputs.push({
                    path: target.output ?? machineOutputPath(args.input, result.parsed.machineId),
                    code: result.code,
                });
            } catch (error) {
                if (!(error instanceof StatechartParseError)) throw error;
                errors.push(`${args.input}:${error.format()}`);
            }
        }
    }

    if (errors.length > 0) {
        for (const message of errors) io.stderr.write(`${message}\n`);
        return null;
    }
    const collision = outputs.find((output, index) => outputs.findIndex((other) => other.path === output.path) < index);
    if (collision !== undefined) {
        io.stderr.write(`error: two machines would be written to ${collision.path}\n`);
        return null;
    }
    return outputs;
}

/** Runs the CLI; returns the exit code (0 ok, 1 conversion / io failure, 2 usage). */
export function runCli(argv: string[], io: CliIo): number {
    const args = parseCliArgs(argv);
    if (args.kind === "help") {
        io.stdout.write(USAGE);
        return 0;
    }
    if (args.kind === "error") {
        io.stderr.write(`error: ${args.message}\n${USAGE}`);
        return 2;
    }

    let text: string;
    try {
        text = readFileSync(args.input, "utf8");
    } catch (error) {
        io.stderr.write(`error: cannot read ${args.input}: ${describe(error)}\n`);
        return 1;
    }

    const outputs = convertAll(text, args, io);
    if (outputs === null) return 1;

    for (const output of outputs) {
        try {
            writeFileSync(output.path, output.code, "utf8");
        } catch (error) {
            io.stderr.write(`error: cannot write ${output.path}: ${describe(error)}\n`);
            return 1;
        }
        io.stdout.write(`${output.path}\n`);
    }
    return 0;
}
