"use client";

import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";


interface HexInputProps {
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  label?: string;
  placeholder?: string;
}

interface HexArrayInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}

export const HexInput: React.FC<HexInputProps> = ({
  value,
  label = "Hex Value",
  placeholder = "Enter hex value (with 0x prefix)",
  onChange,
  onRemove,
}) => {
  return (
    <div className="flex w-full flex-col gap-2 rounded border p-2">
      <TextInput
        label={label}
        placeholder={placeholder}
        state={[
          value,
          (newValue) => {
            // Ensure hex format
            const hexValue = newValue.startsWith("0x")
              ? newValue
              : `0x${newValue}`;
            onChange(hexValue);
          },
        ]}
        className="w-full"
      />
      {onRemove && (
        <Button
          onClick={onRemove}
          className="self-start rounded bg-red-500 px-2 py-1 text-white"
        >
          Remove
        </Button>
      )}
    </div>
  );
};

export const HexArrayInput: React.FC<HexArrayInputProps> = ({
  value = [],
  onChange,
  label = "Hex Values",
}) => {
  const addHexValue = () => {
    onChange([...value, "0x"]);
  };

  const removeHexValue = (index: number) => {
    const newValues = [...value];
    newValues.splice(index, 1);
    onChange(newValues);
  };

  const updateHexValue = (index: number, hexValue: string) => {
    const newValues = [...value];
    newValues[index] = hexValue;
    onChange(newValues);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="font-semibold">{label}</label>
      {value.map((hexValue, index) => (
        <HexInput
          key={index}
          value={hexValue}
          label={`Hex Value ${index + 1}`}
          placeholder={`Enter hex value (with 0x prefix)`}
          onChange={(updatedValue) => updateHexValue(index, updatedValue)}
          onRemove={() => removeHexValue(index)}
        />
      ))}
      <Button
        onClick={addHexValue}
        className="self-start rounded bg-green-500 px-2 py-1 text-white"
      >
        Add Hex Value
      </Button>
    </div>
  );
};