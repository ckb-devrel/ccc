import React from 'react';
import { TextInput } from './Input';
import { Dropdown } from './Dropdown';

type HashType = "type" | "data" | "data1" | "data2";
const HASH_TYPES: HashType[] = ["type", "data", "data1", "data2"];

interface SSRIParamsInputProps {
  params: {
    script?: {
      code_hash: string;
      hash_type: HashType;
      args: string;
    };
    cell?: {
      cell_output: {
        capacity: string;
        lock: {
          code_hash: string;
          hash_type: HashType;
          args: string;
        };
        type?: {
          code_hash: string;
          hash_type: HashType;
          args: string;
        };
      };
      hex_data: string;
    };
    transaction?: {
      inner: any; // TransactionLike type
      hash: string;
    };
    noCache?: boolean;
    sendNow?: boolean;
    signer?: any; // Signer type
  };
  onChange: (params: any) => void;
}

export const SSRIParamsInput: React.FC<SSRIParamsInputProps> = ({ params, onChange }) => {
  const updateScript = (field: string, value: string) => {
    onChange((prevParams: { script: any; }) => ({
      ...prevParams,
      script: {
        ...prevParams.script,
        code_hash: prevParams.script?.code_hash || '',
        hash_type: prevParams.script?.hash_type || 'type',
        args: prevParams.script?.args || '',
        [field]: value
      }
    }));
  };

  const updateCell = (field: string, value: string) => {
    const fieldPath = field.split('.');
    
    // Create a new cell object to avoid mutating state directly
    const newCell = {
      cell_output: {
        ...params.cell?.cell_output,
        capacity: params.cell?.cell_output.capacity || '',
        lock: {
          ...params.cell?.cell_output.lock,
          code_hash: params.cell?.cell_output.lock.code_hash || '',
          hash_type: params.cell?.cell_output.lock.hash_type || 'type',
          args: params.cell?.cell_output.lock.args || ''
        },
        type: {
          ...params.cell?.cell_output.type,
          code_hash: params.cell?.cell_output.type?.code_hash || '',
          hash_type: params.cell?.cell_output.type?.hash_type || 'type',
          args: params.cell?.cell_output.type?.args || ''
        }
      },
      hex_data: params.cell?.hex_data || ''
    };

    // Handle nested updates
    let current: any = newCell;
    for (let i = 0; i < fieldPath.length - 1; i++) {
      current = current[fieldPath[i]];
    }
    current[fieldPath[fieldPath.length - 1]] = value;

    onChange({
      ...params,
      cell: newCell
    });
  };

  const updateTransaction = (field: string, value: string) => {
    onChange({
      ...params,
      transaction: {
        ...params.transaction,
        [field]: value
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-2 items-center">
        <input
          type="checkbox"
          checked={!!params.noCache}
          onChange={(e) => onChange({ ...params, noCache: e.target.checked })}
        />
        <label>No Cache</label>
        <input
          type="checkbox"
          checked={!!params.sendNow}
          onChange={(e) => onChange({ ...params, sendNow: e.target.checked })}
        />
        <label>Send Now</label>
      </div>

      <details>
        <summary className="cursor-pointer font-bold">Script Parameters</summary>
        <div className="pl-4 pt-2 flex flex-col gap-2">
          <TextInput
            label="Code Hash"
            placeholder="Enter code hash"
            state={[
              params.script?.code_hash || '',
              (value) => updateScript('code_hash', value)
            ]}
          />
          <div className="flex flex-row items-center gap-2">
            <label className="min-w-32">Hash Type:</label>
            <Dropdown
              options={HASH_TYPES.map(type => ({
                name: type,
                displayName: type,
                iconName: "Hash"
              }))}
              selected={params.script?.hash_type || "type"}
              onSelect={(value) => updateScript('hash_type', value)}
            />
          </div>
          <TextInput
            label="Args"
            placeholder="Enter args"
            state={[
              params.script?.args || '',
              (value) => updateScript('args', value)
            ]}
          />
        </div>
      </details>

      <details>
        <summary className="cursor-pointer font-bold">Cell Parameters</summary>
        <div className="pl-4 pt-2 flex flex-col gap-2">
          <TextInput
            label="Capacity"
            placeholder="Enter capacity"
            state={[
              params.cell?.cell_output.capacity || '',
              (value) => updateCell('cell_output.capacity', value)
            ]}
          />
          <TextInput
            label="Lock Code Hash"
            placeholder="Enter lock code hash"
            state={[
              params.cell?.cell_output.lock.code_hash || '',
              (value) => updateCell('cell_output.lock.code_hash', value)
            ]}
          />
          <div className="flex flex-row items-center gap-2">
            <label className="min-w-32">Lock Hash Type:</label>
            <Dropdown
              options={HASH_TYPES.map(type => ({
                name: type,
                displayName: type,
                iconName: "Hash"
              }))}
              selected={params.cell?.cell_output.lock.hash_type || "type"}
              onSelect={(value) => updateCell('cell_output.lock.hash_type', value)}
            />
          </div>
          <TextInput
            label="Lock Args"
            placeholder="Enter lock args"
            state={[
              params.cell?.cell_output.lock.args || '',
              (value) => updateCell('cell_output.lock.args', value)
            ]}
          />
          <TextInput
            label="Type Code Hash"
            placeholder="Enter type code hash"
            state={[
              params.cell?.cell_output.type?.code_hash || '',
              (value) => updateCell('cell_output.type.code_hash', value)
            ]}
          />
          <div className="flex flex-row items-center gap-2">
            <label className="min-w-32">Type Hash Type:</label>
            <Dropdown
              options={HASH_TYPES.map(type => ({
                name: type,
                displayName: type,
                iconName: "Hash"
              }))}
              selected={params.cell?.cell_output.type?.hash_type || "type"}
              onSelect={(value) => updateCell('cell_output.type.hash_type', value)}
            />
          </div>
          <TextInput
            label="Type Args"
            placeholder="Enter type args"
            state={[
              params.cell?.cell_output.type?.args || '',
              (value) => updateCell('cell_output.type.args', value)
            ]}
          />
          <TextInput
            label="Hex Data"
            placeholder="Enter hex data"
            state={[
              params.cell?.hex_data || '',
              (value) => updateCell('hex_data', value)
            ]}
          />
        </div>
      </details>

      <details>
        <summary className="cursor-pointer font-bold">Transaction Parameters</summary>
        <div className="pl-4 pt-2 flex flex-col gap-2">
          <TextInput
            label="Transaction Hash"
            placeholder="Enter transaction hash"
            state={[
              params.transaction?.hash || '',
              (value) => updateTransaction('hash', value)
            ]}
          />
        </div>
      </details>
    </div>
  );
};
