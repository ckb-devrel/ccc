import {
  Address,
  OutPointLike,
  ScriptLike,
  TransactionLike,
} from "@ckb-ccc/core";
import { SSRICallParams, SSRIContract, SSRIServer } from "../ssri";
import { UDTExtended } from "../udtExtended";
import { UDTMetadata } from "../udtMetadata";
import { UDTPausable } from "../udtPausable";
import { getBalanceOf } from "./udt.advanced";

/**
 * Represents a UDT (User Defined Token) contract compliant to SSRI protocol. Use composition style to allow customized combinations of UDT features including UDTExtended, UDTMetadata, UDTPausable.
 * @public
 * @extends {SSRIContract}
 */
export class UDT extends SSRIContract {
  extended?: UDTExtended;
  metadata?: UDTMetadata;
  pausable?: UDTPausable;

  /**
   * Creates an instance of UDT.
   * @param {SSRIServer} server - The SSRI server instance.
   * @param {OutPointLike} codeOutPoint - The code out point.
   * @param {boolean} [extended=false] - Whether to include extended functionality.
   * @param {boolean} [metadata=false] - Whether to include metadata functionality.
   * @param {boolean} [pausable=false] - Whether to include pausable functionality.
   */
  constructor(
    server: SSRIServer,
    codeOutPoint: OutPointLike,
    extended: boolean = false,
    metadata: boolean = false,
    pausable: boolean = false,
  ) {
    super(server, codeOutPoint);
    if (extended) {
      this.extended = new UDTExtended(this);
    }
    if (metadata) {
      this.metadata = new UDTMetadata(this);
    }
    if (pausable) {
      this.pausable = new UDTPausable(this);
    }
  }

  /**
   * @tag Cell
   * Retrieves the balance of the UDT of a specific cell. Use the elevated method `balanceOf` for address balance.
   * @param {SSRICallParams} [params] - The parameters for the call.
   * @returns {Promise<number>} The balance of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  async balance(params?: SSRICallParams): Promise<number> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   * Transfers the UDT to specified addresses.
   * @param {TransactionLike} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ScriptLike[]} toLockArray - The array of lock scripts for the recipients.
   * @param {bigint[]} amountArray - The array of amounts to be transferred.
   * @param {SSRICallParams} [params] - The parameters for the call.
   * @returns {Promise<{ tx: TransactionLike }>} The transaction result.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  async transfer(
    tx: TransactionLike | null,
    toLockArray: ScriptLike[],
    amountArray: bigint[],
    params?: SSRICallParams,
  ): Promise<{
    tx: TransactionLike;
  }> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Retrieves the balance of the specified address across the chain.
   * @param {Address} address - The address to retrieve the balance for.
   * @returns {Promise<bigint>} The balance of the specified address.
   * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call.
   */
  async balanceOf(address: Address): Promise<bigint> {
    return await getBalanceOf(address);
  }
}
