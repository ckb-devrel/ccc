import { ccc } from "@ckb-ccc/connector-react";

/**
 * built-in re-writable codecs
 */
export const builtinCodecs: ccc.molecule.CodecMap = {
  Uint8: ccc.mol.Uint8,
  Uint16: ccc.mol.Uint16,
  Uint32: ccc.mol.Uint32,
  Uint64: ccc.mol.Uint64,
  Uint128: ccc.mol.Uint128,
  Uint256: ccc.mol.Uint256,
  Uint512: ccc.mol.Uint512,
  Bytes: ccc.mol.Bytes,
  Byte32: ccc.mol.Byte32,
  BytesVec: ccc.mol.BytesVec,
  Byte32Vec: ccc.mol.Byte32Vec,
  BytesOpt: ccc.mol.BytesOpt,

  HashType: ccc.mol.Byte,
  DepType: ccc.mol.Byte,
};

/**
 * merge user tokens with primitive tokens
 * @param userTokens
 */
export const mergeBuiltinCodecs = (
  userCodecs: ccc.molecule.CodecMap,
): ccc.molecule.CodecMap => {
  return { ...userCodecs, ...builtinCodecs };
};

/**
 * primitive schemas
 */
export const blockchainSchema: string = `
option ScriptOpt (Script);

array ProposalShortId [byte; 10];

vector UncleBlockVec <UncleBlock>;
vector TransactionVec <Transaction>;
vector ProposalShortIdVec <ProposalShortId>;
vector CellDepVec <CellDep>;
vector CellInputVec <CellInput>;
vector CellOutputVec <CellOutput>;

table Script {
    code_hash:      Byte32,
    hash_type:      HashType,
    args:           Bytes,
}

struct OutPoint {
    tx_hash:        Byte32,
    index:          Uint32,
}

struct CellInput {
    since:           Uint64,
    previous_output: OutPoint,
}

table CellOutput {
    capacity:       Uint64,
    lock:           Script,
    type_:          ScriptOpt,
}

struct CellDep {
    out_point:      OutPoint,
    dep_type:       DepType,
}

table RawTransaction {
    version:        Uint32,
    cell_deps:      CellDepVec,
    header_deps:    Byte32Vec,
    inputs:         CellInputVec,
    outputs:        CellOutputVec,
    outputs_data:   BytesVec,
}

table Transaction {
    raw:            RawTransaction,
    witnesses:      BytesVec,
}

struct RawHeader {
    version:                Uint32,
    compact_target:         Uint32,
    timestamp:              Uint64,
    number:                 Uint64,
    epoch:                  Uint64,
    parent_hash:            Byte32,
    transactions_root:      Byte32,
    proposals_hash:         Byte32,
    extra_hash:             Byte32,
    dao:                    Byte32,
}

struct Header {
    raw:                    RawHeader,
    nonce:                  Uint128,
}

table UncleBlock {
    header:                 Header,
    proposals:              ProposalShortIdVec,
}

table Block {
    header:                 Header,
    uncles:                 UncleBlockVec,
    transactions:           TransactionVec,
    proposals:              ProposalShortIdVec,
}

table BlockV1 {
    header:                 Header,
    uncles:                 UncleBlockVec,
    transactions:           TransactionVec,
    proposals:              ProposalShortIdVec,
    extension:              Bytes,
}

table CellbaseWitness {
    lock:    Script,
    message: Bytes,
}

table WitnessArgs {
    lock:                   BytesOpt,          // Lock args
    input_type:             BytesOpt,          // Type args for input
    output_type:            BytesOpt,          // Type args for output
}
`;
