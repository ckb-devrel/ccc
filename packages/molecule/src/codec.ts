/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ccc, mol } from "@ckb-ccc/core";
import { BYTE, CodecRecord, MolTypeDefinition } from "./type.js";

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
 * Creates a Codec for a MolTypeDefinition.
 *
 * This function builds a codec that can encode/decode values according to the molecule specification.
 *
 * @param molTypeDefinition - The molecule type definition to create a codec for
 * @param outputCodecRecord - Preexisting accumulated codec definitions that might be used as dependencies
 * @returns A codec that can encode/decode values of the specified type
 * @throws Error if required dependencies are not found
 */
function toCodec(
  molTypeDefinition: MolTypeDefinition,
  outputCodecRecord: CodecRecord,
): mol.Codec<any, any> {
  if (outputCodecRecord[molTypeDefinition.name]) {
    return outputCodecRecord[molTypeDefinition.name];
  }
  let codec: mol.Codec<any, any> | undefined = undefined;
  switch (molTypeDefinition.type) {
    case "array": {
      const builtInCodec =
        BUILT_IN_ARRAY_CODECS[
          molTypeDefinition.name as keyof typeof BUILT_IN_ARRAY_CODECS
        ];
      // if the molTypeDefinition is a built-in array, use the built-in codec
      if (builtInCodec) {
        return builtInCodec;
      }
      if (molTypeDefinition.item === BYTE) {
        codec = mol.Codec.from({
          byteLength: molTypeDefinition.item_count,
          encode: (value) => ccc.bytesFrom(value),
          decode: (buffer) => ccc.hexFrom(buffer),
        });
      } else {
        const itemCodec = outputCodecRecord[molTypeDefinition.item];
        if (!itemCodec) {
          throw new Error(
            `Codec not found for item type: ${molTypeDefinition.item} in array type: ${molTypeDefinition.name}`,
          );
        }
        codec = mol.array(itemCodec, molTypeDefinition.item_count);
      }
      break;
    }
    case "vector": {
      if (molTypeDefinition.item === BYTE) {
        codec = mol.Bytes;
      } else {
        const itemCodec = outputCodecRecord[molTypeDefinition.item];
        if (!itemCodec) {
          throw new Error(
            `Codec not found for item type: ${molTypeDefinition.item} in vector type: ${molTypeDefinition.name}`,
          );
        }
        codec = mol.vector(itemCodec);
      }
      break;
    }
    case "option": {
      if (molTypeDefinition.item === BYTE) {
        codec = mol.ByteOpt;
      } else {
        const itemCodec = outputCodecRecord[molTypeDefinition.item];
        if (!itemCodec) {
          throw new Error(
            `Codec not found for item type: ${molTypeDefinition.item} in option type: ${molTypeDefinition.name}`,
          );
        }
        codec = mol.option(itemCodec);
      }
      break;
    }
    case "union": {
      const unionCodecs: [string, number, mol.Codec<any, any>][] = [];

      molTypeDefinition.items.forEach((unionTypeItem, index) => {
        if (unionTypeItem === BYTE) {
          unionCodecs.push([unionTypeItem, index, mol.Byte]);
        } else if (typeof unionTypeItem === "string") {
          const itemCodec = outputCodecRecord[unionTypeItem];
          if (!itemCodec) {
            throw new Error(
              `Codec not found for item type: ${unionTypeItem} in union type: ${molTypeDefinition.name}`,
            );
          }
          unionCodecs.push([unionTypeItem, index, itemCodec]);
        } else if (Array.isArray(unionTypeItem)) {
          const [key, fieldId] = unionTypeItem;

          const itemCodec = key == "byte" ? mol.Byte : outputCodecRecord[key];
          if (!itemCodec) {
            throw new Error(
              `Codec not found for item type: ${key} in union type: ${molTypeDefinition.name}`,
            );
          }
          unionCodecs.push([key, fieldId, itemCodec]);
        }
      });

      const unionFieldsCodecs: Record<
        string,
        mol.Codec<any, any>
      > = unionCodecs.reduce(
        (codecRecord, [fieldName, _fieldId, fieldCodec]) =>
          Object.assign(codecRecord, { [fieldName]: fieldCodec }),
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
      const tableFields = molTypeDefinition.fields;
      const tableCodecs: Record<string, mol.Codec<any, any>> = {};
      tableFields.forEach((field) => {
        if (field.type === BYTE) {
          tableCodecs[field.name] = mol.Byte;
        } else {
          const itemCodec = outputCodecRecord[field.type];
          if (!itemCodec) {
            throw new Error(
              `Codec not found for item type: ${field.type} in table type: ${molTypeDefinition.name}`,
            );
          }
          tableCodecs[field.name] = itemCodec;
        }
      });
      codec = mol.table(tableCodecs);
      break;
    }
    case "struct": {
      const structFields = molTypeDefinition.fields;
      const structCodecs: Record<string, mol.Codec<any, any>> = {};
      structFields.forEach((field) => {
        if (field.type === BYTE) {
          structCodecs[field.name] = mol.Byte;
        } else {
          const itemCodec = outputCodecRecord[field.type];
          if (!itemCodec) {
            throw new Error(
              `Codec not found for field type: ${field.type} in struct type: ${molTypeDefinition.name}`,
            );
          }
          structCodecs[field.name] = itemCodec;
        }
      });
      codec = mol.struct(structCodecs);
      break;
    }
  }
  if (!codec) {
    throw new Error(`Codec not found for type: ${molTypeDefinition.name}`);
  }
  return codec;
}

/**
 * Creates a CodecRecord from an array of molecule type definitions.
 *
 * Takes an array of molecule type definitions and converts each one into a codec
 * that can be used for serialization/deserialization, and create a CodecRecord indexed by the type name.
 *
 * It would handle the dependencies of the type definitions, and the dependencies of the dependencies.
 *
 * @param molTypeDefinitions - The molecule type definitions to convert. Should be obtained by grammar.parse(molSchemaSrc).declares.
 * @param extraReferences - Optional pre-defined codecs that can be referenced instead of creating new ones
 * @returns CodecRecord indexed by the type name
 */
export function toCodecRecord(
  molTypeDefinitions: MolTypeDefinition[],
  extraReferences?: CodecRecord,
): CodecRecord {
  const outputCodecRecord: CodecRecord = extraReferences ?? {};
  const processed = new Set<string>();

  function process(definition: MolTypeDefinition) {
    if (processed.has(definition.name)) {
      return;
    }

    // Process dependencies based on type
    if ("item" in definition && definition.item !== BYTE) {
      const dependency = molTypeDefinitions.find(
        (currentMolTypeDefinition) =>
          currentMolTypeDefinition.name === definition.item,
      );
      if (dependency) {
        process(dependency);
      }
    } else if ("fields" in definition) {
      definition.fields.forEach((field) => {
        if (field.type !== BYTE) {
          const dependency = molTypeDefinitions.find(
            (currentMolTypeDefinition) =>
              currentMolTypeDefinition.name === field.type,
          );
          if (dependency) {
            process(dependency);
          }
        }
      });
    } else if (definition.type === "union") {
      definition.items.forEach((item) => {
        const name = typeof item === "string" ? item : item[0];
        if (name !== BYTE) {
          const dependency = molTypeDefinitions.find(
            (currentMolTypeDefinition) =>
              currentMolTypeDefinition.name === name,
          );
          if (dependency) {
            process(dependency);
          }
        }
      });
    }

    outputCodecRecord[definition.name] = toCodec(definition, outputCodecRecord);
    processed.add(definition.name);
  }

  molTypeDefinitions.forEach(process);
  return outputCodecRecord;
}
