import { Hex } from "@ckb-ccc/core";
import { FiberNode } from "./node";

export const amountPerPoint = 1 * 10 ** 8; // 1 CKB per point

const node1 = {
  peerId: "QmdW4WGRUfqQ8hx92Uaufx4n3TXrJUoDP666BQwbqiDrnv",
  address:
    "/ip4/127.0.0.1/tcp/8228/p2p/QmdW4WGRUfqQ8hx92Uaufx4n3TXrJUoDP666BQwbqiDrnv",
  url: "/node1-api",
};

const node2 = {
  peerId: "QmcFpUnjRvMyqbFBTn94wwF8LZodvPWpK39Wg9pYr2i4TQ",
  address:
    "/ip4/127.0.0.1/tcp/8238/p2p/QmcFpUnjRvMyqbFBTn94wwF8LZodvPWpK39Wg9pYr2i4TQ",
  url: "/node2-api",
};

export async function prepareNodes() {
  const bossNode = new FiberNode(node1.url, node1.peerId, node1.address);
  const playerNode = new FiberNode(node2.url, node2.peerId, node2.address);
  console.log("bossNode", bossNode);
  console.log("playerNode", playerNode);

  await bossNode.rpc.connectPeer({
    address: playerNode.address,
  });

  const myChannels = await bossNode.rpc.listChannels({
    peer_id: playerNode.peerId,
  });
  const activeChannel = myChannels.channels.filter(
    (channel) => channel.state.state_name === "CHANNEL_READY",
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
  const result = await bossNode.sendPayment(invoice.invoice_address);
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
  const result = await playerNode.sendPayment(invoice.invoice_address);
  console.log(`player pay boss ${points} CKB`);
  console.log("invoice", invoice);
  console.log("payment result", result);
}
