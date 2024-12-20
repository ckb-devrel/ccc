import MonacoEditor from "@monaco-editor/react";
import { LoaderCircle } from "lucide-react";
import { editor } from "monaco-editor";
import { useEffect, useRef, useState } from "react";

const CCCSource = require.context(
  "!!raw-loader!../../../../",
  true,
  /^\.\/[^\/]*\/(dist\.commonjs\/.*\.d\.ts|package.json)$/
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
    undefined
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
    <div className="h-full w-full relative">
      <MonacoEditor
        className="h-[60vh] lg:h-auto w-full"
        theme="vs-dark"
        defaultLanguage="typescript"
        defaultPath="/index.ts"
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
          });

          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [
              // top-level return
              1108,
            ],
          });

          CCCSource.keys().forEach((key: string) => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
              CCCSource(key).default,
              "file:///node_modules/@ckb-ccc/" + key.replace("./", "")
            );
          });
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            "import { ccc } from '@ckb-ccc/core'; export function render(tx: ccc.Transaction): Promise<void>; export const signer: ccc.Signer; export const client: ccc.Client;",
            "file:///node_modules/@ckb-ccc/playground/index.d.ts"
          );

          setEditor(editor);
          onMount?.(editor);
        }}
      />
      {isLoading ? (
        <div className="absolute left-0 top-0 w-full h-full bg-white/25 flex flex-col justify-center items-center">
          <LoaderCircle className="animate-spin mb-2" size="48" />
          Loading...
        </div>
      ) : undefined}
    </div>
  );
}
