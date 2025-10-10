/**
 * Core type definitions for the render system
 */

export type TraitValue =
  | string
  | number
  | Date
  | Promise<import("svgson").INode>;

export interface Trait {
  readonly name: string;
  readonly value: TraitValue;
}

export interface ParsedTrait extends Trait {
  readonly value: TraitValue;
}

export interface IndexVariableRegister {
  readonly [variableName: string]: number;
}

export interface TraitParseResult {
  readonly traits: readonly ParsedTrait[];
  readonly indexVarRegister: IndexVariableRegister;
}

export interface StyleConfiguration {
  color: string;
  format: StyleFormat[];
  alignment: TextAlignment;
  breakLine: number;
}

export type StyleFormat = "bold" | "italic" | "strikethrough" | "underline";
export type TextAlignment = "left" | "center" | "right";

export interface TextStyle {
  textAlign?: string;
  color?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
}

export interface TextItem {
  name: string;
  value: TraitValue;
  parsedStyle: StyleConfiguration;
  template: string;
  text: string;
  style: TextStyle;
}

export interface TextRenderOptions {
  readonly items: readonly TextItem[];
  readonly bgColor: string;
}

export interface FontConfiguration {
  readonly regular: ArrayBuffer;
  readonly italic: ArrayBuffer;
  readonly bold: ArrayBuffer;
  readonly boldItalic: ArrayBuffer;
}

export interface RenderConfiguration {
  readonly font?: FontConfiguration;
  readonly outputType?: "svg";
}

export interface ImageRenderOptions {
  readonly traits: readonly ParsedTrait[];
}

export interface BitRenderOptions {
  readonly dobData: string | import("./api").DobDecodeResult;
  readonly outputType?: "svg";
}
