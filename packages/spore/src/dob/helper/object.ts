export type DNA = string | { dna: string } | string[];

export interface Decoder {
  type: "code_hash" | "type_id" | "type_script";
  hash?: string; // required if `type` is `code_hash` or `type_id`
  script?: {
    code_hash: string;
    hash_type: string;
    args: string;
  }; // required if `type` is `type_script`
}

export interface PatternElementDob0 {
  traitName: string;
  dobType: string; // String | Number
  dnaOffset: number;
  dnaLength: number;
  patternType: "options" | "range" | "rawNumber" | "rawString" | "utf8";
  traitArgs?: string[] | number[]; // can only be `undefined` in case that `patternType` is `rawNumber` or `rawString`
  toJSON?: () => unknown;
}

export interface PatternDob0 {
  ver: 0;
  decoder: Decoder;
  pattern: PatternElementDob0[];
}

export interface Dob0 {
  description: string;
  dob: PatternDob0;
}

export type Dob1PatternArgs = string | number[] | ["*"];

export interface PatternElementDob1 {
  imageName: string;
  svgFields: "attributes" | "elements";
  traitName: string; // can only be empty in case that `patternType` is `raw`
  patternType: "options" | "raw";
  traitArgs: Dob1PatternArgs[][] | string; // can only be `string` in case that `patternType` is `raw`
  toJSON?: () => unknown;
}

export interface PatternDob1 {
  ver: 1;
  decoders: {
    decoder: Decoder;
    pattern: PatternElementDob0[] | PatternElementDob1[];
  }[];
}

export interface Dob1 {
  description: string;
  dob: PatternDob1;
}

export type ElementTrait =
  | { String: string }
  | { Number: number }
  | { Timestamp: number }
  | { SVG: string }
  | { [key: string]: string | number };

export interface DecodeElement {
  name: string;
  traits: ElementTrait[];
}

export type RenderOutput = DecodeElement[];
