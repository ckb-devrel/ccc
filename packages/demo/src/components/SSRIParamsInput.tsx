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
    onChange({
      ...params,
      script: {
        ...params.script,
        [field]: value
      }
    });
  };

  const updateCell = (field: string, value: string) => {
    const [section, subfield] = field.split('.');
    if (section === 'cell_output') {
      onChange({
        ...params,
        cell: {
          ...params.cell,
          cell_output: {
            ...params.cell?.cell_output,
            [subfield]: value
          },
          hex_data: params.cell?.hex_data || ''
        }
      });
    } else if (section === 'hex_data') {
      onChange({
        ...params,
        cell: {
          ...params.cell,
          cell_output: params.cell?.cell_output || {
            capacity: '',
            lock: { code_hash: '', hash_type: 'type', args: '' }
          },
          hex_data: value
        }
      });
    }
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
          <Dropdown
            options={HASH_TYPES.map(type => ({
              name: type,
              displayName: type,
              iconName: "Hash"
            }))}
            selected={params.script?.hash_type || "type"}
            onSelect={(value) => updateScript('hash_type', value)}
          />
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
