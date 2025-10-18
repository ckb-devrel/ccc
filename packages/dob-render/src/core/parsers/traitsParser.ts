import { dob } from "@ckb-ccc/spore";
import { ARRAY_INDEX_REG, ARRAY_REG } from "../../config/constants.js";
import type { ParsedTrait } from "../../types/core.js";
import type { QueryOptions } from "../../types/query.js";
import { parseStringToArray } from "../../utils/string.js";
import { resolveSvgTraits } from "../../utils/svg.js";

export function traitsParser(
  items: dob.RenderOutput,
  options?: QueryOptions,
): {
  traits: ParsedTrait[];
  indexVarRegister: Record<string, number>;
} {
  const indexVarRegister = items.reduce<Record<string, number>>((acc, item) => {
    if (!("String" in item.traits[0])) return acc;
    if (typeof item.traits[0].String !== "string") return acc;
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
        } as ParsedTrait;
      }

      return null;
    })
    .filter((e): e is ParsedTrait => e !== null);
  return {
    traits,
    indexVarRegister,
  };
}
