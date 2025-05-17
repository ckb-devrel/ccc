import React, { useCallback, useState } from "react";
import {
  blockchainSchema,
  builtinCodecs,
  mergeBuiltinCodecs,
} from "./constants";
import { ccc } from "@ckb-ccc/connector-react";
import { useApp } from "@/src/context";
import { Textarea } from "@/src/components/Textarea";
import { Button } from "@/src/components/Button";

type Props = {
  updateCodecDefinitions: (token: any) => void;
};

export const MoleculeParser: React.FC<Props> = ({ updateCodecDefinitions }) => {
  const [inputMol, setInputMol] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cachedMol") || "";
    }
    return "";
  });
  const [parseSuccess, setParseSuccess] = useState(false);
  const { createSender } = useApp();
  const { log, error } = createSender("Molecule");

  const handleConfirm = useCallback(() => {
    try {
      // get user input schema, and append with primitive schema
      const userCodecDefinitions = ccc.molecule.parseMolecule(
        inputMol + blockchainSchema,
        {
          extraReferences: builtinCodecs,
        },
      );
      const CodecDefinitions = mergeBuiltinCodecs(userCodecDefinitions);
      setParseSuccess(true);
      updateCodecDefinitions(CodecDefinitions);
      log("Successfully parsed schema");
      if (typeof window !== "undefined") {
        localStorage.setItem("cachedMol", inputMol);
      }
    } catch (error: any) {
      setParseSuccess(false);
      updateCodecDefinitions({});
      error(error.message);
    }
  }, [inputMol, log, updateCodecDefinitions]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="input-schema">
          Input schema(mol)
          <label title="Uint8/16/.../512, Byte32, BytesVec, Bytes, BytesVec, BytesOpt are used as primitive schemas, please do not override." />
        </label>
        <div>
          <Textarea
            id="input-schema"
            state={[inputMol, setInputMol]}
            placeholder="e.g. vector OutPointVec <OutPoint>;"
          />
        </div>
      </div>

      <div>
        <Button type="button" onClick={handleConfirm}>
          Parse
        </Button>
      </div>
    </div>
  );
};
