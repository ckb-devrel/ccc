import {
  GLOBAL_TEMPLATE_REG,
  Key,
  TEMPLATE_REG,
} from "../../config/constants.js";
import { STYLE_FORMATS } from "../../types/constants.js";
import type {
  ParsedTrait,
  StyleConfiguration,
  StyleFormat,
  TextItem,
  TextRenderOptions,
  TextStyle,
  TraitValue,
} from "../../types/core.js";
import { backgroundColorParser } from "./backgroundColorParser.js";
import { createStyleParser } from "./styleParser.js";

/**
 * Default template for text rendering
 */
export const DEFAULT_TEMPLATE = "%k: %v";

/**
 * Text parameters parser with improved error handling and type safety
 */
export class TextParamsParser {
  private readonly styleParser = createStyleParser();

  /**
   * Parses text parameters from traits
   */
  parse(
    traits: ParsedTrait[],
    indexVarRegister: Record<string, number>,
    options?: { defaultTemplate?: string },
  ): TextRenderOptions {
    try {
      const bgColor = backgroundColorParser(traits, { defaultColor: "#000" });
      const template = options?.defaultTemplate ?? DEFAULT_TEMPLATE;

      const { globalStyle, globalTemplate } =
        this.extractGlobalConfiguration(traits);
      const finalTemplate = globalTemplate || template;

      const items = this.parseTextItems(
        traits,
        indexVarRegister,
        finalTemplate,
        globalStyle,
      );

      return {
        items,
        bgColor,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse text parameters: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extracts global configuration from traits
   */
  private extractGlobalConfiguration(traits: ParsedTrait[]): {
    globalStyle: StyleConfiguration;
    globalTemplate: string | null;
  } {
    const globalTemplateTrait = traits.find((trait) =>
      GLOBAL_TEMPLATE_REG.test(trait.name),
    );

    if (!globalTemplateTrait) {
      return {
        globalStyle: this.styleParser.parse(""),
        globalTemplate: null,
      };
    }

    let globalStyle = this.styleParser.parse("");
    let globalTemplate: string | null = null;

    if (typeof globalTemplateTrait.value === "string") {
      const styleString = this.normalizeStyleString(globalTemplateTrait.value);
      globalStyle = this.styleParser.parse(styleString);
    }

    const templateMatch = globalTemplateTrait.name.match(TEMPLATE_REG);
    if (templateMatch?.[2]) {
      globalTemplate = templateMatch[2];
    }

    return { globalStyle, globalTemplate };
  }

  /**
   * Normalizes style string by adding angle brackets if needed
   */
  private normalizeStyleString(value: string): string {
    if (!value.startsWith("<") && !value.endsWith(">")) {
      return `<${value}>`;
    }
    return value;
  }

  /**
   * Parses individual text items from traits
   */
  private parseTextItems(
    traits: ParsedTrait[],
    indexVarRegister: Record<string, number>,
    template: string,
    baseStyle: StyleConfiguration,
  ): TextItem[] {
    const filteredTraits = this.filterRelevantTraits(traits, indexVarRegister);

    return filteredTraits.map((trait) =>
      this.parseTextItem(trait, template, baseStyle),
    );
  }

  /**
   * Filters traits that are relevant for text rendering
   */
  private filterRelevantTraits(
    traits: ParsedTrait[],
    indexVarRegister: Record<string, number>,
  ): ParsedTrait[] {
    return traits.filter(
      (trait) =>
        !trait.name.startsWith(Key.Prev) &&
        typeof trait.value !== "undefined" &&
        !(trait.name in indexVarRegister) &&
        trait.name !== String(Key.Image),
    );
  }

  /**
   * Parses a single text item from a trait
   */
  private parseTextItem(
    trait: ParsedTrait,
    template: string,
    baseStyle: StyleConfiguration,
  ): TextItem {
    const { name, value } = trait;

    const { processedValue, itemStyle } = this.processTraitValue(
      value,
      baseStyle,
    );
    const { processedName, itemTemplate } = this.processTraitName(
      name,
      template,
    );

    const text = this.generateText(itemTemplate, processedName, processedValue);
    const style = this.generateStyle(itemStyle);

    return {
      name: processedName,
      value: processedValue,
      parsedStyle: itemStyle,
      template: itemTemplate,
      text,
      style,
    };
  }

  /**
   * Processes trait value and extracts style information
   */
  private processTraitValue(
    value: TraitValue,
    baseStyle: StyleConfiguration,
  ): { processedValue: TraitValue; itemStyle: StyleConfiguration } {
    let processedValue = value;
    let itemStyle = { ...baseStyle };

    if (typeof value === "string") {
      const layoutMatch = value.match(TEMPLATE_REG);
      if (layoutMatch) {
        if (layoutMatch[1]) {
          processedValue = layoutMatch[1];
        }
        if (layoutMatch[2]) {
          const styleString = `<${layoutMatch[2]}>`;
          itemStyle = this.styleParser.parse(styleString, itemStyle);
        }
      }
    }

    return { processedValue, itemStyle };
  }

  /**
   * Processes trait name and extracts template information
   */
  private processTraitName(
    name: string,
    template: string,
  ): { processedName: string; itemTemplate: string } {
    const templateMatch = name.match(TEMPLATE_REG);

    if (!templateMatch?.[2]) {
      return { processedName: name, itemTemplate: template };
    }

    let processedName = name;
    let itemTemplate = template;

    if (templateMatch[1]) {
      processedName = templateMatch[1];
    }
    if (templateMatch[2]) {
      itemTemplate = templateMatch[2];
    }

    return { processedName, itemTemplate };
  }

  /**
   * Generates text from template and values
   */
  private generateText(template: string, name: string, value: unknown): string {
    const valueString = this.serializeValue(value);

    return template
      .replace("%k", name)
      .replace("%v", valueString)
      .replace("%%", "%");
  }

  /**
   * Serializes a value to string safely
   */
  private serializeValue(value: unknown): string {
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Generates CSS style object from parsed style
   */
  private generateStyle(parsedStyle: StyleConfiguration): TextStyle {
    const style: TextStyle = {};

    if (parsedStyle.alignment) {
      style.textAlign = parsedStyle.alignment;
    }

    if (parsedStyle.color) {
      style.color = parsedStyle.color;
    }

    if (parsedStyle.format.length > 0) {
      this.applyFormatStyles(style, parsedStyle.format);
    }

    return style;
  }

  /**
   * Applies format styles to the style object
   */
  private applyFormatStyles(
    style: TextStyle,
    formats: readonly StyleFormat[],
  ): void {
    for (const format of formats) {
      switch (format) {
        case STYLE_FORMATS.BOLD:
          style.fontWeight = "700";
          break;
        case STYLE_FORMATS.ITALIC:
          style.fontStyle = "italic";
          break;
        case STYLE_FORMATS.UNDERLINE:
          style.textDecoration = "underline";
          break;
        case STYLE_FORMATS.STRIKETHROUGH:
          style.textDecoration = "line-through";
          break;
      }
    }
  }
}

/**
 * Creates a new text parameters parser
 */
export function createTextParamsParser(): TextParamsParser {
  return new TextParamsParser();
}

/**
 * Parses text parameters (backward compatibility)
 */
export function renderTextParamsParser(
  traits: ParsedTrait[],
  indexVarRegister: Record<string, number>,
  options?: { defaultTemplate?: string },
): TextRenderOptions {
  const parser = createTextParamsParser();
  return parser.parse(traits, indexVarRegister, options);
}
