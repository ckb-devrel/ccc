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
  updateCodecMap: (token: any) => void;
};

export const MoleculeParser: React.FC<Props> = ({ updateCodecMap }) => {
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
    const parser = ccc.molecule.createParser();
    try {
      // get user input schema, and append with primitive schema
      const userCodecMap = parser.parse(inputMol + blockchainSchema, {
        refs: builtinCodecs,
      });
      const codecMap = mergeBuiltinCodecs(userCodecMap);
      setParseSuccess(true);
      updateCodecMap(codecMap);
      log("Successfully parsed schema");
      if (typeof window !== "undefined") {
        localStorage.setItem("cachedMol", inputMol);
      }
    } catch (error: any) {
      setParseSuccess(false);
      updateCodecMap({});
      error(error.message);
    }
  }, [inputMol, log, updateCodecMap]);

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
