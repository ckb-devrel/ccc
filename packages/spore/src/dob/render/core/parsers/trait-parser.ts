import type { INode } from "svgson";
import type { DecodeElement, RenderOutput } from "../../../helper/object.js";
import { ARRAY_INDEX_REG, ARRAY_REG } from "../../config/constants.js";
import { resolveSvgTraits } from "../../services/svg-resolver.js";
import type {
  IndexVariableRegister,
  ParsedTrait,
  TraitParseResult,
} from "../../types/core";
import { TraitParseError } from "../../types/errors.js";
import { parseStringToArray } from "../../utils/string-utils.js";
import {
  validateArray,
  validateNumber,
  validateString,
} from "../../utils/validation";

/**
 * Parses trait values with proper type safety and error handling
 */
class TraitValueParser {
  /**
   * Parses a string trait value, handling array references
   */
  private parseStringTrait(
    value: string,
    indexVarRegister: IndexVariableRegister,
  ): string {
    const matchArray = value.match(ARRAY_REG);
    if (!matchArray) {
      return value;
    }

    const [, varName, arrayString] = matchArray;
    if (!varName || !arrayString) {
      throw new TraitParseError("Invalid array reference format", { value });
    }

    const array = parseStringToArray(arrayString);
    const index = indexVarRegister[varName] % array.length;
    return array[index] || "";
  }

  /**
   * Parses a number trait value
   */
  private parseNumberTrait(value: number): number {
    return validateNumber(value, "trait value");
  }

  /**
   * Parses a timestamp trait value
   */
  private parseTimestampTrait(value: number): Date {
    const timestamp = validateNumber(value, "timestamp");

    // Convert seconds to milliseconds if needed
    const adjustedTimestamp =
      `${timestamp}`.length === 10 ? timestamp * 1000 : timestamp;

    return new Date(adjustedTimestamp);
  }

  /**
   * Parses an SVG trait value
   */
  private parseSvgTrait(value: string): Promise<INode> {
    const svgString = validateString(value, "SVG content");
    return resolveSvgTraits(svgString);
  }

  /**
   * Parses a single trait based on its type
   */
  parseTrait(
    item: DecodeElement,
    indexVarRegister: IndexVariableRegister,
  ): ParsedTrait | null {
    try {
      const { traits } = item;
      if (!traits[0]) {
        return null;
      }

      const trait = traits[0];
      const name = validateString(item.name, "trait name");

      if ("String" in trait && typeof trait.String === "string") {
        const value = this.parseStringTrait(trait.String, indexVarRegister);
        return { name, value };
      }

      if ("Number" in trait && typeof trait.Number === "number") {
        const value = this.parseNumberTrait(trait.Number);
        return { name, value };
      }

      if ("Timestamp" in trait && typeof trait.Timestamp === "number") {
        const value = this.parseTimestampTrait(trait.Timestamp);
        return { name, value };
      }

      if ("SVG" in trait && typeof trait.SVG === "string") {
        const value = this.parseSvgTrait(trait.SVG);
        return { name, value };
      }

      return null;
    } catch (error) {
      throw new TraitParseError(`Failed to parse trait: ${item.name}`, {
        traitName: item.name,
        traitValue: item.traits[0],
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Builds the index variable register from render output items
 */
function buildIndexVariableRegister(
  items: RenderOutput,
): IndexVariableRegister {
  const register: Record<string, number> = {};

  for (const item of items) {
    const firstTrait = item.traits[0];
    if (!firstTrait?.value) continue;

    const match = String(firstTrait.value).match(ARRAY_INDEX_REG);
    if (!match) continue;

    const indexString = match[1];
    const index = parseInt(indexString, 10);

    if (isNaN(index)) {
      throw new TraitParseError(`Invalid array index: ${indexString}`, {
        itemName: item.name,
        indexString,
      });
    }

    register[item.name] = index;
  }

  return register;
}

/**
 * Parses render output into traits with proper error handling
 */
export function parseTraits(items: RenderOutput): TraitParseResult {
  try {
    validateArray(items, "render output items");

    const indexVarRegister = buildIndexVariableRegister(items);
    const parser = new TraitValueParser();

    const traits = items
      .map((item) => parser.parseTrait(item, indexVarRegister))
      .filter((trait): trait is ParsedTrait => trait !== null);

    return {
      traits,
      indexVarRegister,
    };
  } catch (error) {
    if (error instanceof TraitParseError) {
      throw error;
    }

    throw new TraitParseError("Failed to parse traits", {
      originalError: error instanceof Error ? error.message : String(error),
      itemCount: items.length,
    });
  }
}
