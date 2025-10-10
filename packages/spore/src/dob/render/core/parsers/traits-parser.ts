import type { INode } from "svgson";
import { ARRAY_INDEX_REG, ARRAY_REG } from "../../config/constants";
import { resolveSvgTraits } from "../../services/svg-resolver";
import type { RenderPartialOutput as RenderOutput } from "../../types";
import { parseStringToArray } from "../../utils/string-utils";

export interface ParsedTrait {
  name: string;
  value: number | string | Date | Promise<INode>;
}

export function traitsParser(items: RenderOutput[]): {
  traits: ParsedTrait[];
  indexVarRegister: Record<string, number>;
} {
  const indexVarRegister = items.reduce<Record<string, number>>((acc, item) => {
    if (!item.traits[0]?.String) return acc;
    const match = item.traits[0].String.match(ARRAY_INDEX_REG);
    if (!match) return acc;
    const intIndex = parseInt(match[1], 10);
    if (isNaN(intIndex)) return acc;
    acc[item.name] = intIndex;
    return acc;
  }, {});
  const traits = items
    .map<ParsedTrait | null>((item) => {
      const { traits: trait } = item;
      if (!trait[0]) return null;
      if ("String" in trait[0] && typeof trait[0].String === "string") {
        let value = item.traits[0].String;
        const matchArray = value!.match(ARRAY_REG);
        if (matchArray) {
          const varName = matchArray[1];
          const array = parseStringToArray(matchArray[2]);
          const index = indexVarRegister[varName] % array.length;
          value = array[index];
        }
        return {
          value,
          name: item.name,
        } as ParsedTrait;
      }
      if ("Number" in trait[0] && typeof trait[0].Number === "number") {
        return {
          name: item.name,
          value: trait[0].Number,
        } as ParsedTrait;
      }
      if ("Timestamp" in trait[0] && typeof trait[0].Timestamp === "number") {
        let timestamp = trait[0].Timestamp as number;
        if (`${timestamp}`.length === 10) {
          timestamp = timestamp * 1000;
        }
        return {
          name: item.name,
          value: new Date(timestamp),
        } as ParsedTrait;
      }
      if ("SVG" in trait[0] && typeof trait[0].SVG === "string") {
        return {
          name: item.name,
          value: resolveSvgTraits(trait[0].SVG),
        };
      }
      return null;
    })
    .map((e) => e!)
    .filter((e) => e);
  return {
    traits,
    indexVarRegister,
  };
}
