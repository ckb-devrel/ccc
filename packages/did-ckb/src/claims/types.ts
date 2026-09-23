import type { ccc } from "@ckb-ccc/core";

/** Script deployments used to read or create Claim Cells. */
export type ClaimScriptConfigLike = {
  /** Claim Type deployment for the selected CKB network. */
  claimType: ccc.ScriptInfoLike;
  /** DID Lock deployment, required when a subject is supplied as a DID. */
  didLock?: ccc.ScriptInfoLike;
  /** Defaults to the client's KnownScript.DidCkb entry. */
  didCkb?: ccc.ScriptInfoLike;
};

/** A claim subject expressed as either a complete CKB lock or a did:ckb identifier. */
export type ClaimSubjectLike =
  | {
      lock: ccc.ScriptLike;
      did?: never;
    }
  | {
      did: string;
      lock?: never;
    };

/** Input accepted by the V1 Claim Cell Molecule codec. */
export type ClaimDataV1Like<TPayload = unknown> = {
  issuerId: ccc.HexLike;
  nonce: ccc.HexLike;
  /** Issuer-asserted Unix timestamp in seconds. */
  issuedAt: ccc.NumLike;
  /** Optional expiry as a Unix timestamp in seconds. */
  expiresAt?: ccc.NumLike | null;
  payload: TPayload;
};

/** Versioned Claim Cell data accepted by {@link ClaimData.from}. */
export type ClaimDataLike<TPayload = unknown> =
  | {
      type?: "v1" | null;
      value: ClaimDataV1Like<TPayload>;
    }
  | {
      inner: {
        type?: "v1" | null;
        value: ClaimDataV1Like<TPayload>;
      };
    };

/** Result of evaluating issuer-asserted claim timestamps at an explicit checkpoint. */
export type ClaimTimeEvaluation =
  | {
      status: "not-evaluated";
    }
  | {
      status: "not-yet-active" | "active" | "expired";
      /** Application-selected Unix timestamp in seconds. */
      evaluatedAt: ccc.Num;
    };

/** Current on-chain state resolved for a claim's issuing did:ckb identity. */
export type ClaimIssuerState =
  | {
      status: "active";
      cell: ccc.Cell;
      controller: ccc.Script;
    }
  | {
      status: "deactivated" | "missing";
    }
  | {
      status: "ambiguous";
      cells: readonly ccc.Cell[];
    }
  | {
      status: "unavailable";
      reason: string;
    };

/** A decoded live Claim Cell and the verification evidence collected by the reader. */
export type Claim<TPayload = unknown> = {
  version: "v1";
  claimId: ccc.Hex;
  issuerDid: string;
  issuerId: ccc.Hex;
  issuerType: ccc.Script;
  issuerState: ClaimIssuerState;
  subjectLock: ccc.Script;
  subjectLockHash: ccc.Hex;
  schemaHash: ccc.Hex;
  nonce: ccc.Hex;
  /** Issuer-asserted Unix timestamp in seconds. */
  issuedAt: ccc.Num;
  /** Optional expiry as a Unix timestamp in seconds. */
  expiresAt?: ccc.Num;
  payload: TPayload;
  payloadBytes: ccc.Hex;
  cell: ccc.Cell;
  duplicateCells: readonly ccc.Cell[];
  verification: {
    inclusion: "live";
    issuerAuthorization: "accepted-by-configured-claim-type";
    time: ClaimTimeEvaluation;
  };
};

/** Exact subject query and optional filters applied by {@link readClaims}. */
export type ClaimFilter = {
  subject: ClaimSubjectLike;
  issuerDid?: string;
  schemaHash?: ccc.HexLike;
  /** Unix timestamp in seconds. No current-clock default is applied when omitted. */
  evaluationTime?: ccc.NumLike;
  /** CKB indexer chain order; defaults to "asc". */
  order?: "asc" | "desc";
  /** Indexer page size, not a cap on the complete result. */
  pageSize?: number;
};

/** Stable category for a Claim Cell that could not be accepted by the reader. */
export type ClaimReadFailureCode =
  | "unsupported-issuer-deployment"
  | "invalid-type-args"
  | "unsupported-data-version"
  | "invalid-claim-data"
  | "invalid-dag-cbor"
  | "non-canonical-dag-cbor";

/** A malformed or unsupported live Cell isolated from otherwise valid results. */
export type ClaimReadFailure = {
  cell: ccc.Cell;
  code: ClaimReadFailureCode;
  message: string;
};

/** Complete result of a subject scan, including isolated invalid Cells. */
export type ReadClaimsResult = {
  claims: Claim[];
  invalid: ClaimReadFailure[];
};

/** Inputs for {@link readClaims}. */
export type ReadClaimsProps = {
  client: ccc.Client;
  scripts: ClaimScriptConfigLike;
  filter: ClaimFilter;
};

/** Claim content and output policy used by {@link writeClaim}. */
export type WriteClaimInput<TPayload = unknown> = {
  subject: ClaimSubjectLike;
  issuerDid: string;
  schemaHash: ccc.HexLike;
  payload: TPayload;
  /** Issuer-asserted Unix timestamp in seconds. */
  issuedAt: ccc.NumLike;
  /** Optional expiry as a Unix timestamp in seconds. */
  expiresAt?: ccc.NumLike | null;
  /** Generated with a cryptographically secure random source when omitted. */
  nonce?: ccc.HexLike;
  /** Output capacity in shannons; defaults to the exact occupied capacity. */
  capacity?: ccc.NumLike;
};

/** Signers, deployments, and optional base transaction used by {@link writeClaim}. */
export type WriteClaimProps<TPayload = unknown> = {
  issuerSigner: ccc.Signer;
  /** Defaults to issuerSigner. */
  payerSigner?: ccc.Signer;
  /** Signers required by pre-existing input lock groups in tx. */
  additionalSigners?: readonly ccc.Signer[];
  scripts: ClaimScriptConfigLike;
  input: WriteClaimInput<TPayload>;
  tx?: ccc.TransactionLike;
};

/** Signers, deployments, and claim inputs used to build one atomic transaction. */
export type WriteClaimsProps<TPayload = unknown> = Omit<
  WriteClaimProps<TPayload>,
  "input"
> & {
  /** Between one and eight claims for the same subject and issuer. */
  inputs: readonly WriteClaimInput<TPayload>[];
};

/** Location of the issuer DID state selected for Claim Type authorization. */
export type ClaimIssuerSource =
  | {
      kind: "input";
      inputIndex: number;
      outputIndex: number;
    }
  | {
      kind: "cell-dep";
      cellDepIndex: number;
    }
  | {
      kind: "output";
      outputIndex: number;
    };

/** Prepared unsigned transaction and stable metadata returned by {@link writeClaim}. */
export type WriteClaimResult = {
  tx: ccc.Transaction;
  claimId: ccc.Hex;
  outputIndex: number;
  issuerSource: ClaimIssuerSource;
  controllerInputIndex: number;
};

/** Prepared unsigned transaction containing every requested Claim output. */
export type WriteClaimsResult = {
  tx: ccc.Transaction;
  claims: readonly Pick<WriteClaimResult, "claimId" | "outputIndex">[];
  issuerSource: ClaimIssuerSource;
  controllerInputIndex: number;
};

/** Application parser bound to one canonical claim schema hash. */
export type ClaimSchema<TPayload> = {
  id: string;
  hash: ccc.HexLike;
  parse: (payload: unknown) => TPayload;
};
