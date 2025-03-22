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

  const [codecMap, setCodecMap] = useState<ccc.molecule.CodecMap>({});
  const [selectedCodecName, setSelectedCodecName] = useState<string>("");
  const [mode, setMode] = useState<"decode" | "encode">("decode");
  const handleCodecMap = useCallback(
    (codecMap: ccc.molecule.CodecMap) => {
      setCodecMap(codecMap);
      setSelectedCodecName(Object.keys(codecMap)[0]);
    },
    [setCodecMap, setSelectedCodecName],
  );

  const handleSelectCodec = (name: string) => {
    setSelectedCodecName(name);
  };

  useEffect(() => {
    const parser = ccc.molecule.createParser();
    // TODO: get from local storage
    let cachedMol = localStorage.getItem("cachedMol");
    if (!cachedMol) {
      cachedMol = "";
    }

    const userCodecMap = parser.parse(cachedMol + blockchainSchema, {
      refs: builtinCodecs,
    });
    const codecMap = mergeBuiltinCodecs(userCodecMap);
    handleCodecMap(codecMap);
  }, [handleCodecMap]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <MoleculeParser updateCodecMap={handleCodecMap} />
      {Object.keys(codecMap).length > 0 && (
        <SchemaSelect
          selectedCodecName={selectedCodecName}
          codecMap={codecMap}
          onSelectCodec={handleSelectCodec}
          mode={mode}
          onSelectMode={setMode}
        />
      )}
      {Object.keys(codecMap).length > 0 && selectedCodecName !== "" && (
        <DataInput codec={codecMap[selectedCodecName]} mode={mode} />
      )}
    </div>
  );
}
