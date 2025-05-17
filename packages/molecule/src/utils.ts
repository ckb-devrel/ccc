import { mol } from "@ckb-ccc/core";
import {
  byte,
  Field,
  MolDefinitions,
  MolType,
  ParseOptions,
  Struct,
  Vector,
} from "./type.js";

export function nonNull<T>(data: T): asserts data is NonNullable<T> {
  if (data === null || data === undefined) throw new Error("NonNullable");
}

export function toMolDefinitions(molTypes: MolType[]): MolDefinitions {
  const map: MolDefinitions = {};
  molTypes.forEach((molType) => {
    map[molType.name] = molType;
  });
  return map;
}

export function validateParsedResults(
  molTypes: MolType[],
  option: ParseOptions,
) {
  checkDuplicateNames(molTypes);
  // skip check if extraReferences presents
  if (!option.skipDependenciesCheck && !option.extraReferences) {
    checkDependencies(molTypes);
  }
}

function checkDuplicateNames(molTypes: MolType[]) {
  const names = new Set<string>();
  molTypes.forEach((molType) => {
    const currentName = molType.name;
    if (names.has(currentName)) {
      throw new Error(`Duplicate name: ${currentName}`);
    }
    names.add(currentName);
    const currentType = molType.type;
    // check duplicate field names in `struct` and `table`
    if (currentType !== "struct" && currentType !== "table") {
      return;
    }
    const fieldNames = new Set<string>();
    (molType as Struct).fields.forEach((field: Field) => {
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

export function checkDependencies(molTypes: MolType[]): void {
  const map = toMolDefinitions(molTypes);
  for (const key in map) {
    const molItem = map[key];
    nonNull(molItem);
    const type = molItem.type;
    switch (type) {
      case "array":
      case "struct": {
        assertFixedMolType(molItem.name, map);
        break;
      }
      case "vector":
      case "option": {
        if ((molItem as Vector).item !== byte) {
          nonNull(map[(molItem as Vector).item]);
        }
        break;
      }
      case "union": {
        const unionDeps = molItem.items;
        unionDeps.forEach((dep) => {
          if (typeof dep === "string" && dep !== byte) {
            nonNull(map[dep]);
          }
          if (Array.isArray(dep)) {
            const [key, id] = dep;
            // check if the id is a valid uint32
            mol.Uint32.encode(id);
            nonNull(map[key]);
          }
        });
        break;
      }
      case "table": {
        const tableDeps = molItem.fields.map((field: Field) => field.type);
        tableDeps.forEach((dep: string) => {
          if (dep !== byte) {
            nonNull(map[dep]);
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
 * mol type `array` and `struct` should have fixed byte length
 */
function assertFixedMolType(
  name: string,
  outputDefinitions: MolDefinitions,
): void {
  const molItem = outputDefinitions[name];
  nonNull(molItem);
  const type = molItem.type;
  switch (type) {
    case "array": {
      if (molItem.item !== byte) {
        assertFixedMolType(molItem.item, outputDefinitions);
      }
      break;
    }
    case "struct": {
      const fields = molItem.fields;
      fields.forEach((field: Field) => {
        if (field.type !== byte) {
          assertFixedMolType(field.type, outputDefinitions);
        }
      });
      break;
    }
    default:
      throw new Error(`Type ${name} should be fixed length.`);
  }
}
