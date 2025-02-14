// From https://github.com/Rich-Harris/vlq
const char_to_integer: Record<string, number> = {};
const integer_to_char: Record<string, string> = {};

"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
  .split("")
  .forEach(function (char, i) {
    char_to_integer[char] = i;
    integer_to_char[i] = char;
  });

export function vlqDecode(string: string) {
  const result = [];

  let shift = 0;
  let value = 0;

  for (let i = 0; i < string.length; i += 1) {
    let integer = char_to_integer[string[i]];

    if (integer === undefined) {
      throw new Error("Invalid character (" + string[i] + ")");
    }

    const has_continuation_bit = integer & 32;

    integer &= 31;
    value += integer << shift;

    if (has_continuation_bit) {
      shift += 5;
    } else {
      const should_negate = value & 1;
      value >>>= 1;

      if (should_negate) {
        result.push(value === 0 ? -0x80000000 : -value);
      } else {
        result.push(value);
      }

      // reset
      value = shift = 0;
    }
  }

  return result;
}
