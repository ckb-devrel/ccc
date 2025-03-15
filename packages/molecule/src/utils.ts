import { mol } from "@ckb-ccc/core";
import {
  byte,
  Field,
  MolType,
  MolTypeMap,
  ParseOptions,
  Struct,
  Vector,
} from "./type";

export function nonNull<T>(data: T): asserts data is NonNullable<T> {
  if (data === null || data === undefined) throw new Error("NonNullable");
}

export function toMolTypeMap(results: MolType[]): MolTypeMap {
  const map: MolTypeMap = {};
  results.forEach((result) => {
    map[result.name] = result;
  });
  return map;
}

export function validateParsedResults(results: MolType[], option: ParseOptions) {
  checkDuplicateNames(results);
  // skip check is refs presents
  if (!option.skipDependenciesCheck && !option.refs) {
    checkDependencies(results);
  }
}

function checkDuplicateNames(results: MolType[]) {
  const names = new Set<string>();
  results.forEach((result) => {
    const currentName = result.name;
    if (names.has(currentName)) {
      throw new Error(`Duplicate name: ${currentName}`);
    }
    names.add(currentName);
    const currentType = result.type;
    // check duplicate field names in `struct` and `table`
    if (currentType === "struct" || currentType === "table") {
      const fieldNames = new Set<string>();
      (result as Struct).fields.forEach((field: Field) => {
        const currentFieldName = field.name;
        if (fieldNames.has(currentFieldName)) {
          throw new Error(`Duplicate field name: ${currentFieldName}`);
        }
        fieldNames.add(currentFieldName);
      });
    }
  });
}

export function checkDependencies(results: MolType[]): void {
  const map = toMolTypeMap(results);
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
function assertFixedMolType(name: string, map: MolTypeMap): void {
  const molItem = map[name];
  nonNull(molItem);
  const type = molItem.type;
  switch (type) {
    case "array": {
      if (molItem.item !== byte) {
        assertFixedMolType(molItem.name, map);
      }
      break;
    }
    case "struct": {
      const fields = molItem.fields;
      fields.forEach((field: Field) => {
        if (field.type !== byte) {
          assertFixedMolType(field.type, map);
        }
      });
      break;
    }
    default:
      throw new Error(`Type ${name} should be fixed length.`);
  }
}

type ID = string | number;

interface Node {
  id: ID;
  dependencies: ID[];
}

/**
 * topological sort with circular check
 * @param graph
 */
export function topologySort<T extends Node>(graph: T[]): T[];
/**
 * topological sort with circular check and custom node transformation
 * @param graph
 * @param cb
 */
export function topologySort<T>(graph: T[], cb: (element: T) => Node): T[];
// topological sort with circular check
export function topologySort<T>(graph: T[], cb?: (element: T) => Node): T[] {
  const sorted: T[] = [];
  const visited: Set<ID> = new Set();
  const visiting: Set<ID> = new Set();

  const toNode = (cb ? cb : id) as (value: T) => Node;

  function visit(node: T, path: ID[]) {
    const { id, dependencies } = toNode(node);

    if (visiting.has(id)) {
      const cycle = path.slice(path.indexOf(id)).concat(id).join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    if (!visited.has(id)) {
      visiting.add(id);
      path.push(id);

      for (const depId of dependencies) {
        const dependency = graph.find((n) => toNode(n).id === depId);

        if (dependency) {
          visit(dependency, [...path]);
        } else {
          throw new Error(`Dependency not found: ${depId}`);
        }
      }

      visited.add(id);
      visiting.delete(id);
      sorted.push(node);
    }
  }

  for (const node of graph) {
    visit(node, []);
  }

  return sorted;
}

function id<T>(value: T): T {
  return value;
}

type CircularIterator<T> = {
  current(): T | undefined;
  // move to the next point and return it
  next(): T | undefined;
  // delete the current element, move and return the next element
  removeAndNext(): T | undefined;
  hasNext(): boolean;
};

export function circularIterator<T extends object>(
  elems: T[],
): CircularIterator<T> {
  const items = [...elems];
  let current = items[0];

  return {
    current: () => current,
    next: () => {
      const index = items.indexOf(current);
      current = items[(index + 1) % items.length];
      return current;
    },
    removeAndNext() {
      const index = items.indexOf(current);
      items.splice(index, 1);
      current = items[index % items.length];
      return current;
    },
    hasNext: () => items.length > 0,
  };
}

