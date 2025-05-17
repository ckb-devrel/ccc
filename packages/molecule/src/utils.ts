import { mol } from "@ckb-ccc/core";
import {
  BYTE,
  CodecRecord,
  Field,
  MolTypeDefinition,
  ParseOptions,
  Struct,
} from "./type.js";

/**
 * Validates parsed Molecule type definitions.
 *
 * This function performs two main validations:
 * 1. Checks for duplicate names across all mol type definitions and their fields
 * 2. Validates the mol type definitions themselves (unless skipped via options)
 *
 * @param molTypes - Array of mol type definitions to validate
 * @param option.skipValidation - Skip validation of the mol type definitions
 * @param option.extraReferences - Extra references to be used for validating the mol type definitions
 * @throws Error if duplicate names are found or if mol type validation fails
 */
export function validateParsedMolTypeDefinitions(
  molTypes: MolTypeDefinition[],
  option?: ParseOptions,
) {
  checkDuplicateNames(molTypes);
  if (!option?.skipValidation) {
    validateMolTypeDefinitions(molTypes, option?.extraReferences);
  }
}

/**
 * Checks for duplicate names in Molecule type definitions and their fields.
 *
 * This function validates that:
 * 1. No duplicate type names exist across all mol type definitions
 * 2. No duplicate field names exist within each struct/table mol type definition
 *
 * @param molTypeDefinitions - Array of mol type definitions to check for duplicate names
 * @throws Error if duplicate names are found, with message indicating the duplicate name
 */
function checkDuplicateNames(molTypeDefinitions: MolTypeDefinition[]) {
  const names = new Set<string>();
  molTypeDefinitions.forEach((molTypeDefinition) => {
    const currentName = molTypeDefinition.name;
    if (names.has(currentName)) {
      throw new Error(`Duplicate name: ${currentName}`);
    }
    names.add(currentName);
    const currentType = molTypeDefinition.type;
    // Only need to check duplicate field names in `struct` and `table`
    if (currentType !== "struct" && currentType !== "table") {
      return;
    }
    const fieldNames = new Set<string>();
    (molTypeDefinition as Struct).fields.forEach((field: Field) => {
      const currentFieldName = field.name;
      if (fieldNames.has(currentFieldName)) {
        throw new Error(
          `Duplicate field name: ${currentName}.${currentFieldName}`,
        );
      }
      fieldNames.add(currentFieldName);
    });
  });
}

/**
 * Validates molecule type definitions by checking dependencies and type constraints.
 *
 * This function performs validation for each molecule type definition:
 * - For array and struct types: Ensures they have fixed byte length
 * - For vector and option types: Validates that their item type exists in either molTypeDefinitions or extraReferences
 * - For union types: Validates that all union items exist and have valid IDs
 * - For table types: Validates that all field types exist in either molTypeDefinitions or extraReferences
 *
 * @param molTypeDefinitions - Array of mol type definitions to validate
 * @param extraReferences - Optional record of external codecs that can be used as dependencies
 * @throws Error if any dependency is not found or if type constraints are violated
 */
export function validateMolTypeDefinitions(
  molTypeDefinitions: MolTypeDefinition[],
  extraReferences?: CodecRecord,
): void {
  for (const molTypeDefinition of molTypeDefinitions) {
    const type = molTypeDefinition.type;
    switch (type) {
      case "array":
      case "struct": {
        assertFixedLengthMolType(
          molTypeDefinition,
          molTypeDefinitions,
          extraReferences,
        );
        break;
      }
      case "vector":
      case "option": {
        const itemType = molTypeDefinition.item;
        if (itemType !== BYTE) {
          if (
            !molTypeDefinitions.find((def) => def.name === itemType) &&
            !(extraReferences && itemType in extraReferences)
          ) {
            throw new Error(
              `Dependency ${itemType} not found for ${molTypeDefinition.type} type ${molTypeDefinition.name}`,
            );
          }
        }
        break;
      }
      case "union": {
        const unionDeps = molTypeDefinition.items;
        unionDeps.forEach((dep) => {
          if (typeof dep === "string" && dep !== BYTE) {
            if (
              !molTypeDefinitions.find(
                (molTypeDefinition) => molTypeDefinition.name === dep,
              ) &&
              !(extraReferences && dep in extraReferences)
            ) {
              throw new Error(
                `Dependency ${dep} not found for union type ${molTypeDefinition.name}`,
              );
            }
          }
          if (Array.isArray(dep)) {
            const [key, id] = dep;
            // check if the id is a valid uint32
            mol.Uint32.encode(id);
            if (
              !molTypeDefinitions.find(
                (molTypeDefinition) => molTypeDefinition.name === key,
              ) &&
              !(extraReferences && key in extraReferences)
            ) {
              throw new Error(
                `Dependency ${key} not found for union type ${molTypeDefinition.name}`,
              );
            }
          }
        });
        break;
      }
      case "table": {
        const tableDeps = molTypeDefinition.fields.map(
          (field: Field) => field.type,
        );
        tableDeps.forEach((dep: string) => {
          if (dep !== BYTE) {
            if (
              !molTypeDefinitions.find(
                (molTypeDefinition) => molTypeDefinition.name === dep,
              ) &&
              !(extraReferences && dep in extraReferences)
            ) {
              throw new Error(
                `Dependency ${dep} not found for table type ${molTypeDefinition.name}`,
              );
            }
          }
        });
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Validates that a molecule type definition has a fixed byte length.
 *
 * In molecule serialization, certain types must have a fixed byte length to ensure
 * deterministic serialization. This function recursively checks that array and struct
 * types, and their dependencies, meet this requirement.
 *
 * For arrays, this means:
 * - If the item type is BYTE, it's fixed length by definition
 * - Otherwise, the item type must be a fixed-length type
 *
 * For structs, this means:
 * - All fields must be fixed-length types
 * - If a field is not BYTE, its type must be a fixed-length type
 *
 * @param molTypeDefinition - The molecule type definition to validate
 * @param molTypeDefinitionsAsReferences - Available type definitions that can be referenced
 * @throws Error if the type is not fixed length or if required dependencies are not found
 */
function assertFixedLengthMolType(
  molTypeDefinition: MolTypeDefinition,
  molTypeDefinitionsAsReferences: MolTypeDefinition[],
  extraReferences?: CodecRecord,
): void {
  switch (molTypeDefinition.type) {
    case "array": {
      if (molTypeDefinition.item !== BYTE) {
        const matchingItemMolTypeDefinition =
          molTypeDefinitionsAsReferences.find(
            (molTypeDefinitionAsReference) =>
              molTypeDefinitionAsReference.name === molTypeDefinition.item,
          );
        if (!matchingItemMolTypeDefinition) {
          const matchingExtraReference =
            extraReferences?.[molTypeDefinition.item];
          if (!matchingExtraReference) {
            throw new Error(
              `Dependency ${molTypeDefinition.item} not found for array type ${molTypeDefinition.name}`,
            );
          } else if (!matchingExtraReference.byteLength) {
            throw new Error(
              `Dependency ${molTypeDefinition.item} is not fixed length for array type ${molTypeDefinition.name}`,
            );
          }
        } else {
          assertFixedLengthMolType(
            matchingItemMolTypeDefinition,
            molTypeDefinitionsAsReferences,
            extraReferences,
          );
        }
      }
      break;
    }
    case "struct": {
      const fields = molTypeDefinition.fields;
      fields.forEach((field: Field) => {
        if (field.type !== BYTE) {
          const matchingFieldMolTypeDefinition =
            molTypeDefinitionsAsReferences.find(
              (molTypeDefinitionAsReference) =>
                molTypeDefinitionAsReference.name === field.type,
            );
          if (!matchingFieldMolTypeDefinition) {
            const matchingExtraReference = extraReferences?.[field.type];
            if (!matchingExtraReference) {
              throw new Error(
                `Dependency ${field.type} not found for struct type ${molTypeDefinition.name}`,
              );
            } else if (!matchingExtraReference.byteLength) {
              throw new Error(
                `Dependency ${field.type} is not fixed length for struct type ${molTypeDefinition.name}`,
              );
            }
          } else {
            assertFixedLengthMolType(
              matchingFieldMolTypeDefinition,
              molTypeDefinitionsAsReferences,
              extraReferences,
            );
          }
        }
      });
      break;
    }
    default:
      throw new Error(`Type ${molTypeDefinition.type} should be fixed length.`);
  }
}
