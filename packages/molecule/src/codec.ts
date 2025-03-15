/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { bytesFrom, hexFrom, mol } from "@ckb-ccc/core";
import { byte, CodecMap, MolType, MolTypeMap } from "./type";
import { nonNull, toMolTypeMap } from "./utils";

/**
 * Add corresponding type and its dependencies to result, then return corresponding codec
 * @param key
 * @param molTypeMap
 * @param result
 * @returns codec
 */
function toCodec(
  key: string,
  molTypeMap: MolTypeMap,
  result: CodecMap,
  refs?: CodecMap,
): mol.Codec<any, any> {
  if (result[key]) {
    return result[key];
  }
  if (refs && refs[key]) {
    return refs[key];
  }
  const molType: MolType = molTypeMap[key];
  nonNull(molType);
  let codec: mol.Codec<any, any> | null = null;
  switch (molType.type) {
    case "array": {
      if (molType.name.startsWith("Uint")) {
        switch (molType.name) {
          case "Uint8":
            codec = mol.Uint8;
            break;
          case "Uint16":
            codec = mol.Uint16;
            break;
          case "Uint32":
            codec = mol.Uint32;
            break;
          case "Uint64":
            codec = mol.Uint64;
            break;
          case "Uint128":
            codec = mol.Uint128;
            break;
          case "Uint256":
            codec = mol.Uint256;
            break;
          case "Uint512":
            codec = mol.Uint512;
            break;
          default:
            throw new Error(
              `Number codecs should be among Uint8,Uint8,Uint8,Uint8,Uint8,Uint8,Uint8 but got ${molType.name}.`,
            );
        }
      } else if (molType.item === byte) {
        codec = mol.Codec.from({
          byteLength: molType.item_count,
          encode: (value) => bytesFrom(value),
          decode: (buffer) => hexFrom(buffer),
        });
      } else {
        const itemMolType = toCodec(molType.item, molTypeMap, result, refs);
        codec = mol.array(itemMolType, molType.item_count);
      }
      break;
    }
    case "vector": {
      if (molType.item === byte) {
        codec = mol.Bytes;
      } else {
        const itemMolType = toCodec(molType.item, molTypeMap, result, refs);
        codec = mol.vector(itemMolType);
      }
      break;
    }
    case "option": {
      if (molType.item === byte) {
        codec = mol.ByteOpt;
      } else {
        const itemMolType = toCodec(molType.item, molTypeMap, result, refs);
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
              molTypeMap,
              result,
              refs,
            );
            unionCodecs.push([unionTypeItem, index, itemMolType]);
          } else if (Array.isArray(unionTypeItem)) {
            const [key, fieldId] = unionTypeItem;

            const itemMolType = toCodec(key, molTypeMap, result, refs);
            unionCodecs.push([key, fieldId, itemMolType]);
          }
        }
      });

      const unionFieldsCodecs: Record<
        string,
        mol.Codec<any, any>
      > = unionCodecs.reduce(
        (codecMap, [fieldName, _fieldId, fieldCodec]) =>
          Object.assign(codecMap, { [fieldName]: fieldCodec }),
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
          const itemMolType = toCodec(field.type, molTypeMap, result, refs);
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
          const itemMolType = toCodec(field.type, molTypeMap, result, refs);
          structCodecs[field.name] = itemMolType;
        }
      });
      codec = mol.struct(structCodecs);
      break;
    }
  }
  nonNull(codec);
  if (!result[key]) {
    result[key] = codec;
  } else {
    console.error(`Existing codec: ${key} has been added to result.`);
  }
  return codec;
};

/**
 * create Codecs from tokens
 * @param molTypeMap
 * @returns
 */
export function createCodecMap(
  molTypeInfo: MolTypeMap | MolType[],
  refs?: CodecMap,
): CodecMap {
  const molTypeMap = ((data) => {
    if (Array.isArray(data)) {
      return toMolTypeMap(data);
    }
    return data;
  })(molTypeInfo);
  const result: CodecMap = {};
  for (const key in molTypeMap) {
    result[key] = toCodec(key, molTypeMap, result, refs);
  }
  return result;
};


