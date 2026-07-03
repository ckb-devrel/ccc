import { ccc, mol } from "@ckb-ccc/core";

export const ActionCodec = mol.table({
  scriptInfoHash: mol.Byte32,
  scriptHash: mol.Byte32,
  data: mol.Bytes,
});

/**
 * Representation of an Action's properties.
 */
export type ActionLike = ccc.EncodableType<typeof ActionCodec>;

/**
 * Represents a single Action inside the CoBuild protocol.
 */
@ccc.codec(ActionCodec)
export class Action extends ccc.Entity.Base<ActionLike, Action>() {
  public scriptInfoHash: ccc.Hex;
  public scriptHash: ccc.Hex;
  public data: ccc.Hex;

  /**
   * Constructs an Action instance.
   * @param scriptInfoHash The hex-encoded hash of the ScriptInfo.
   * @param scriptHash The hex-encoded script hash.
   * @param data The hex-encoded action payload data.
   */
  constructor({
    scriptInfoHash,
    scriptHash,
    data,
  }: ccc.DecodedType<typeof ActionCodec>) {
    super();

    this.scriptInfoHash = scriptInfoHash;
    this.scriptHash = scriptHash;
    this.data = data;
  }
}

/**
 * Molecule vector of Action codecs.
 */
export const ActionVec = mol.vector(Action);

export const MessageCodec = mol.table({
  actions: ActionVec,
});

/**
 * Representation of a Message's properties.
 */
export type MessageLike = ccc.EncodableType<typeof MessageCodec>;

/**
 * Represents a Message containing a list of actions.
 */
@ccc.codec(MessageCodec)
export class Message extends ccc.Entity.Base<MessageLike, Message>() {
  public actions: Action[];

  /**
   * Constructs a Message instance.
   * @param actions The list of Action instances.
   */
  constructor({ actions }: ccc.DecodedType<typeof MessageCodec>) {
    super();

    this.actions = actions;
  }
}

export const ScriptInfoCodec = mol.table({
  name: mol.String,
  url: mol.String,
  scriptHash: mol.Byte32,
  schema: mol.String,
  messageType: mol.String,
});

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
@ccc.codec(ScriptInfoCodec)
export class ScriptInfo extends ccc.Entity.Base<ScriptInfoLike, ScriptInfo>() {
  public name: string;
  public url: string;
  public scriptHash: ccc.Hex;
  public schema: string;
  public messageType: string;

  /**
   * Constructs a ScriptInfo instance.
   * @param name The developer/dapp name.
   * @param url The url associated with the script or dapp.
   * @param scriptHash The hex-encoded script hash.
   * @param schema The action schema.
   * @param messageType The message type.
   */
  constructor({
    name,
    url,
    scriptHash,
    schema,
    messageType,
  }: ccc.DecodedType<typeof ScriptInfoCodec>) {
    super();

    this.name = name;
    this.url = url;
    this.scriptHash = scriptHash;
    this.schema = schema;
    this.messageType = messageType;
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

    return super.from({
      name: scriptInfoLike.name ?? "",
      url: scriptInfoLike.url ?? "",
      scriptHash: scriptInfoLike.scriptHash,
      schema: scriptInfoLike.schema ?? "",
      messageType: scriptInfoLike.messageType ?? "",
    });
  }
}

/**
 * Molecule vector of ScriptInfo codecs.
 */
export const ScriptInfoVec = mol.vector(ScriptInfo);
