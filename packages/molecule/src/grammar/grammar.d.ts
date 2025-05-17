import { MolTypeDefinition } from "../type";

type ParseResult = {
  declares: MolTypeDefinition[];
  imports: string[];
  syntaxVersion: string | null;
};

type Grammar = {
  parse(schema: string): ParseResult;
};

declare const grammar: Grammar;

export default grammar;
