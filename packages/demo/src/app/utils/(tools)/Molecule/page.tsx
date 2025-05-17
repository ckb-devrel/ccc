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

  const [codecRecord, setCodecRecord] = useState<ccc.molecule.CodecRecord>({});
  const [selectedCodecName, setSelectedCodecName] = useState<string>("");
  const [mode, setMode] = useState<"decode" | "encode">("decode");
  const handleCodecRecord = useCallback(
    (codecRecord: ccc.molecule.CodecRecord) => {
      setCodecRecord(codecRecord);
      setSelectedCodecName(Object.keys(codecRecord)[0]);
    },
    [setCodecRecord, setSelectedCodecName],
  );

  const handleSelectCodec = (name: string) => {
    setSelectedCodecName(name);
  };

  useEffect(() => {
    let cachedMol = localStorage.getItem("cachedMol");
    if (!cachedMol) {
      cachedMol = "";
    }

    const userCodecRecord = ccc.molecule.parseMoleculeSchema(
      cachedMol + blockchainSchema,
      {
        extraReferences: builtinCodecs,
      },
    );
    const codecRecord = mergeBuiltinCodecs(userCodecRecord);
    handleCodecRecord(codecRecord);
  }, [handleCodecRecord]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <MoleculeParser updateCodecRecord={handleCodecRecord} />
      {Object.keys(codecRecord).length > 0 && (
        <SchemaSelect
          selectedCodecName={selectedCodecName}
          codecRecord={codecRecord}
          onSelectCodec={handleSelectCodec}
          mode={mode}
          onSelectMode={setMode}
        />
      )}
      {Object.keys(codecRecord).length > 0 && selectedCodecName !== "" && (
        <DataInput codec={codecRecord[selectedCodecName]} mode={mode} />
      )}
    </div>
  );
}
