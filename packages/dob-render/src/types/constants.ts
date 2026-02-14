/**
 * Constants and configuration values
 */

export const RENDER_CONSTANTS = {
  CANVAS_WIDTH: 500,
  CANVAS_HEIGHT: 500,
  DEFAULT_FONT_SIZE: 36,
  DEFAULT_LINE_HEIGHT: "150%",
  DEFAULT_PADDING: "20px",
  DEFAULT_BACKGROUND: "#000",
  DEFAULT_TEXT_COLOR: "#fff",
  MIN_HEIGHT: 500,
} as const;

export const FONT_WEIGHTS = {
  NORMAL: 400,
  BOLD: 700,
} as const;

export const FONT_STYLES = {
  NORMAL: "normal",
  ITALIC: "italic",
} as const;

export const ALIGNMENT_MAP = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
} as const;

export const STYLE_FORMATS = {
  BOLD: "bold",
  ITALIC: "italic",
  STRIKETHROUGH: "strikethrough",
  UNDERLINE: "underline",
} as const;

export const TEXT_ALIGNMENT = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
} as const;
