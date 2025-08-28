import {
  HexArrayInput,
  HexInput,
} from "@/src/app/connected/(tools)/SSRI/components/HexArrayInput";
import {
  ScriptAmountArrayInput,
  ScriptAmountInput,
  ScriptAmountType,
} from "@/src/app/connected/(tools)/SSRI/components/ScriptAmountInput";
import { Button } from "@/src/components/Button";
import { Icon } from "@/src/components/Icon";
import { TextInput } from "@/src/components/Input";
import { ccc } from "@ckb-ccc/connector-react";
import { ssri } from "@ckb-ccc/ssri";
import { MethodParam, PARAM_TYPE_OPTIONS, ParamValue } from "../types";

interface ParameterInputProps {
  param: MethodParam;
  index: number;
  paramValues: Record<string, ParamValue>;
  setParamValues: (values: Record<string, ParamValue>) => void;
  methodToCall?: string;
  rawMethodPath?: string;
  methodPathInput?: string;
  setMethodPathInput?: (value: string) => void;
  onDelete?: () => void;
}

export function ParameterInput({
  param,
  index,
  paramValues,
  setParamValues,
  methodToCall,
  rawMethodPath,
  methodPathInput,
  setMethodPathInput,
  onDelete,
}: ParameterInputProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateParamValue = (value: any) => {
    setParamValues({
      ...paramValues,
      [`Parameter${index}`]: value,
    });
  };

  const renderInputByType = () => {
    switch (param.type) {
      case "hex":
        return renderHexInput();
      case "scriptArray":
        return renderScriptArrayInput();
      case "hexArray":
        return renderHexArrayInput();
      case "contextScript":
      case "script":
        return renderScriptInput();
      case "contextCell":
        return renderCellInput();
      case "contextTransaction":
        return renderTransactionInput();
      case "tx":
        return renderTxInput();
      case "stringArray":
        return renderStringArrayInput();
      case "uint64":
      case "uint128":
        return renderNumberInput();
      case "uint64Array":
      case "uint128Array":
        return renderNumberArrayInput();
      case "byte32":
        return renderByte32Input();
      case "byte32Array":
        return renderByte32ArrayInput();
      case "scriptAmountArray":
        return renderScriptAmountArrayInput();
      case "signer":
        return renderSignerInput();
      default:
        return renderDefaultInput();
    }
  };

  const renderSignerInput = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">Parameter {index}: (Signer)</label>
        <label className="text-sm font-bold">
          Using the signer of the current wallet
        </label>
      </div>
    </div>
  );

  const renderHexInput = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="font-bold">Parameter {index}: (Generic Data)</label>
      </div>
      <TextInput
        label="Hex Data"
        placeholder="Enter hex value (0x-prefixed)"
        state={[
          (paramValues[`Parameter${index}`] || "") as string,
          (value: string) => {
            if (!value.startsWith("0x")) value = "0x" + value;
            updateParamValue(value);
          },
        ]}
      />
    </div>
  );

  const renderScriptArrayInput = () => (
    <ScriptAmountArrayInput
      label={`Parameter ${index} (${param.type})`}
      value={(paramValues[`Parameter${index}`] as ScriptAmountType[]) ?? []}
      onChange={(scriptAmounts) => updateParamValue(scriptAmounts)}
      showAmount={false}
    />
  );

  const renderScriptAmountArrayInput = () => (
    <ScriptAmountArrayInput
      label={`Parameter ${index} (${param.type})`}
      value={(paramValues[`Parameter${index}`] as ScriptAmountType[]) ?? []}
      onChange={(scriptAmounts) => updateParamValue(scriptAmounts)}
      showAmount={true}
    />
  );

  const renderHexArrayInput = () => (
    <>
      <HexArrayInput
        label={`Parameter ${index} (${param.type})`}
        value={(paramValues[`Parameter${index}`] as string[]) ?? []}
        onChange={(hexValues) => updateParamValue(hexValues)}
      />
      {param.type === "hexArray" &&
        rawMethodPath === "SSRI.has_methods" &&
        setMethodPathInput && (
          <div className="mt-2 flex flex-row items-center gap-2">
            <TextInput
              label="Method Path Generator"
              placeholder="Enter method name to generate path"
              state={[methodPathInput || "", setMethodPathInput]}
              className="grow"
            />
            <Button
              onClick={() => {
                const path = ssri.getMethodPath(methodPathInput || "");
                const currentValues =
                  (paramValues[`Parameter${index}`] as string[]) || [];
                updateParamValue([...currentValues, path]);
              }}
              className="shrink-0"
            >
              Generate & Add Path
            </Button>
          </div>
        )}
    </>
  );

  const renderScriptInput = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">
          Parameter {index}: (
          {
            PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
              ?.displayName
          }
          )
        </label>
      </div>
      <ScriptAmountInput
        showAmount={false}
        value={{
          script: paramValues[`Parameter${index}`] as ccc.ScriptLike,
          amount: undefined,
        }}
        onChange={(updatedScriptAmount) =>
          updateParamValue({
            codeHash: updatedScriptAmount.script?.codeHash ?? "",
            hashType: updatedScriptAmount.script?.hashType ?? "type",
            args: updatedScriptAmount.script?.args ?? "",
          })
        }
      />
    </div>
  );

  const renderCellInput = () => (
    <details open>
      <summary className="cursor-pointer font-bold">
        Parameter {index}: (
        {
          PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
            ?.displayName
        }
        )
      </summary>
      <div className="flex flex-col gap-2 pt-2 pl-4">
        <TextInput
          label="Capacity"
          placeholder="Enter capacity"
          state={[
            (
              paramValues[`Parameter${index}`] as ccc.CellLike
            )?.cellOutput?.capacity?.toString() || "",
            (value) =>
              updateParamValue({
                outPoint: { txHash: "0x", index: 0 },
                cellOutput: {
                  capacity: value,
                  lock: (paramValues[`Parameter${index}`] as ccc.CellLike)
                    ?.cellOutput?.lock ?? {
                    codeHash: "",
                    hashType: "type",
                    args: "",
                  },
                  type: (paramValues[`Parameter${index}`] as ccc.CellLike)
                    ?.cellOutput?.type ?? {
                    codeHash: "",
                    hashType: "type",
                    args: "",
                  },
                },
                outputData:
                  (paramValues[`Parameter${index}`] as ccc.CellLike)
                    ?.outputData || "",
              } as ccc.CellLike),
          ]}
        />
        <TextInput
          label="Data"
          placeholder="Enter cell data in Hex"
          state={[
            (
              paramValues[`Parameter${index}`] as ccc.CellLike
            )?.outputData?.toString() || "",
            (value) =>
              updateParamValue({
                outPoint: { txHash: "0x", index: 0 },
                cellOutput: {
                  capacity:
                    (
                      paramValues[`Parameter${index}`] as ccc.CellLike
                    )?.cellOutput?.capacity?.toString() || "",
                  lock: (paramValues[`Parameter${index}`] as ccc.CellLike)
                    ?.cellOutput?.lock ?? {
                    codeHash: "",
                    hashType: "type",
                    args: "",
                  },
                  type: (paramValues[`Parameter${index}`] as ccc.CellLike)
                    ?.cellOutput?.type ?? {
                    codeHash: "",
                    hashType: "type",
                    args: "",
                  },
                },
                outputData: value,
              } as ccc.CellLike),
          ]}
        />
        <label className="min-w-24">Lock:</label>
        <ScriptAmountInput
          showAmount={false}
          value={{
            script: (paramValues[`Parameter${index}`] as ccc.CellLike)
              ?.cellOutput?.lock,
            amount: undefined,
          }}
          onChange={(updatedScriptAmount) =>
            updateParamValue({
              outPoint: { txHash: "0x", index: 0 },
              cellOutput: {
                capacity:
                  (
                    paramValues[`Parameter${index}`] as ccc.CellLike
                  )?.cellOutput?.capacity?.toString() || "",
                lock: {
                  codeHash: updatedScriptAmount.script?.codeHash ?? "",
                  hashType: updatedScriptAmount.script?.hashType ?? "type",
                  args: updatedScriptAmount.script?.args ?? "",
                },
                type: (paramValues[`Parameter${index}`] as ccc.CellLike)
                  ?.cellOutput?.type ?? {
                  codeHash: "",
                  hashType: "type",
                  args: "",
                },
              },
              outputData:
                (paramValues[`Parameter${index}`] as ccc.CellLike)
                  ?.outputData || "",
            } as ccc.CellLike)
          }
        />
        <div className="flex items-center gap-2">
          <label className="min-w-24">Type:</label>
          <label>
            <input
              type="checkbox"
              checked={
                !(paramValues[`Parameter${index}NotUsingNoneType`] ?? false)
              }
              onChange={(e) =>
                setParamValues({
                  ...paramValues,
                  [`Parameter${index}NotUsingNoneType`]: !e.target.checked,
                  ...(!e.target.checked && {
                    [`Parameter${index}`]: undefined,
                  }),
                })
              }
            />
            Use None
          </label>
        </div>

        {(paramValues[`Parameter${index}NotUsingNoneType`] ?? false) && (
          <ScriptAmountInput
            showAmount={false}
            value={{
              script: (paramValues[`Parameter${index}`] as ccc.CellLike)
                ?.cellOutput?.type ?? {
                codeHash: "",
                hashType: "type",
                args: "",
              },
              amount: undefined,
            }}
            onChange={(updatedScriptAmount) =>
              updateParamValue({
                outPoint: { txHash: "0x", index: 0 },
                cellOutput: {
                  capacity:
                    (
                      paramValues[`Parameter${index}`] as ccc.CellLike
                    )?.cellOutput?.capacity?.toString() || "",
                  type: {
                    codeHash: updatedScriptAmount.script?.codeHash ?? "",
                    hashType: updatedScriptAmount.script?.hashType ?? "type",
                    args: updatedScriptAmount.script?.args ?? "",
                  },
                  lock: (paramValues[`Parameter${index}`] as ccc.CellLike)
                    ?.cellOutput?.lock ?? {
                    codeHash: "",
                    hashType: "type",
                    args: "",
                  },
                },
                outputData:
                  (paramValues[`Parameter${index}`] as ccc.CellLike)
                    ?.outputData || "",
              } as ccc.CellLike)
            }
          />
        )}
      </div>
    </details>
  );

  const renderTransactionInput = () => (
    <details open>
      <summary className="cursor-pointer font-bold">
        Parameter {index}: (
        {
          PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
            ?.displayName
        }
        )
      </summary>
      <div className="flex flex-col gap-2 pt-2 pl-4">
        <TextInput
          label="Transaction Data (Hex)"
          placeholder="Enter transaction data in hex format"
          state={[
            (
              paramValues[`Parameter${index}`] as ccc.TransactionLike
            )?.toString() || "0x",
            (value) => {
              if (!value.startsWith("0x")) value = "0x" + value;
              updateParamValue(value);
            },
          ]}
        />
      </div>
    </details>
  );

  const renderTxInput = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">
          Parameter {index}:{" "}
          {
            PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
              ?.displayName
          }
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={
              !(paramValues[`Parameter${index}NotUsingDefault`] ?? false)
            }
            onChange={(e) =>
              setParamValues({
                ...paramValues,
                [`Parameter${index}NotUsingDefault`]: !e.target.checked,
                ...(!e.target.checked && { [`Parameter${index}`]: undefined }),
              })
            }
            className="rounded border-gray-300"
          />
          Leave Blank
        </label>
      </div>
      {paramValues[`Parameter${index}NotUsingDefault`] && (
        <div className="flex flex-col gap-2 pt-2 pl-4">
          <TextInput
            label="Transaction Data (Hex)"
            placeholder="Enter transaction data in hex format"
            state={[
              (
                paramValues[`Parameter${index}`] as ccc.TransactionLike
              )?.toString() || "0x",
              (value) => {
                if (!value.startsWith("0x")) value = "0x" + value;
                updateParamValue(value);
              },
            ]}
          />
        </div>
      )}
    </div>
  );

  const renderStringArrayInput = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="font-bold">Parameter {index}: (String Array)</label>
      </div>
      <TextInput
        label="String Array"
        placeholder="Enter comma-separated string values. Will trim start and end of each string."
        state={[
          (paramValues[`Parameter${index}`] || "") as string,
          (value: string) => updateParamValue(value.split(",")),
        ]}
      />
    </div>
  );

  const renderNumberInput = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">
          Parameter {index}: (
          {
            PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
              ?.displayName
          }
          )
        </label>
      </div>
      <TextInput
        label="Number"
        placeholder="Enter number value"
        state={[
          (paramValues[`Parameter${index}`] || 0) as string,
          (value: string) => {
            const num = Number(value);
            if (!isNaN(num)) {
              updateParamValue(num);
            }
          },
        ]}
      />
    </div>
  );

  const renderNumberArrayInput = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">
          Parameter {index}: (
          {
            PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
              ?.displayName
          }
          )
        </label>
      </div>
      <TextInput
        label="Number Array"
        placeholder="Enter comma-separated number values"
        state={[
          (paramValues[`Parameter${index}`] || "") as string,
          (value: string) =>
            updateParamValue(
              value
                .split(",")
                .map(Number)
                .filter((num) => !isNaN(num)),
            ),
        ]}
      />
    </div>
  );

  const renderByte32Input = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">
          Parameter {index}:{" "}
          {
            PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
              ?.displayName
          }
        </label>
      </div>
      <HexInput
        value={(paramValues[`Parameter${index}`] as string) ?? "0x"}
        label="Byte32 Hex Value"
        placeholder="Enter byte32 value"
        onChange={(value) => updateParamValue(value)}
      />
    </div>
  );

  const renderByte32ArrayInput = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">
          Parameter {index}: (
          {
            PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
              ?.displayName
          }
          )
        </label>
      </div>
      <HexArrayInput
        value={(paramValues[`Parameter${index}`] as string[]) ?? []}
        onChange={(hexValues) => updateParamValue(hexValues)}
        label="Byte32 Array Hex Values"
      />
    </div>
  );

  const renderDefaultInput = () => (
    <div>
      <div className="flex items-center gap-2">
        <label className="font-bold">
          Parameter {index}: (
          {
            PARAM_TYPE_OPTIONS.find((option) => option.name === param.type)
              ?.displayName
          }
          )
        </label>
      </div>
      <TextInput
        label={param.name}
        placeholder={`Enter ${param.name} value`}
        state={[
          (paramValues[`Parameter${index}`] || "") as string,
          (value: string) => updateParamValue(value),
        ]}
      />
    </div>
  );

  return (
    <div className="flex w-full flex-row items-center gap-2">
      <div className="grow">{renderInputByType()}</div>
      {methodToCall === "Customized" && onDelete && (
        <Button onClick={onDelete}>
          <Icon name="Trash" />
        </Button>
      )}
    </div>
  );
}
