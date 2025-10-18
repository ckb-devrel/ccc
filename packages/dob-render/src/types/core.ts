/**
 * Core type definitions for the render system
 */

import { INode } from "svgson";

export interface RenderElement<
  P = Record<string, unknown>,
  S = Record<string, unknown>,
  T = string,
> {
  type: T;
  props: P & {
    children:
      | RenderElement
      | RenderElement[]
      | string
      | (RenderElement | string)[];
    style: S;
  };
  key: string | null;
}

export type TraitValue = string | number | Date | Promise<INode>;

export interface ParsedTrait {
  readonly name: string;
  readonly value: TraitValue;
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
