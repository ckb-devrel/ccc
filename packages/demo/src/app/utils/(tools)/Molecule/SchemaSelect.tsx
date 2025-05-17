import React from "react";
import { ccc } from "@ckb-ccc/connector-react";
import { Dropdown } from "@/src/components/Dropdown";

type Props = {
  CodecDefinitions: ccc.molecule.CodecDefinitions;
  selectedCodecName: string;
  onSelectCodec: (name: string) => void;
  mode: "decode" | "encode";
  onSelectMode: (mode: "decode" | "encode") => void;
};

const createCodecOptionsFromMap = (
  CodecDefinitions: ccc.molecule.CodecDefinitions,
): string[] => {
  return Object.keys(CodecDefinitions);
};

export const SchemaSelect: React.FC<Props> = ({
  onSelectCodec,
  selectedCodecName,
  CodecDefinitions,
  mode,
  onSelectMode,
}) => {
  const handleChange = (newValue: string | null) => {
    onSelectCodec(newValue as string);
  };
  const schemaOptions = createCodecOptionsFromMap(CodecDefinitions).map(
    (schema) => ({
      name: schema,
      displayName: schema,
      iconName: "Hash" as const,
    }),
  );

  return (
    <div className="flex flex-row items-center gap-4">
      <label className="min-w-32 shrink-0">Select schema(mol)</label>
      <Dropdown
        options={schemaOptions}
        selected={selectedCodecName}
        onSelect={(value: string | null) => handleChange(value)}
        className="flex-1"
      />
      <label htmlFor="mode">Mode</label>
      <Dropdown
        options={[
          {
            name: "decode",
            displayName: "Decode",
            iconName: "ArrowRight",
          },
          {
            name: "encode",
            displayName: "Encode",
            iconName: "ArrowLeft",
          },
        ]}
        selected={mode}
        onSelect={(value) => onSelectMode(value as "decode" | "encode")}
        className="flex-2"
      />
    </div>
  );
};
