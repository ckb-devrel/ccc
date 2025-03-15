import React, { useEffect, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import JsonView from "@uiw/react-json-view";
import { useApp } from "@/src/context";
import { Button } from "@/src/components/Button";
import { Textarea } from "@/src/components/Textarea";
import { darkTheme } from "@uiw/react-json-view/dark";
import { Dropdown } from "@/src/components/Dropdown";
export type UnpackType =
  | string
  | number
  | undefined
  | { [property: string]: UnpackType }
  | UnpackType[];

type Props = {
  codec: ccc.mol.Codec<any, any> | undefined;
  mode: "decode" | "encode";
};

const formatInput = (input: string): string => {
  if (!input.startsWith("0x")) {
    return `0x${input}`;
  }
  return input;
};

const isBlank = (data: UnpackType): boolean => {
  if (!data) {
    return true;
  }
  return false;
};

export const DataInput: React.FC<Props> = ({ codec, mode }) => {
  const [inputData, setInputData] = useState<string>("");
  const [decodeResult, setDecodeResult] = useState<UnpackType>(undefined);
  const [encodeResult, setEncodeResult] = useState<ccc.Hex | undefined>(
    undefined,
  );
  const { createSender } = useApp();
  const { log, error } = createSender("Molecule");

  const handleDecode = () => {
    if (!codec) {
      error("please select codec");
      return;
    }
    try {
      const result = codec.decode(formatInput(inputData));
      log("Successfully decoded data");
      setDecodeResult(result);
    } catch (e: unknown) {
      setDecodeResult(undefined);
      error((e as Error).message);
    }
  };

  const handleEncode = () => {
    if (!codec) {
      error("please select codec");
      return;
    }
    try {
      const inputObject = JSON.parse(inputData);
      const result = codec.encode(inputObject);
      log("Successfully encoded data");
      setEncodeResult(ccc.hexFrom(result));
    } catch (e: unknown) {
      setEncodeResult(undefined);
      error((e as Error).message);
    }
  };

  // If mode changes, clear the input data
  useEffect(() => {
    setInputData("");
    setDecodeResult(undefined);
    setEncodeResult(undefined);
  }, [mode]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="input-data">Input data</label>
        <div>
          <Textarea
            id="input-data"
            state={[inputData, setInputData]}
            placeholder={
              mode === "decode" ? "0x..." : "Please input data in JSON Object"
            }
          />
        </div>
      </div>

      {mode === "decode" && (
        <div style={{ marginBottom: 16 }}>
          <Button type="button" onClick={handleDecode}>
            Decode
          </Button>
        </div>
      )}

      {mode === "encode" && (
        <div style={{ marginBottom: 16 }}>
          <Button type="button" onClick={handleEncode}>
            Encode
          </Button>
        </div>
      )}

      {!isBlank(decodeResult) && (
        <div>
          <JsonView
            value={
              typeof decodeResult === "object"
                ? decodeResult
                : { value: decodeResult }
            }
            style={darkTheme}
          />
        </div>
      )}

      {encodeResult && (
        <div>
          <JsonView value={{ value: encodeResult }} style={darkTheme} />
        </div>
      )}
    </div>
  );
};
