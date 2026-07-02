import { ccc, mol } from "@ckb-ccc/core";

/**
 * Representation of an Action's properties.
 */
export type ActionLike = {
  /**
   * The hash of the ScriptInfo associated with the action.
   */
  scriptInfoHash: ccc.BytesLike;
  /**
   * The hash of the script executing the action.
   */
  scriptHash: ccc.BytesLike;
  /**
   * The custom action payload data.
   */
  data: ccc.BytesLike;
};

/**
 * Represents a single Action inside the CoBuild protocol.
 */
@mol.codec(
  mol.table({
    scriptInfoHash: mol.Byte32,
    scriptHash: mol.Byte32,
    data: mol.Bytes,
  }),
)
export class Action extends ccc.Entity.Base<ActionLike, Action>() {
  /**
   * Constructs an Action instance.
   * @param scriptInfoHash The hex-encoded hash of the ScriptInfo.
   * @param scriptHash The hex-encoded script hash.
   * @param data The hex-encoded action payload data.
   */
  constructor(
    public scriptInfoHash: ccc.Hex,
    public scriptHash: ccc.Hex,
    public data: ccc.Hex,
  ) {
    super();
  }

  /**
   * Creates an Action instance from an ActionLike object.
   * @param actionLike The source ActionLike object or Action instance.
   * @returns A new or existing Action instance.
   */
  static from(actionLike: ActionLike): Action {
    if (actionLike instanceof Action) {
      return actionLike;
    }

    return new Action(
      ccc.hexFrom(actionLike.scriptInfoHash),
      ccc.hexFrom(actionLike.scriptHash),
      ccc.hexFrom(actionLike.data),
    );
  }
}

/**
 * Molecule vector of Action codecs.
 */
export const ActionVec = mol.vector(Action);

/**
 * Representation of a Message's properties.
 */
export type MessageLike = {
  // I'll never know why we pack the actions into a message
  actions: ActionLike[];
};

/**
 * Represents a Message containing a list of actions.
 */
@mol.codec(
  mol.table({
    actions: ActionVec,
  }),
)
export class Message extends ccc.Entity.Base<MessageLike, Message>() {
  /**
   * Constructs a Message instance.
   * @param actions The list of Action instances.
   */
  constructor(public actions: Action[]) {
    super();
  }

  /**
   * Creates a Message instance from a MessageLike object.
   * @param messageLike The source MessageLike object or Message instance.
   * @returns A new or existing Message instance.
   */
  static from(messageLike: MessageLike): Message {
    if (messageLike instanceof Message) {
      return messageLike;
    }

    return new Message(
      messageLike.actions.map((action) => Action.from(action)),
    );
  }
}

/**
 * Representation of a ScriptInfo's properties.
 */
export type ScriptInfoLike = {
  /**
   * The developer/dapp name.
   */
  name?: string | null;
  /**
   * The url associated with the script or dapp.
   */
  url?: string | null;
  /**
   * The script hash.
   */
  scriptHash: ccc.BytesLike;
  /**
   * The action schema description.
   */
  schema?: string | null;
  /**
   * The entry action type name used in the WitnessLayout.
   */
  messageType?: string | null;
};

/**
 * Represents script metadata information (ScriptInfo).
 */
@mol.codec(
  mol.table({
    name: mol.String,
    url: mol.String,
    scriptHash: mol.Byte32,
    schema: mol.String,
    messageType: mol.String,
  }),
)
export class ScriptInfo extends ccc.Entity.Base<ScriptInfoLike, ScriptInfo>() {
  /**
   * Constructs a ScriptInfo instance.
   * @param name The developer/dapp name.
   * @param url The url associated with the script or dapp.
   * @param scriptHash The hex-encoded script hash.
   * @param schema The action schema.
   * @param messageType The message type.
   */
  constructor(
    public name: string,
    public url: string,
    public scriptHash: ccc.Hex,
    public schema: string,
    public messageType: string,
  ) {
    super();
  }

  /**
   * Creates a ScriptInfo instance from a ScriptInfoLike object.
   * @param scriptInfoLike The source ScriptInfoLike object or ScriptInfo instance.
   * @returns A new or existing ScriptInfo instance.
   */
  static from(scriptInfoLike: ScriptInfoLike): ScriptInfo {
    if (scriptInfoLike instanceof ScriptInfo) {
      return scriptInfoLike;
    }

    return new ScriptInfo(
      scriptInfoLike.name ?? "",
      scriptInfoLike.url ?? "",
      ccc.hexFrom(scriptInfoLike.scriptHash),
      scriptInfoLike.schema ?? "",
      scriptInfoLike.messageType ?? "",
    );
  }
}

/**
 * Molecule vector of ScriptInfo codecs.
 */
export const ScriptInfoVec = mol.vector(ScriptInfo);
