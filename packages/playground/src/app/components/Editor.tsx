/// <reference types="webpack-env" />

import MonacoEditor from "@monaco-editor/react";
import { shikiToMonaco } from "@shikijs/monaco";
import { LoaderCircle } from "lucide-react";
import { editor } from "monaco-editor";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createHighlighter } from "shiki";

const COMMON_REGEX = /^\.\/(.*\.d\.ts|.*\.d\.mts|package.json)$/;
const webpackRequire = require as __WebpackModuleApi.RequireFunction;

const EXTRA_SOURCES = [
  {
    files: webpackRequire.context(
      "../../../node_modules/@types/react",
      true,
      COMMON_REGEX,
    ),
    name: "@types/react",
  },
  {
    files: webpackRequire.context(
      "../../../../",
      true,
      /^\.\/[^\/]*\/(dist\/(.*\.d\.ts|.*\.d\.mts)|package.json)$/,
    ),
    name: "@ckb-ccc",
  },
  {
    files: webpackRequire.context(
      "../../../node_modules/@nervina-labs/dob-render",
      true,
      COMMON_REGEX,
    ),
    name: "@nervina-labs/dob-render",
  },
  {
    files: webpackRequire.context(
      "../../../node_modules/@noble/hashes",
      true,
      COMMON_REGEX,
    ),
    name: "@noble/hashes",
  },
  {
    files: webpackRequire.context(
      "../../../node_modules/@noble/curves",
      true,
      COMMON_REGEX,
    ),
    name: "@noble/curves",
  },
  {
    files: webpackRequire.context(
      "../../../node_modules/@scure/btc-signer",
      true,
      COMMON_REGEX,
    ),
    name: "@scure/btc-signer",
  },
  {
    files: webpackRequire.context(
      "../../../node_modules/@scure/base",
      true,
      COMMON_REGEX,
    ),
    name: "@scure/base",
  },
  {
    files: webpackRequire.context(
      "../../../node_modules/micro-packed",
      true,
      COMMON_REGEX,
    ),
    name: "micro-packed",
  },
];

const NARROW_EDITOR_QUERY = "(max-width: 700px)";
function subscribeToEditorViewport(onChange: () => void) {
  const query = window.matchMedia(NARROW_EDITOR_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function isNarrowEditorViewport() {
  return window.matchMedia(NARROW_EDITOR_QUERY).matches;
}
function serverEditorViewport() {
  return false;
}

export function Editor({
  value,
  onChange,
  isLoading,
  highlight,
  onMount,
  readOnly,
}: {
  value: string;
  onChange: (val: string | undefined) => void;
  isLoading?: boolean;
  readOnly?: boolean;
  highlight?: number[];
  onMount?: (editor: editor.IStandaloneCodeEditor) => void;
}) {
  // Update Monaco options in place, preserving the same model and diagnostics.
  const isNarrow = useSyncExternalStore(
    subscribeToEditorViewport,
    isNarrowEditorViewport,
    serverEditorViewport,
  );
  const [editor, setEditor] = useState<
    editor.IStandaloneCodeEditor | undefined
  >(undefined);
  const decorationRef = useRef<editor.IEditorDecorationsCollection | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (!highlight) {
      decorationRef.current?.clear();
      decorationRef.current = undefined;
      return;
    }

    const decorations = [
      {
        range: {
          startLineNumber: highlight[0] + 1,
          endLineNumber: highlight[1] + 1,
          startColumn: 0,
          endColumn: 0,
        },
        options: {
          isWholeLine: true,
          className: "execution-line",
        },
      },
      {
        range: {
          startLineNumber: highlight[0] + 1,
          endLineNumber: highlight[1] + 1,
          startColumn: highlight[2] + 1,
          endColumn: highlight[3] + 1,
        },
        options: {
          className: "execution-range",
        },
      },
    ];

    if (decorationRef.current) {
      decorationRef.current.set(decorations);
    } else {
      decorationRef.current = editor.createDecorationsCollection(decorations);
    }
  }, [editor, highlight]);

  return (
    <div className="relative h-full w-full">
      <MonacoEditor
        className="h-full w-full"
        theme="vs-dark"
        defaultLanguage="typescript"
        defaultPath="/index.tsx"
        options={{
          padding: { top: 20, bottom: 20 },
          readOnly,
          automaticLayout: true,
          fontSize: isNarrow ? 16 : 13,
          lineHeight: isNarrow ? 24 : 22,
          wordWrap: isNarrow ? "on" : "off",
          lineNumbersMinChars: isNarrow ? 2 : 5,
          glyphMargin: false,
          folding: !isNarrow,
          lineDecorationsWidth: isNarrow ? 4 : 10,
          quickSuggestions: isNarrow
            ? false
            : {
                other: "offWhenInlineCompletions",
                comments: "off",
                strings: "off",
              },
          suggestOnTriggerCharacters: !isNarrow,
          fontFamily: "var(--font-geist-mono), monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
        value={isLoading ? "" : value}
        onChange={onChange}
        onMount={(editor, monaco) => {
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
            module: monaco.languages.typescript.ModuleKind.ESNext,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            moduleResolution: 100 as any, // Bundler
            noImplicitAny: true,
            strictNullChecks: true,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            jsxFactory: "React.createElement",
            reactNamespace: "React",
            allowUmdGlobalAccess: true,
          });

          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [
              // top-level return
              1108,
            ],
          });

          EXTRA_SOURCES.forEach(({ files, name }) => {
            files.keys().forEach((key: string) => {
              monaco.languages.typescript.typescriptDefaults.addExtraLib(
                key.endsWith(".json")
                  ? JSON.stringify(files(key))
                  : files(key).default,
                `file:///node_modules/${name}/${key.replace("./", "")}`,
              );
            });
          });

          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            "import { ccc } from '@ckb-ccc/core'; export function render(...msgs: unknown[]): Promise<void>; export const signer: ccc.Signer; export const client: ccc.Client;",
            "file:///node_modules/@ckb-ccc/playground/index.d.ts",
          );
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            '{ "type": "commonjs" }',
            "file:///node_modules/@ckb-ccc/playground/package.json",
          );

          monaco.languages.register({ id: "typescript" });
          createHighlighter({
            themes: ["github-dark"],
            langs: ["typescript"],
          }).then((highlighter) => {
            shikiToMonaco(highlighter, monaco);
          });

          setEditor(editor);
          onMount?.(editor);
        }}
      />
      {isLoading ? (
        <div className="absolute top-0 left-0 flex h-full w-full flex-col items-center justify-center bg-white/25">
          <LoaderCircle className="mb-2 animate-spin" size="48" />
          Loading...
        </div>
      ) : undefined}
    </div>
  );
}
