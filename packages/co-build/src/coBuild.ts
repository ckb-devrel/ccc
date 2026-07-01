import { ccc } from "@ckb-ccc/core";
import {
  Action,
  ActionLike,
  ScriptInfo,
  ScriptInfoLike,
  WitnessLayout,
  WitnessLayoutVariant,
} from "./codec/index.js";

/**
 * Parses the CoBuild actions from the last witness of a transaction.
 * @param txLike The transaction containing the witnesses.
 * @param shouldRemoveParsedWitness If true, removes the last witness from the returned transaction.
 * @returns An object containing the parsed actions and the transaction.
 */
export function parseActions(
  txLike: ccc.TransactionLike,
  shouldRemoveParsedWitness: boolean = false,
): {
  actions: Action[];
  tx: ccc.Transaction;
} {
  const tx = ccc.Transaction.from(txLike);

  if (tx.witnesses.length === 0) {
    return { actions: [], tx };
  }

  try {
    return WitnessLayout.decode(tx.witnesses[tx.witnesses.length - 1]).match({
      SighashAll: ({ message: { actions } }) => {
        if (shouldRemoveParsedWitness) {
          tx.witnesses.pop();
        }
        return { actions, tx };
      },
      _: () => {
        // In the original CoBuild design, the SighashAll can be anywhere in the transaction witnesses.
        // I don't think that design will come to reality in a short time, so I will just ignore other possibilities for now.
        return { actions: [], tx };
      },
    });
  } catch {
    return { actions: [], tx };
  }
}

/**
 * Parses existing actions, executes a manipulator function to modify or add actions,
 * and encodes/updates the witness layout at the correct index.
 * @param txLike The target transaction.
 * @param manipulator A function that takes the current actions and returns updated actions.
 * @returns The updated transaction and the index of the modified witness.
 */
export async function manipulateActions(
  txLike: ccc.TransactionLike,
  manipulator: (actions: Action[]) => Action[] | Promise<Action[]>,
): Promise<{
  tx: ccc.Transaction;
  witnessIndex: number;
}> {
  let tx = ccc.Transaction.from(txLike);
  const parsedRes = parseActions(tx, true);
  tx = parsedRes.tx;

  const witnessIndex = Math.max(
    tx.witnesses.length,
    tx.inputs.length,
    tx.outputs.length,
  );

  tx.setWitnessAt(
    witnessIndex,
    WitnessLayout.encode({
      type: WitnessLayoutVariant.SighashAll,
      value: {
        seal: "0x",
        message: {
          actions: await manipulator(parsedRes.actions),
        },
      },
    }),
  );

  return {
    tx,
    witnessIndex,
  };
}

/**
 * Appends actions to the transaction's CoBuild witness.
 * Supports single action, iterables, or async iterables of actions.
 * @param txLike The target transaction.
 * @param actions The action(s) to append. Can be a single ActionLike, or an iterable/async iterable of ActionLike.
 * @returns The updated transaction and the index of the witness.
 */
export async function appendActions(
  txLike: ccc.TransactionLike,
  actions: ActionLike | Iterable<ActionLike> | AsyncIterable<ActionLike>,
): Promise<{
  tx: ccc.Transaction;
  witnessIndex: number;
}> {
  const actionList: ActionLike[] = [];
  if (typeof actions === "object" && actions !== null) {
    if (Symbol.iterator in actions) {
      for (const action of actions) {
        actionList.push(action);
      }
    } else if (Symbol.asyncIterator in actions) {
      for await (const action of actions) {
        actionList.push(action);
      }
    } else {
      actionList.push(actions);
    }
  }

  return manipulateActions(txLike, (existedActions) =>
    existedActions.concat(actionList.map(Action.from)),
  );
}

/**
 * Filters actions in a transaction matching the given CKB Script.
 * @param txLike The transaction containing the witnesses.
 * @param scriptLike The script to match actions against.
 * @returns The list of matching actions.
 */
export function findActions(
  txLike: ccc.TransactionLike,
  scriptLike: ccc.ScriptLike,
): Action[] {
  const scriptHash = ccc.Script.from(scriptLike).hash();
  return findActionsByHash(txLike, scriptHash);
}

/**
 * Filters actions in a transaction matching the given script hash.
 * @param txLike The transaction containing the witnesses.
 * @param scriptHashLike The script hash to match.
 * @returns The list of matching actions.
 */
export function findActionsByHash(
  txLike: ccc.TransactionLike,
  scriptHashLike: ccc.HexLike,
): Action[] {
  const scriptHash = ccc.hexFrom(scriptHashLike);
  const { actions } = parseActions(txLike);
  return actions.filter((action) => action.scriptHash === scriptHash);
}

/**
 * Filters actions in a transaction matching the given ScriptInfo.
 * @param txLike The transaction containing the witnesses.
 * @param scriptInfoLike The ScriptInfo metadata to match.
 * @returns The list of matching actions.
 */
export function findActionsByScriptInfo(
  txLike: ccc.TransactionLike,
  scriptInfoLike: ScriptInfoLike,
): Action[] {
  const scriptInfoHash = ScriptInfo.from(scriptInfoLike).hash();
  return findActionsByScriptInfoHash(txLike, scriptInfoHash);
}

/**
 * Filters actions in a transaction matching the given ScriptInfo hash.
 * @param txLike The transaction containing the witnesses.
 * @param scriptInfoHashLike The ScriptInfo hash to match.
 * @returns The list of matching actions.
 */
export function findActionsByScriptInfoHash(
  txLike: ccc.TransactionLike,
  scriptInfoHashLike: ccc.HexLike,
): Action[] {
  const scriptInfoHash = ccc.hexFrom(scriptInfoHashLike);
  const { actions } = parseActions(txLike);
  return actions.filter((action) => action.scriptInfoHash === scriptInfoHash);
}

/**
 * CoBuild helper class associated with a specific script and script info,
 * delegating actions to top-level helper functions.
 */
export class CoBuild {
  /**
   * The ScriptInfo metadata used for building actions.
   */
  public readonly scriptInfo: ScriptInfo;
  /**
   * The CKB script executing the actions.
   */
  public readonly script: ccc.Script;
  /**
   * Hex-encoded hash of the ScriptInfo.
   */
  public readonly scriptInfoHash: ccc.Hex;
  /**
   * Hex-encoded script hash.
   */
  public readonly scriptHash: ccc.Hex;

  /**
   * Constructs a CoBuild instance.
   * @param script The target CKB Script.
   * @param scriptInfo The ScriptInfo metadata.
   */
  constructor(
    script: ccc.ScriptLike,
    scriptInfo?: Omit<ScriptInfoLike, "scriptHash"> | null,
  ) {
    this.script = ccc.Script.from(script);
    this.scriptHash = this.script.hash();
    this.scriptInfo = ScriptInfo.from({
      ...(scriptInfo ?? {}),
      scriptHash: this.script.hash(),
    });
    this.scriptInfoHash = this.scriptInfo.hash();
  }

  /**
   * Helper to construct an Action with prefilled scriptInfoHash and scriptHash.
   * @param data The custom action payload data (either raw bytes or a serialized ccc Entity).
   * @returns A new Action instance.
   */
  buildAction(data: ccc.BytesLike | ccc.Entity): Action {
    return Action.from({
      scriptInfoHash: this.scriptInfoHash,
      scriptHash: this.scriptHash,
      data: data instanceof ccc.Entity ? data.toBytes() : data,
    });
  }

  /**
   * Parses the CoBuild actions from the last witness of a transaction.
   * @param txLike The transaction containing the witnesses.
   * @param shouldRemoveParsedWitness If true, removes the last witness from the returned transaction.
   * @returns An object containing the parsed actions and the transaction.
   */
  parseActions(
    txLike: ccc.TransactionLike,
    shouldRemoveParsedWitness: boolean = false,
  ): {
    actions: Action[];
    tx: ccc.Transaction;
  } {
    return parseActions(txLike, shouldRemoveParsedWitness);
  }

  /**
   * Parses existing actions, executes a manipulator function to modify or add actions,
   * and encodes/updates the witness layout at the correct index.
   * @param txLike The target transaction.
   * @param manipulator A function that takes the current actions and returns updated actions.
   * @returns The updated transaction and the index of the modified witness.
   */
  manipulateActions(
    txLike: ccc.TransactionLike,
    manipulator: (actions: Action[]) => Action[] | Promise<Action[]>,
  ): Promise<{
    tx: ccc.Transaction;
    witnessIndex: number;
  }> {
    return manipulateActions(txLike, manipulator);
  }

  /**
   * Appends actions to the transaction's CoBuild witness using the script context.
   * Supports single, iterables, or async iterables of actions or entities.
   * @param txLike The target transaction.
   * @param actions The action(s) to append.
   * @returns The updated transaction and the index of the witness.
   */
  async appendActions(
    txLike: ccc.TransactionLike,
    actions:
      | ActionLike
      | ccc.Entity
      | Iterable<ActionLike | ccc.Entity>
      | AsyncIterable<ActionLike | ccc.Entity>,
  ): Promise<{
    tx: ccc.Transaction;
    witnessIndex: number;
  }> {
    const actionList: (ActionLike | ccc.Entity)[] = [];
    if (typeof actions === "object" && actions !== null) {
      if (Symbol.iterator in actions) {
        for (const action of actions) {
          actionList.push(action);
        }
      } else if (Symbol.asyncIterator in actions) {
        for await (const action of actions) {
          actionList.push(action);
        }
      } else {
        actionList.push(actions);
      }
    }

    return this.manipulateActions(txLike, (existedActions) =>
      existedActions.concat(
        actionList.map((action) => {
          if (typeof action === "object" && action !== null) {
            if (
              "scriptInfoHash" in action &&
              "scriptHash" in action &&
              "data" in action
            ) {
              return Action.from(action);
            }
          }
          return this.buildAction(action);
        }),
      ),
    );
  }

  /**
   * Filters actions in a transaction matching the given CKB Script.
   * If omitted or null, defaults to the helper's script.
   * @param txLike The transaction containing the witnesses.
   * @param scriptLike The script to match actions against.
   * @returns The list of matching actions.
   */
  findActions(
    txLike: ccc.TransactionLike,
    scriptLike?: ccc.ScriptLike | null,
  ): Action[] {
    return findActionsByHash(
      txLike,
      scriptLike ? ccc.Script.from(scriptLike).hash() : this.scriptHash,
    );
  }

  /**
   * Filters actions in a transaction matching the given script hash.
   * If omitted or null, defaults to the helper's script hash.
   * @param txLike The transaction containing the witnesses.
   * @param scriptHashLike The script hash to match.
   * @returns The list of matching actions.
   */
  findActionsByHash(
    txLike: ccc.TransactionLike,
    scriptHashLike?: ccc.HexLike | null,
  ): Action[] {
    return findActionsByHash(txLike, scriptHashLike ?? this.scriptHash);
  }

  /**
   * Filters actions in a transaction matching the given ScriptInfo.
   * If omitted or null, defaults to the helper's script info.
   * @param txLike The transaction containing the witnesses.
   * @param scriptInfoLike The ScriptInfo metadata to match.
   * @returns The list of matching actions.
   */
  findActionsByScriptInfo(
    txLike: ccc.TransactionLike,
    scriptInfoLike?: ScriptInfoLike | null,
  ): Action[] {
    return findActionsByScriptInfoHash(
      txLike,
      scriptInfoLike
        ? ScriptInfo.from(scriptInfoLike).hash()
        : this.scriptInfoHash,
    );
  }

  /**
   * Filters actions in a transaction matching the given ScriptInfo hash.
   * If omitted or null, defaults to the helper's script info hash.
   * @param txLike The transaction containing the witnesses.
   * @param scriptInfoHashLike The ScriptInfo hash to match.
   * @returns The list of matching actions.
   */
  findActionsByScriptInfoHash(
    txLike: ccc.TransactionLike,
    scriptInfoHashLike?: ccc.HexLike | null,
  ): Action[] {
    return findActionsByScriptInfoHash(
      txLike,
      scriptInfoHashLike ?? this.scriptInfoHash,
    );
  }
}
