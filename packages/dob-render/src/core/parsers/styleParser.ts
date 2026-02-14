import { STYLE_FORMATS, TEXT_ALIGNMENT } from "../../types/constants.js";
import type { StyleConfiguration, StyleFormat } from "../../types/core.js";
import { StyleParseError } from "../../types/errors.js";
import { validateString } from "../../utils/validation.js";

/**
 * Default style configuration
 */
const DEFAULT_STYLE: StyleConfiguration = {
  color: "#fff",
  format: [],
  alignment: "left",
  breakLine: 1,
} as const;

/**
 * Style parser with proper validation and error handling
 */
export class StyleParser {
  private readonly colorRegex6 = /#([0-9a-fA-F]{6})/;
  private readonly colorRegex3 = /#([0-9a-fA-F]{3})/;
  private readonly formatRegex = /\*([bisu]+)/;
  private readonly alignmentRegex = /@(l|c|r)/;
  private readonly traitsRegex = /&/;
  private readonly breakLineRegex = /~/g;

  /**
   * Parses a style string into a StyleConfiguration
   */
  parse(
    styleString: string,
    baseStyle?: StyleConfiguration,
  ): StyleConfiguration {
    try {
      const input = validateString(styleString, "style string");
      const result = baseStyle ? { ...baseStyle } : { ...DEFAULT_STYLE };

      // Remove angle brackets if present
      let cleanInput = this.removeAngleBrackets(input);

      // Parse color
      cleanInput = this.parseColor(cleanInput, result);

      // Parse format
      cleanInput = this.parseFormat(cleanInput, result);

      // Parse alignment
      cleanInput = this.parseAlignment(cleanInput, result);

      // Parse break line
      this.parseBreakLine(cleanInput, result);

      return result;
    } catch (error) {
      throw new StyleParseError(`Failed to parse style: ${styleString}`, {
        styleString,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Removes angle brackets from style string
   */
  private removeAngleBrackets(input: string): string {
    if (input.startsWith("<") && input.endsWith(">")) {
      return input.slice(1, -1);
    }
    return input;
  }

  /**
   * Parses color from style string
   */
  private parseColor(input: string, result: StyleConfiguration): string {
    let remaining = input;

    // Try 6-digit hex color first
    const colorMatch6 = this.colorRegex6.exec(remaining);
    if (colorMatch6) {
      result.color = `#${colorMatch6[1]}`;
      remaining = remaining.replace(this.colorRegex6, "");
      return remaining;
    }

    // Try 3-digit hex color
    const colorMatch3 = this.colorRegex3.exec(remaining);
    if (colorMatch3) {
      result.color = `#${colorMatch3[1]}`;
      remaining = remaining.replace(this.colorRegex3, "");
      return remaining;
    }

    return remaining;
  }

  /**
   * Parses format from style string
   */
  private parseFormat(input: string, result: StyleConfiguration): string {
    const formatMatch = this.formatRegex.exec(input);
    if (!formatMatch) {
      return input;
    }

    const formatString = formatMatch[1];
    const formats: StyleFormat[] = [];

    for (const char of formatString) {
      switch (char) {
        case "b":
          formats.push(STYLE_FORMATS.BOLD);
          break;
        case "i":
          formats.push(STYLE_FORMATS.ITALIC);
          break;
        case "s":
          formats.push(STYLE_FORMATS.STRIKETHROUGH);
          break;
        case "u":
          formats.push(STYLE_FORMATS.UNDERLINE);
          break;
        default:
          throw new StyleParseError(`Unknown format character: ${char}`, {
            formatString,
            character: char,
          });
      }
    }

    result.format = formats;
    return input.replace(this.formatRegex, "");
  }

  /**
   * Parses alignment from style string
   */
  private parseAlignment(input: string, result: StyleConfiguration): string {
    const alignmentMatch = this.alignmentRegex.exec(input);
    if (!alignmentMatch) {
      return input;
    }

    const alignmentChar = alignmentMatch[1];
    switch (alignmentChar) {
      case "l":
        result.alignment = TEXT_ALIGNMENT.LEFT;
        break;
      case "c":
        result.alignment = TEXT_ALIGNMENT.CENTER;
        break;
      case "r":
        result.alignment = TEXT_ALIGNMENT.RIGHT;
        break;
      default:
        throw new StyleParseError(
          `Unknown alignment character: ${alignmentChar}`,
          {
            alignmentChar,
          },
        );
    }

    return input.replace(this.alignmentRegex, "");
  }

  /**
   * Parses break line from style string
   */
  private parseBreakLine(input: string, result: StyleConfiguration): void {
    // Check for traits marker (no line break)
    if (this.traitsRegex.test(input)) {
      result.breakLine = 0;
      return;
    }

    // Count break line markers
    const breakLineMatches = input.match(this.breakLineRegex);
    if (breakLineMatches) {
      result.breakLine = breakLineMatches.length + 1;
    }
  }
}

/**
 * Creates a new style parser instance
 */
export function createStyleParser(): StyleParser {
  return new StyleParser();
}

/**
 * Parses a style string (backward compatibility)
 */
export function styleParser(
  styleString: string,
  options?: { baseStyle: StyleConfiguration },
): StyleConfiguration {
  const parser = createStyleParser();
  return parser.parse(styleString, options?.baseStyle);
}
