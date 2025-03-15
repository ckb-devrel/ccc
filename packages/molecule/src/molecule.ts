import { createCodecMap } from "./codec";
import grammar from "./grammar/grammar";
import { CodecMap } from "./type";

import { ParseOptions } from "./type";
import { validateParsedResults } from "./utils";

export function getCodecMapFromMol(
  molString: string,
  option: ParseOptions = {
    refs: {},
    skipDependenciesCheck: false,
  },
): CodecMap {
  const { declares: results } = grammar.parse(molString);
  validateParsedResults(results, option);
  return createCodecMap(results, option.refs);
}
