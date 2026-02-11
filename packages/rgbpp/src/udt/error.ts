export class RgbppError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RgbppError";
  }
}

export class RgbppValidationError extends RgbppError {
  constructor(message: string) {
    super("RGBPP_VALIDATION_ERROR", message);
    this.name = "RgbppValidationError";
  }
}

export class RgbppCommitmentMismatchError extends RgbppError {
  constructor() {
    super("RGBPP_COMMITMENT_MISMATCH", "Commitment mismatch");
    this.name = "RgbppCommitmentMismatchError";
  }
}

export class RgbppInvalidLockError extends RgbppValidationError {
  constructor(expected: string[], actual: string) {
    super(
      `Invalid output lock, expected one of ${expected.join("/")}, but got ${actual}`,
    );
    this.name = "RgbppInvalidLockError";
  }
}
