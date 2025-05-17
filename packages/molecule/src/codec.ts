/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ccc, mol } from "@ckb-ccc/core";
import { byte, CodecDefinitions, MolDefinitions, MolType } from "./type.js";
import { nonNull, toMolDefinitions } from "./utils.js";

const BUILT_IN_ARRAY_CODECS = {
  Uint8: mol.Uint8,
  Uint16: mol.Uint16,
  Uint32: mol.Uint32,
  Uint64: mol.Uint64,
  Uint128: mol.Uint128,
  Uint256: mol.Uint256,
  Uint512: mol.Uint512,
  Byte4: mol.Byte4,
  Byte8: mol.Byte8,
  Byte16: mol.Byte16,
  Byte32: mol.Byte32,
};

/**
 * Returns the codec for the specified type, resolving dependencies as needed, without mutating or adding to outputCodecDefinitions.
 * @param key - The name of the mol type to build a codec for.
 * @param MolDefinitions - The full set of mol type definitions.
 * @param outputCodecDefinitions - Preexisting accumulated codec definitions that can be reused if present.
 * @param extraReferences - (Optional) External codec definitions that can be reused if present.
 * @returns The codec for the specified mol type.
 */
function toCodec(
  key: string,
  MolDefinitions: MolDefinitions,
  outputCodecDefinitions: CodecDefinitions,
  extraReferences?: CodecDefinitions,
): mol.Codec<any, any> {
  if (outputCodecDefinitions[key]) {
    return outputCodecDefinitions[key];
  }
  if (extraReferences?.[key]) {
    return extraReferences[key];
  }
  const molType: MolType = MolDefinitions[key];
  nonNull(molType);
  let codec: mol.Codec<any, any> | null = null;
  switch (molType.type) {
    case "array": {
      const builtInCodec =
        BUILT_IN_ARRAY_CODECS[
          molType.name as keyof typeof BUILT_IN_ARRAY_CODECS
        ];
      // if the molType is a built-in array, use the built-in codec
      if (builtInCodec) {
        return builtInCodec;
      }
      if (molType.name.startsWith("Uint")) {
        throw new Error(
          `Number codecs should be among Uint8, Uint16, Uint32, Uint64, Uint128, Uint256, Uint512 but got ${molType.name}.`,
        );
      }
      if (molType.item === byte) {
        codec = mol.Codec.from({
          byteLength: molType.item_count,
          encode: (value) => ccc.bytesFrom(value),
          decode: (buffer) => ccc.hexFrom(buffer),
        });
      } else {
        const itemMolType = toCodec(
          molType.item,
          MolDefinitions,
          outputCodecDefinitions,
          extraReferences,
        );
        codec = mol.array(itemMolType, molType.item_count);
      }
      break;
    }
    case "vector": {
      if (molType.item === byte) {
        codec = mol.Bytes;
      } else {
        const itemMolType = toCodec(
          molType.item,
          MolDefinitions,
          outputCodecDefinitions,
          extraReferences,
        );
        codec = mol.vector(itemMolType);
      }
      break;
    }
    case "option": {
      if (molType.item === byte) {
        codec = mol.ByteOpt;
      } else {
        const itemMolType = toCodec(
          molType.item,
          MolDefinitions,
          outputCodecDefinitions,
          extraReferences,
        );
        codec = mol.option(itemMolType);
      }
      break;
    }
    case "union": {
      // Tuple of [UnionFieldName, UnionFieldId, UnionTypeCodec]
      const unionCodecs: [string, number, mol.Codec<any, any>][] = [];

      molType.items.forEach((unionTypeItem, index) => {
        if (unionTypeItem === byte) {
          unionCodecs.push([unionTypeItem, index, mol.Byte]);
        } else {
          if (typeof unionTypeItem === "string") {
            const itemMolType = toCodec(
              unionTypeItem,
              MolDefinitions,
              outputCodecDefinitions,
              extraReferences,
            );
            unionCodecs.push([unionTypeItem, index, itemMolType]);
          } else if (Array.isArray(unionTypeItem)) {
            const [key, fieldId] = unionTypeItem;

            const itemMolType = toCodec(
              key,
              MolDefinitions,
              outputCodecDefinitions,
              extraReferences,
            );
            unionCodecs.push([key, fieldId, itemMolType]);
          }
        }
      });

      const unionFieldsCodecs: Record<
        string,
        mol.Codec<any, any>
      > = unionCodecs.reduce(
        (CodecDefinitions, [fieldName, _fieldId, fieldCodec]) =>
          Object.assign(CodecDefinitions, { [fieldName]: fieldCodec }),
        {},
      );
      const unionFieldIds: Record<string, number> = unionCodecs.reduce(
        (idMap, [fieldName, fieldId, _fieldCodec]) =>
          Object.assign(idMap, { [fieldName]: fieldId }),
        {},
      );

      codec = mol.union(unionFieldsCodecs, unionFieldIds);
      break;
    }
    case "table": {
      const tableFields = molType.fields;
      const tableCodecs: Record<string, mol.Codec<any, any>> = {};
      tableFields.forEach((field) => {
        if (field.type === byte) {
          tableCodecs[field.name] = mol.Byte;
        } else {
          const itemMolType = toCodec(
            field.type,
            MolDefinitions,
            outputCodecDefinitions,
            extraReferences,
          );
          tableCodecs[field.name] = itemMolType;
        }
      });
      codec = mol.table(tableCodecs);
      break;
    }
    case "struct": {
      const structFields = molType.fields;
      const structCodecs: Record<string, mol.Codec<any, any>> = {};
      structFields.forEach((field) => {
        if (field.type === byte) {
          structCodecs[field.name] = mol.Byte;
        } else {
          const itemMolType = toCodec(
            field.type,
            MolDefinitions,
            outputCodecDefinitions,
            extraReferences,
          );
          structCodecs[field.name] = itemMolType;
        }
      });
      codec = mol.struct(structCodecs);
      break;
    }
  }
  nonNull(codec);
  return codec;
}

/**
 * Creates codec definitions for all provided mol types, resolving dependencies as needed.
 * @param molTypeInfo - The mol type definitions, either as an array or a Record.
 * @param extraReferences - (Optional) External codec definitions that can be reused if present.
 * @returns An object Record<string, mol.Codec<any, any>> mapping mol type names to their corresponding codecs.
 */
export function createCodecDefinitions(
  molTypeInfo: MolDefinitions | MolType[],
  extraReferences?: CodecDefinitions,
): CodecDefinitions {
  const MolDefinitions = ((data) => {
    if (Array.isArray(data)) {
      return toMolDefinitions(data);
    }
    return data;
  })(molTypeInfo);
  const outputCodecDefinitions: CodecDefinitions = {};
  for (const key in MolDefinitions) {
    const newCodec = toCodec(
      key,
      MolDefinitions,
      outputCodecDefinitions,
      extraReferences,
    );
    outputCodecDefinitions[key] = newCodec;
  }
  return outputCodecDefinitions;
}
