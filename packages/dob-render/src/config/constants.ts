export enum Key {
  Bg = "prev.bg",
  Type = "prev.type",
  BgColor = "prev.bgcolor",
  Prev = "prev",
  Image = "IMAGE",
}

export const ARRAY_REG = /\(%(.*?)\):(\[.*?\])/;
export const ARRAY_INDEX_REG = /(\d+)<_>$/;
export const GLOBAL_TEMPLATE_REG = /^prev<(.*?)>/;
export const TEMPLATE_REG = /^(.*?)<(.*?)>/;
