/**
 * `tsc --strict` (plus `noUnusedLocals` / `noUnusedParameters`) over a
 * generated file held in memory, with `@fozy-labs/rx-toolkit` resolved the
 * way a consumer's project resolves it: from `node_modules`, i.e. the
 * installed package's `dist/*.d.ts`, under the compiler options of a typical
 * host (`moduleResolution: bundler`, `lib` DOM + ESNext, `jsx: react-jsx`).
 * The generated file is placed (virtually) inside this package, so the
 * lookup walks up from `test/__virtual__/` and finds the workspace's copy.
 *
 * Every call builds one `ts.Program`, but the declaration files are parsed
 * once (shared source-file cache) and the previous program is handed over as
 * `oldProgram`, so a test file with many generated files stays fast.
 * `typecheckGenerated` reports the diagnostics of the generated file only;
 * `typecheckLibrary` proves once per run that the library's own declarations
 * are clean under the same options — checked explicitly, `skipLibCheck`
 * would silence them — which is what makes that restriction honest: an
 * unresolved import inside the library would otherwise degrade its types to
 * `any` and let the negative cases pass for the wrong reason.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const LIBRARY_PACKAGE = "@fozy-labs/rx-toolkit";
/** Root of this package: diagnostics outside the generated file are reported relative to it. */
const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
/** The generated file's path: fixed, so that `oldProgram` can reuse the program structure between calls. */
const VIRTUAL_PATH = normalize(fileURLToPath(new URL("./__virtual__/generated.ts", import.meta.url)));

const OPTIONS: ts.CompilerOptions = {
    // A typical host project
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.dom.d.ts", "lib.esnext.d.ts"],
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    isolatedModules: true,
    // No automatic `@types/*` globals: the generated file needs none, and the
    // library's declarations pull the types they import through module resolution.
    types: [],
    // What the generated file must pass on top
    noUnusedLocals: true,
    noUnusedParameters: true,
    noEmit: true,
};

/**
 * The library's declarations are checked for real (`skipLibCheck: false`);
 * `noUnusedLocals` / `noUnusedParameters` are the generated file's rule, not theirs.
 */
const LIBRARY_OPTIONS: ts.CompilerOptions = {
    ...OPTIONS,
    skipLibCheck: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
};

function normalize(fileName: string): string {
    return path.resolve(fileName).replace(/\\/g, "/");
}

function isVirtual(fileName: string): boolean {
    return normalize(fileName).toLowerCase() === VIRTUAL_PATH.toLowerCase();
}

/** A file of the installed library package (`node_modules/@fozy-labs/rx-toolkit/…`). */
function isLibraryFile(fileName: string): boolean {
    return normalize(fileName).includes(`/node_modules/${LIBRARY_PACKAGE}/`);
}

/** Library and `.d.ts` files parsed once per process. */
const sourceFiles = new Map<string, ts.SourceFile>();
let previousProgram: ts.Program | undefined;

function createProgram(code: string, options: ts.CompilerOptions): ts.Program {
    const host = ts.createCompilerHost(options, true);
    const getSourceFile = host.getSourceFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    const readFile = host.readFile.bind(host);
    host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
        if (isVirtual(fileName)) return ts.createSourceFile(fileName, code, languageVersionOrOptions, true);
        const key = normalize(fileName);
        let sourceFile = sourceFiles.get(key);
        if (sourceFile === undefined) {
            sourceFile = getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
            if (sourceFile !== undefined) sourceFiles.set(key, sourceFile);
        }
        return sourceFile;
    };
    host.fileExists = (fileName) => isVirtual(fileName) || fileExists(fileName);
    host.readFile = (fileName) => (isVirtual(fileName) ? code : readFile(fileName));

    const program = ts.createProgram({ rootNames: [VIRTUAL_PATH], options, host, oldProgram: previousProgram });
    previousProgram = program;
    return program;
}

function format(diagnostic: ts.Diagnostic, name: string): string {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (diagnostic.file === undefined || diagnostic.start === undefined) return `TS${diagnostic.code}: ${message}`;
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const fileName = isVirtual(diagnostic.file.fileName)
        ? name
        : path.relative(PACKAGE_ROOT, diagnostic.file.fileName).replace(/\\/g, "/");
    return `${fileName}(${line + 1},${character + 1}): TS${diagnostic.code}: ${message}`;
}

/** Diagnostics of the generated file (`name` is used in the messages) plus any option / global diagnostic. */
export function typecheckGenerated(code: string, name = "generated.ts"): string[] {
    const program = createProgram(code, OPTIONS);
    const generated = program.getSourceFile(VIRTUAL_PATH);
    if (generated === undefined) throw new Error("the generated file did not make it into the program");
    return [
        ...program.getOptionsDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...program.getSyntacticDiagnostics(generated),
        ...program.getSemanticDiagnostics(generated),
    ].map((diagnostic) => format(diagnostic, name));
}

/**
 * Diagnostics of the installed library's declaration files (every
 * `node_modules/@fozy-labs/rx-toolkit/**` file the generated file pulls in)
 * plus any option / global diagnostic; expected empty. The generated file
 * itself and the library's own dependencies (`rxjs`, `react`, …) are not
 * reported.
 */
export function typecheckLibrary(code: string): string[] {
    const program = createProgram(code, LIBRARY_OPTIONS);
    const libraryFiles = program.getSourceFiles().filter((sourceFile) => isLibraryFile(sourceFile.fileName));
    if (libraryFiles.length === 0) throw new Error(`${LIBRARY_PACKAGE} did not make it into the program`);
    return [
        ...program.getOptionsDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...libraryFiles.flatMap((sourceFile) => [
            ...program.getSyntacticDiagnostics(sourceFile),
            ...program.getSemanticDiagnostics(sourceFile),
        ]),
    ].map((diagnostic) => format(diagnostic, "generated.ts"));
}
