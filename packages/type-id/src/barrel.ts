import { ccc } from "@ckb-ccc/core";
import { buildTypeIdOperations } from "./advancedBarrel";

export const {
  create: createTypeId,
  transfer: transferTypeId,
  destroy: destroyTypeId,
} = buildTypeIdOperations({
  async getScriptInfo(client: ccc.Client) {
    return client.getKnownScript(ccc.KnownScript.TypeId);
  },
});
