import { createCodecDefinitions } from "./codec.js";
import grammar from "./grammar/grammar.js";
import { CodecDefinitions, ParseOptions } from "./type.js";
import { validateParsedResults } from "./utils.js";

/**
 * Parses a molecule schema source string and returns codec definitions for all declared types.
 * @param molSrc - The molecule schema source as a string.
 * @param option - (Optional) Parse options, including extraReferences and skipDependenciesCheck.
 * @returns Codec definitions mapping type names to their corresponding codecs.
 */
export function parseMolecule(
  molSrc: string,
  option: ParseOptions = {
    extraReferences: {},
    skipDependenciesCheck: false,
  },
): CodecDefinitions {
  const { declares: results } = grammar.parse(molSrc);
  validateParsedResults(results, option);
  return createCodecDefinitions(results, option.extraReferences);
}
