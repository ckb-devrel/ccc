import MonacoEditor from "@monaco-editor/react";
import { LoaderCircle } from "lucide-react";
import { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { shikiToMonaco } from "@shikijs/monaco";
import { createHighlighter } from "shiki";

const ReactSource = require.context(
  "!!raw-loader!../../../node_modules/@types/react",
  true,
  /^\.\/(.*\.d\.ts|package.json)$/,
);

const CCCSource = require.context(
  "!!raw-loader!../../../../",
  true,
  /^\.\/[^\/]*\/(dist\.commonjs\/.*\.d\.ts|package.json)$/,
);

const DobRenderSource = require.context(
  "!!raw-loader!../../../node_modules/@nervina-labs/dob-render/dist",
  true,
  /^\.\/.*\.d\.ts$/,
);

export function Editor({
  value,
  onChange,
  isLoading,
  highlight,
  onMount,
}: {
  value: string;
  onChange: (val: string | undefined) => void;
  isLoading?: boolean;
  highlight?: number[];
  onMount?: (editor: editor.IStandaloneCodeEditor) => void;
}) {
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
          className: "bg-fuchsia-950",
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
          className: "bg-fuchsia-900",
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
        className="h-[60vh] w-full lg:h-auto"
        defaultLanguage="typescript"
        defaultPath="/index.tsx"
        options={{
          padding: { top: 20 },
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
            moduleResolution: 99 as any, // NodeNext
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

          ReactSource.keys().forEach((key: string) => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              ReactSource(key).default,
              "file:///node_modules/@types/react/" + key.replace("./", ""),
            );
          });

          CCCSource.keys().forEach((key: string) => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              CCCSource(key).default,
              "file:///node_modules/@ckb-ccc/" + key.replace("./", ""),
            );
          });

          DobRenderSource.keys().forEach((key: string) => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              DobRenderSource(key).default,
              `file:///node_modules/@nervina-labs/dob-render/${key.replace("./", "")}`,
            );
          });

          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            "import { ccc } from '@ckb-ccc/core'; export function render(...msgs: unknown[]): Promise<void>; export const signer: ccc.Signer; export const client: ccc.Client;",
            "file:///node_modules/@ckb-ccc/playground/index.d.ts",
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
        <div className="absolute left-0 top-0 flex h-full w-full flex-col items-center justify-center bg-white/25">
          <LoaderCircle className="mb-2 animate-spin" size="48" />
          Loading...
        </div>
      ) : undefined}
    </div>
  );
}
