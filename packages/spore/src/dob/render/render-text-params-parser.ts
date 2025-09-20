import { backgroundColorParser } from "./background-color-parser";
import { Key } from "./constants/key";
import { GLOBAL_TEMPLATE_REG, TEMPLATE_REG } from "./constants/regex";
import { ParsedStyleFormat, styleParser } from "./style-parser";
import type { ParsedTrait } from "./traits-parser";

export const DEFAULT_TEMPLATE = `%k: %v`;

export function renderTextParamsParser(
  traits: ParsedTrait[],
  indexVarRegister: Record<string, number>,
  options?: {
    defaultTemplate?: string;
  },
) {
  const bgColor = backgroundColorParser(traits, { defaultColor: "#000" });
  let template = options?.defaultTemplate ?? DEFAULT_TEMPLATE;
  let style = styleParser("");

  const globalTemplateTrait = traits.find((trait) =>
    GLOBAL_TEMPLATE_REG.test(trait.name),
  );
  if (globalTemplateTrait) {
    if (typeof globalTemplateTrait.value === "string") {
      let { value } = globalTemplateTrait;
      if (!value.startsWith("<") && !value.endsWith(">")) {
        value = `<${value}>`;
      }
      style = styleParser(value);
    }
    const matchTemplate = globalTemplateTrait.name.match(TEMPLATE_REG)?.[2];
    if (matchTemplate) {
      template = matchTemplate;
    }
  }

  const items = traits
    .filter(
      (trait) =>
        !trait.name.startsWith(Key.Prev) &&
        typeof trait.value !== "undefined" &&
        !(trait.name in indexVarRegister) &&
        trait.name !== Key.Image,
    )
    .map((trait) => {
      let currentTemplate = template;
      let parsedStyle = style;
      let { name, value } = trait;
      if (typeof value === "string") {
        const currentLayoutMatch = value.match(TEMPLATE_REG);
        if (currentLayoutMatch) {
          if (currentLayoutMatch[1]) {
            [, value] = currentLayoutMatch;
          }
          if (currentLayoutMatch[2]) {
            parsedStyle = styleParser(`<${currentLayoutMatch[2]}>`, {
              baseStyle: JSON.parse(JSON.stringify(parsedStyle)),
            });
          }
        }
      }

      const currentTemplateMatch = name.match(TEMPLATE_REG);
      if (currentTemplateMatch && currentTemplateMatch[2]) {
        if (currentTemplateMatch[1]) {
          name = currentTemplateMatch[1];
        }
        if (currentTemplateMatch[2]) {
          currentTemplate = currentTemplateMatch[2];
        }
      }

      const text = currentTemplate
        .replace(/%k/g, name)
        .replace(/%v/g, `${value}`)
        .replace(/%%/g, "%");

      const styleCss: {
        textAlign?: string;
        color?: string;
        fontWeight?: string;
        fontStyle?: string;
        textDecoration?: string;
      } = {};
      if (parsedStyle.alignment) {
        styleCss.textAlign = parsedStyle.alignment;
      }
      if (parsedStyle.color) {
        styleCss.color = parsedStyle.color;
      }
      if (parsedStyle.format) {
        if (parsedStyle.format.includes(ParsedStyleFormat.Bold)) {
          styleCss.fontWeight = "700";
        }
        if (parsedStyle.format.includes(ParsedStyleFormat.Italic)) {
          styleCss.fontStyle = "italic";
        }
        if (parsedStyle.format.includes(ParsedStyleFormat.Underline)) {
          styleCss.textDecoration = "underline";
        }
        if (parsedStyle.format.includes(ParsedStyleFormat.Strikethrough)) {
          styleCss.textDecoration = "line-through";
        }
      }

      return {
        name,
        value,
        parsedStyle,
        template: currentTemplate,
        text,
        style: styleCss,
      };
    });

  return {
    items,
    bgColor,
  };
}
