"use client";

import { useState, useEffect } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { FiberSDK } from "@ckb-ccc/fiber";
import { useRouter } from "next/navigation";

interface PeerInfo {
  pubkey: string;
  peer_id: string;
  addresses: string[];
}

export default function Peer() {
  const [fiber, setFiber] = useState<FiberSDK | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [peerAddress, setPeerAddress] = useState(
    "/ip4/54.215.49.61/tcp/8080/p2p/QmNXkndsz6NT6A4kuXRg4mgk5DpEP33m8vRUqe2iwouEru",
  );
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initFiber = () => {
      const newFiber = new FiberSDK({
        endpoint: `/api/fiber`,
        timeout: 5000,
      });
      setFiber(newFiber);
    };
    initFiber();
  }, []);

  const listPeers = async () => {
    if (!fiber) return;
    setIsLoading(true);
    try {
      const peerList = await fiber.listPeers();
      console.log(peerList);
      //@ts-expect-error
      setPeers(peerList.peers);
    } catch (error) {
      console.error("Failed to list peers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectPeer = async () => {
    if (!fiber || !peerAddress) return;
    setIsLoading(true);
    try {
      await fiber.connectPeer(peerAddress);
      console.log("Peer connected successfully");
      // 连接成功后立即获取并更新 peers 列表
      await listPeers();
    } catch (error) {
      console.error("Failed to connect peer:", error);
      if (error instanceof Error) {
        alert(`连接 peer 失败: ${error.message}`);
      } else {
        alert("连接 peer 失败，请检查网络连接");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectPeer = async (peerId: string) => {
    if (!fiber) return;
    setIsLoading(true);
    try {
      await fiber.disconnectPeer(peerId);
      console.log("Peer disconnected successfully");
      // 断开连接后立即获取并更新 peers 列表
      await listPeers();
    } catch (error) {
      console.error("Failed to disconnect peer:", error);
      if (error instanceof Error) {
        alert(`断开连接失败: ${error.message}`);
      } else {
        alert("断开连接失败，请检查网络连接");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="mb-2 text-xl font-bold">Peer 管理</h2>
        <div className="mb-4 flex gap-2">
          <TextInput
            value={peerAddress}
            onChange={(e) => setPeerAddress(e.target.value)}
            placeholder="输入 peer 地址"
            state={[peerAddress, setPeerAddress]}
            className="flex-1"
          />

          <Button onClick={connectPeer} disabled={isLoading}>
            连接 Peer
          </Button>
          <Button onClick={listPeers} disabled={isLoading}>
            刷新列表
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="mb-2 text-lg font-semibold">已连接的 Peers</h3>
        {peers.length === 0 ? (
          <p className="text-gray-500">暂无连接的 peers</p>
        ) : (
          <div className="space-y-2">
            {peers.length > 0 &&
              peers.map((peer) => (
                <div
                  key={peer.peer_id}
                  className="flex bg-white items-center justify-between rounded-lg border p-3"
                  onClick={() => router.push(`/fiber/peer/${peer.peer_id}`)}
                >
                  <div>
                    <p className="font-medium">Peer ID: {peer.peer_id}</p>
                    <p className="text-sm text-gray-600">
                      Pubkey: {peer.pubkey}
                    </p>
                    <p className="text-sm text-gray-600">
                      Addresses: {peer.addresses.join(", ")}
                    </p>
                  </div>
                  <Button
                    onClick={() => disconnectPeer(peer.peer_id)}
                    disabled={isLoading}
                    variant="danger"
                  >
                    断开连接
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
