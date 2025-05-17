"use client";

import { ccc } from "@ckb-ccc/connector-react";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/src/components/Button";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import {
  blockchainSchema,
  builtinCodecs,
  mergeBuiltinCodecs,
} from "./constants";
import { SchemaSelect } from "./SchemaSelect";
import { DataInput } from "./DataInput";
import { MoleculeParser } from "./Molecule";

export default function Molecule() {
  const { createSender } = useApp();
  const { log } = createSender("Molecule");

  const [CodecDefinitions, setCodecDefinitions] =
    useState<ccc.molecule.CodecDefinitions>({});
  const [selectedCodecName, setSelectedCodecName] = useState<string>("");
  const [mode, setMode] = useState<"decode" | "encode">("decode");
  const handleCodecDefinitions = useCallback(
    (CodecDefinitions: ccc.molecule.CodecDefinitions) => {
      setCodecDefinitions(CodecDefinitions);
      setSelectedCodecName(Object.keys(CodecDefinitions)[0]);
    },
    [setCodecDefinitions, setSelectedCodecName],
  );

  const handleSelectCodec = (name: string) => {
    setSelectedCodecName(name);
  };

  useEffect(() => {
    // TODO: get from local storage
    let cachedMol = localStorage.getItem("cachedMol");
    if (!cachedMol) {
      cachedMol = "";
    }

    const userCodecDefinitions = ccc.molecule.parseMolecule(
      cachedMol + blockchainSchema,
      {
        extraReferences: builtinCodecs,
      },
    );
    const CodecDefinitions = mergeBuiltinCodecs(userCodecDefinitions);
    handleCodecDefinitions(CodecDefinitions);
  }, [handleCodecDefinitions]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <MoleculeParser updateCodecDefinitions={handleCodecDefinitions} />
      {Object.keys(CodecDefinitions).length > 0 && (
        <SchemaSelect
          selectedCodecName={selectedCodecName}
          CodecDefinitions={CodecDefinitions}
          onSelectCodec={handleSelectCodec}
          mode={mode}
          onSelectMode={setMode}
        />
      )}
      {Object.keys(CodecDefinitions).length > 0 && selectedCodecName !== "" && (
        <DataInput codec={CodecDefinitions[selectedCodecName]} mode={mode} />
      )}
    </div>
  );
}
