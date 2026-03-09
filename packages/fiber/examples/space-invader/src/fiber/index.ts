import { Hex } from "@ckb-ccc/core";
import { getFiberConfig } from "~/config/fiber.config";
import { FiberNode } from "./node";

export const amountPerPoint = 1 * 10 ** 8; // 1 CKB per point

export async function prepareNodes() {
  const config = await getFiberConfig();
  const { boss: bossPeer, player: playerPeer } = config;
  const bossNode = new FiberNode(
    bossPeer.url,
    bossPeer.peerId,
    bossPeer.address,
  );
  const playerNode = new FiberNode(
    playerPeer.url,
    playerPeer.peerId,
    playerPeer.address,
  );
  console.log("bossNode", bossNode);
  console.log("playerNode", playerNode);

  await bossNode.rpc.connectPeer({
    address: playerNode.address,
  });

  const channels = await bossNode.rpc.listChannels({
    peerId: playerNode.peerId,
  });
  const activeChannel = channels.filter(
    (channel) => channel.state.stateName === "CHANNEL_READY",
  );
  console.log("activeChannel", activeChannel);
  return { bossNode, playerNode };
}

export async function payPlayerPoints(
  bossNode: FiberNode,
  playerNode: FiberNode,
  points: number,
) {
  const amount: Hex = `0x${(amountPerPoint * points).toString(16)}`;

  const invoice = await playerNode.createCKBInvoice(
    amount,
    "player hit the boss!",
  );
  const result = await bossNode.sendPayment(invoice.invoiceAddress);
  console.log(`boss pay player ${points} CKB`);
  console.log("invoice", invoice);
  console.log("payment result", result);
}

export async function payBossPoints(
  bossNode: FiberNode,
  playerNode: FiberNode,
  points: number,
) {
  const amount: Hex = `0x${(amountPerPoint * points).toString(16)}`;
  const invoice = await bossNode.createCKBInvoice(
    amount,
    "boss hit the player!",
  );
  const result = await playerNode.sendPayment(invoice.invoiceAddress);
  console.log(`player pay boss ${points} CKB`);
  console.log("invoice", invoice);
  console.log("payment result", result);
}
