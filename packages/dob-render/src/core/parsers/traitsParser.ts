import { ARRAY_INDEX_REG, ARRAY_REG } from "../../config/constants.js";
import type { ParsedTrait } from "../../types/core.js";
import type { RenderOutput } from "../../types/external.js";
import type { QueryOptions } from "../../types/query.js";
import { parseStringToArray } from "../../utils/string.js";
import { resolveSvgTraits } from "../../utils/svg.js";

// ParsedTrait is now defined in types/core.ts

export function traitsParser(
  items: RenderOutput,
  options?: QueryOptions,
): {
  traits: ParsedTrait[];
  indexVarRegister: Record<string, number>;
} {
  const indexVarRegister = items.reduce<Record<string, number>>((acc, item) => {
    if (!item.traits[0]?.value) return acc;
    const match = String(item.traits[0].value).match(ARRAY_INDEX_REG);
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

      const traitData = trait[0];

      if ("String" in traitData && typeof traitData.String === "string") {
        let stringValue = traitData.String;
        const matchArray = stringValue.match(ARRAY_REG);
        if (matchArray) {
          const varName = matchArray[1];
          const array = parseStringToArray(matchArray[2]);
          const index = indexVarRegister[varName] % array.length;
          stringValue = array[index];
        }
        return {
          value: stringValue,
          name: item.name,
        } as ParsedTrait;
      }

      if ("Number" in traitData && typeof traitData.Number === "number") {
        return {
          name: item.name,
          value: traitData.Number,
        } as ParsedTrait;
      }

      if ("Timestamp" in traitData && typeof traitData.Timestamp === "number") {
        let timestamp = traitData.Timestamp;
        if (`${timestamp}`.length === 10) {
          timestamp = timestamp * 1000;
        }
        return {
          name: item.name,
          value: new Date(timestamp),
        } as ParsedTrait;
      }

      if ("SVG" in traitData && typeof traitData.SVG === "string") {
        return {
          name: item.name,
          value: resolveSvgTraits(traitData.SVG, options),
        };
      }

      return null;
    })
    .filter((e): e is ParsedTrait => e !== null);
  return {
    traits,
    indexVarRegister,
  };
}
