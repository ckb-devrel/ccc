import { toCodecRecord } from "./codec.js";
import grammar from "./grammar/grammar.js";
import { CodecRecord, ParseOptions } from "./type.js";
import { validateParsedMolTypeDefinitions } from "./utils.js";

/**
 * Parses a Molecule schema source string and returns codec definitions for all declared types.
 *
 * This function takes a Molecule schema source string, parses it using the grammar parser,
 * validates the parsed definitions (unless skipped), and converts them into CodecRecord that
 * can be used for serialization/deserialization.
 *
 * @param molSchemaSrc - The Molecule schema source as a string
 * @param option - Optional parse options:
 *   - extraReferences: Pre-defined Codecs that can be referenced
 *   - skipValidation: Whether to skip validation of parsed definitions
 * @returns A CodecRecord mapping type names to their corresponding Codecs
 * @throws Error if schema parsing fails or validation fails (unless skipped)
 */
export function parseMoleculeSchema(
  molSchemaSrc: string,
  option: ParseOptions = {
    extraReferences: {},
    skipValidation: false,
  },
): CodecRecord {
  const { declares: parsedMolTypeDefinitions } = grammar.parse(molSchemaSrc);
  validateParsedMolTypeDefinitions(parsedMolTypeDefinitions, option);
  return toCodecRecord(parsedMolTypeDefinitions, option.extraReferences);
}
