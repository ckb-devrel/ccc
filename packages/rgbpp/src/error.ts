// =============================================================================
// Bitcoin errors
// =============================================================================

export class ErrorBtcUnsupportedAddressType extends Error {
  constructor(
    public readonly addressType: string,
    public readonly supported: readonly string[],
  ) {
    super(
      `Unsupported address type: ${addressType}, only ${supported.join(", ")} supported`,
    );
  }
}

export class ErrorBtcInvalidAddress extends Error {
  constructor(public readonly address: string) {
    super(`Unable to decode address: "${address}". Unrecognized format.`);
  }
}

export class ErrorBtcInsufficientFunds extends Error {
  public readonly required: number;
  public readonly available: number;

  constructor(required: number, available: number) {
    super(
      `Insufficient BTC funds: needed ${required} sats, but only ${available} available`,
    );
    this.required = required;
    this.available = available;
  }
}

export class ErrorBtcTransactionNotFound extends Error {
  constructor(public readonly txid: string) {
    super(
      `Transaction ${txid} not found. The referenced UTXO may not exist or the API may be unavailable.`,
    );
  }
}

export class ErrorBtcUtxoNotFound extends Error {
  constructor(
    public readonly txid: string,
    public readonly vout: number,
    public readonly txVoutCount: number,
  ) {
    super(
      `Output index ${vout} not found in transaction ${txid} (tx has ${txVoutCount} outputs).`,
    );
  }
}

export class ErrorBtcOpReturnUtxo extends Error {
  constructor(
    public readonly txid: string,
    public readonly vout: number,
  ) {
    super(
      `Output ${vout} of transaction ${txid} is an OP_RETURN output and cannot be spent. ` +
        `RGB++ lock args should not reference OP_RETURN outputs.`,
    );
  }
}

export class ErrorBtcMissingPublicKey extends Error {
  constructor(public readonly address: string) {
    super(
      `Missing public key for P2TR address ${address}. ` +
        `Provide a PublicKeyProvider or include pubkey in UTXO data.`,
    );
  }
}

// =============================================================================
// RGB++ script errors
// =============================================================================

export class ErrorRgbppInvalidLockArgs extends Error {
  constructor(
    public readonly argsLength: number,
    public readonly minLength: number,
  ) {
    super(
      `Invalid RGB++ lock args: got ${argsLength} bytes, need at least ${minLength}`,
    );
  }
}

export class ErrorRgbppScriptNotFound extends Error {
  constructor(public readonly scriptName: string) {
    super(`Required RGB++ script not found: ${scriptName}`);
  }
}

export class ErrorRgbppInvalidCellLock extends Error {
  constructor(
    public readonly expected: string[],
    public readonly actual: string,
  ) {
    super(
      `Invalid cell lock: expected one of [${expected.join(", ")}], got ${actual}`,
    );
  }
}

// =============================================================================
// RGB++ signer errors
// =============================================================================

export class ErrorRgbppOutputNotFound extends Error {
  constructor() {
    super("No output with RGB++ lock or BTC time lock found in transaction");
  }
}

export class ErrorRgbppInvalidInputLock extends Error {
  constructor(public readonly codeHash: string) {
    super(
      `All inputs must use RGB++ lock, but found input with lock codeHash: ${codeHash}`,
    );
  }
}

export class ErrorRgbppMaxCellExceeded extends Error {
  constructor(
    public readonly count: number,
    public readonly max: number,
  ) {
    super(
      `RGB++ CKB virtual tx exceeds cell limit: ${count} cells, max ${max}`,
    );
  }
}

export class ErrorRgbppNoTypedOutput extends Error {
  constructor() {
    super(
      "RGB++ transaction has no CKB outputs with a type script. At least one typed output is required.",
    );
  }
}

export class ErrorRgbppCellNotFound extends Error {
  constructor(public readonly txHash: string) {
    super(`RGB++ cell not found after issuance in transaction ${txHash}`);
  }
}
