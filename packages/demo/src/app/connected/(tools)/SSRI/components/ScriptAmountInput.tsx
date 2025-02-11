import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { Dropdown } from "@/src/components/Dropdown";
import { ccc } from "@ckb-ccc/connector-react";
import { Icon } from "../../../../../components/Icon";

export type ScriptAmountType = {
  script: ccc.ScriptLike;
  amount?: string;
};

export interface ScriptAmountArrayInputProps {
  value: ScriptAmountType[];
  onChange: (value: ScriptAmountType[]) => void;
  label?: string;
  showAmount?: boolean;
}

export interface ScriptAmountInputProps {
  value: ScriptAmountType;
  onChange: (value: ScriptAmountType) => void;
  onRemove?: () => void;
  showAmount?: boolean;
}

export const ScriptAmountInput: React.FC<ScriptAmountInputProps> = ({
  value,
  onChange,
  onRemove,
  showAmount = true,
}) => {
  const [inputType, setInputType] = useState<"script" | "address">("address");
  const [address, setAddress] = useState("");
  const { signer } = useApp();

  // Handle address to script conversion
  const handleAddressChange = async (newAddress: string) => {
    setAddress(newAddress);
    if (signer && newAddress) {
      try {
        const script = (await ccc.Address.fromString(newAddress, signer.client))
          .script;
        onChange({
          ...value,
          script: {
            codeHash: script.codeHash,
            hashType: script.hashType,
            args: script.args,
          },
        });
      } catch (error) {
        console.error("Failed to parse address:", error);
      }
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded border p-2">
      <div className="flex flex-row items-center gap-2">
        <label className="min-w-24">Input Type:</label>
        <Dropdown
          options={[
            { name: "script", displayName: "Script", iconName: "Code" },
            { name: "address", displayName: "Address", iconName: "Mail" },
          ]}
          selected={inputType}
          onSelect={(type) => setInputType(type as "script" | "address")}
          className="flex-grow"
        />
      </div>

      {inputType === "address" ? (
        <TextInput
          label="Address"
          placeholder="Enter CKB address"
          state={[address, handleAddressChange]}
          className="w-full"
        />
      ) : (
        <>
          <TextInput
            label="Code Hash"
            placeholder="Enter code hash"
            state={[
              value.script?.codeHash?.toString() ?? "",
              (codeHash) =>
                onChange({ ...value, script: { ...value.script, codeHash } }),
            ]}
            className="w-full"
          />
          <div className="flex flex-row items-center gap-2">
            <label className="min-w-24">Hash Type:</label>
            <Dropdown
              options={[
                { name: "type", displayName: "Type", iconName: "Pill" },
                { name: "data", displayName: "Data", iconName: "Pill" },
                { name: "data1", displayName: "Data1", iconName: "Pill" },
                { name: "data2", displayName: "Data2", iconName: "Pill" },
              ]}
              selected={value.script?.hashType?.toString() ?? "type"}
              onSelect={(hashType) =>
                onChange({ ...value, script: { ...value.script, hashType } })
              }
              className="flex-grow"
            />
          </div>
          <TextInput
            label="Args"
            placeholder="Enter args"
            state={[
              value.script?.args?.toString() ?? "",
              (args) =>
                onChange({ ...value, script: { ...value.script, args } }),
            ]}
            className="w-full"
          />
        </>
      )}

      {showAmount && (
        <TextInput
          label="Amount"
          placeholder="Enter amount"
          state={[
            value.amount || "",
            (amount) => onChange({ ...value, amount }),
          ]}
          className="w-full"
        />
      )}
      {onRemove && (
        <Button
          onClick={onRemove}
          className="self-start rounded bg-red-500 px-2 py-1 text-white"
        >
          <Icon name="Minus" />
        </Button>
      )}
    </div>
  );
};

export const ScriptAmountArrayInput: React.FC<ScriptAmountArrayInputProps> = ({
  value = [],
  onChange,
  label = "Scripts with Amounts",
  showAmount = true,
}) => {
  const addScriptAmount = () => {
    const newScript = {
      script: { codeHash: "", hashType: "type", args: "" },
      ...(showAmount && { amount: "0" }),
    };
    onChange([...value, newScript]);
  };

  const removeScriptAmount = (index: number) => {
    const newScriptAmounts = [...value];
    newScriptAmounts.splice(index, 1);
    onChange(newScriptAmounts);
  };

  const updateScriptAmount = (
    index: number,
    scriptAmount: ScriptAmountType,
  ) => {
    const newScriptAmounts = [...value];
    newScriptAmounts[index] = scriptAmount;
    onChange(newScriptAmounts);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="font-semibold">{label}</label>
      {value.map((scriptAmount, index) => (
        <ScriptAmountInput
          key={index}
          value={scriptAmount}
          onChange={(updatedScriptAmount) =>
            updateScriptAmount(index, updatedScriptAmount)
          }
          onRemove={() => removeScriptAmount(index)}
          showAmount={showAmount}
        />
      ))}
      <Button
        onClick={addScriptAmount}
        className="self-start rounded bg-green-500 px-2 py-1 text-white"
      >
        Add Script{showAmount ? " with Amount" : ""}
      </Button>
    </div>
  );
};
