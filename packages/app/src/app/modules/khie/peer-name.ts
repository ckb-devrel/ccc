const DISPLAY_CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const BIDI_CONTROL = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export function displayPeerName(value: unknown) {
  if (typeof value !== "string") {
    return "Unknown";
  }

  return (
    value
      .replace(DISPLAY_CONTROL, " ")
      .replace(BIDI_CONTROL, "")
      .replace(/\s+/g, " ")
      .trim() || "Unknown"
  );
}
