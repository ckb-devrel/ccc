"use client";

import { Button } from "@/src/components/Button";
import { useEffect, useState, useCallback } from "react";
import { TextInput } from "@/src/components/Input";
import { useRouter } from "next/navigation";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { FiberSDK } from "@ckb-ccc/fiber";
import { useFiber } from "./context/FiberContext";
import { BigButton } from "@/src/components/BigButton";
import { shannonToCKB } from "./utils/numbers"

export default function Page() {
  const router = useRouter();
  const { fiber, setFiber } = useFiber();
  const [endpoint, setEndpoint] = useState("");
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const initSdk = () => {
    const newFiber = new FiberSDK({
      endpoint: endpoint || `/api/fiber`,
      timeout: 5000,
    });
    if (newFiber) {
      console.log("Fiber SDK initialized");
      setFiber(newFiber);
    } else {
      console.log("Fiber SDK initialization failed");
    }
  };

  const getNodeInfo = useCallback(async () => {
    if (!fiber) return;
    try {
      const info = await fiber.nodeInfo();
      console.log(info);
      setNodeInfo(info);
    } catch (error) {
      console.error("Failed to get node info:", error);
    }
  }, [fiber]);

  useEffect(() => {
    if (fiber) {
      getNodeInfo();
    }
  }, [fiber, getNodeInfo]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fiber </h1>
      </div>
      {fiber ? (
        <div className="flex gap-2">
          <BigButton
            key={"/fiber/channel"}
            size="sm"
            iconName={"ArrowLeftRight"}
            onClick={() => router.push("/fiber/channel")}
            className={"text-yellow-500"}
          >
            channel
          </BigButton>
          <BigButton
            key={"/fiber/Peer"}
            size="sm"
            iconName={"ArrowLeftRight"}
            onClick={() => router.push("/fiber/peer")}
            className={"text-yellow-500"}
          >
            Peer
          </BigButton>
          <BigButton
            key={"/fiber/payment"}
            size="sm"
            iconName={"ArrowLeftRight"}
            onClick={() => router.push("/fiber/payment")}
            className={"text-yellow-500"}
          >
            Payment
          </BigButton>
          <BigButton
            key={"/fiber/invoice"}
            size="sm"
            iconName={"ArrowLeftRight"}
            onClick={() => router.push("/fiber/invoice")}
            className={"text-yellow-500"}
          >
            Invoice
          </BigButton>
        </div>
      ) : (
        <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
          <div className="flex w-full flex-col items-center items-stretch gap-2">
            <TextInput
              label="Endpoint"
              state={[endpoint, setEndpoint]}
              placeholder="http://localhost:8119"
            />
          </div>
        </div>
      )}

      {nodeInfo && (
        <div className="mt-4 w-full rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-lg font-bold">Node Information</h2>
          <div className="space-y-4">
            {/* 基本信息 */}
            <div>
              <div className="grid grid-cols-1">
                <p>
                  <span className="font-semibold">Node Name:</span>{" "}
                  {nodeInfo.node_name || "Not set"}
                </p>
                <p>
                  <span className="font-semibold">Node ID:</span>{" "}
                  {nodeInfo.node_id}
                </p>
                <p>
                  <span className="font-semibold">Chain Hash:</span>{" "}
                  {nodeInfo.chain_hash}
                </p>
                <p>
                  <span className="font-semibold">Timestamp:</span>{" "}
                  {new Date(Number(nodeInfo.timestamp)).toLocaleString()}
                </p>
              </div>
            </div>

            {/* 网络统计 */}
            <div>
              <h3 className="mb-2 font-semibold">Network Statistics</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <p>
                  <span className="font-semibold">Channel Count:</span>{" "}
                  {nodeInfo.channel_count || "0"}
                </p>
                <p>
                  <span className="font-semibold">Pending Channels:</span>{" "}
                  {nodeInfo.pending_channel_count || "0"}
                </p>
                <p>
                  <span className="font-semibold">Connected Peers:</span>{" "}
                  {nodeInfo.peers_count || "0"}
                </p>
              </div>
            </div>

            {/* 通道配置 */}
            <div>
              <h3 className="mb-2 font-semibold">Channel Configuration</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <p>
                  <span className="font-semibold">Min CKB Funding Amount:</span>{" "}
                  {shannonToCKB(nodeInfo.auto_accept_min_ckb_funding_amount) || "0"}
                </p>
                <p>
                  <span className="font-semibold">
                    Channel CKB Funding Amount:
                  </span>{" "}
                  {shannonToCKB(nodeInfo.auto_accept_channel_ckb_funding_amount) || "0"}
                </p>
                <p>
                  <span className="font-semibold">TLC Expiry Delta:</span>{" "}
                  {shannonToCKB(nodeInfo.tlc_expiry_delta) || "0"}
                </p>
                <p>
                  <span className="font-semibold">TLC Min Value:</span>{" "}
                  {shannonToCKB(nodeInfo.tlc_min_value) || "0"}
                </p>
                <p>
                  <span className="font-semibold">
                    TLC Fee Proportional Millionths:
                  </span>{" "}
                  {nodeInfo.tlc_fee_proportional_millionths
                    ? `${shannonToCKB(nodeInfo.tlc_fee_proportional_millionths)}`
                    : "0%"}
                </p>
              </div>
            </div>

            {/* 节点地址 */}
            <div>
              <h3 className="mb-2 font-semibold">Node Addresses</h3>
              <div className="space-y-1">
                {nodeInfo.addresses && nodeInfo.addresses.length > 0 ? (
                  nodeInfo.addresses.map((address: string, index: number) => (
                    <p key={index} className="break-all">
                      {address}
                    </p>
                  ))
                ) : (
                  <p className="text-gray-500">No addresses configured</p>
                )}
              </div>
            </div>

            {/* 默认资金锁定脚本 */}
            {nodeInfo.default_funding_lock_script && (
              <div>
                <h3 className="mb-2 font-semibold">Default Funding Lock Script</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Code Hash:</span>{" "}
                    {nodeInfo.default_funding_lock_script.code_hash}
                  </p>
                  <p>
                    <span className="font-semibold">Hash Type:</span>{" "}
                    {nodeInfo.default_funding_lock_script.hash_type}
                  </p>
                  <p>
                    <span className="font-semibold">Args:</span>{" "}
                    {nodeInfo.default_funding_lock_script.args}
                  </p>
                </div>
              </div>
            )}

            {/* UDT配置 */}
            {nodeInfo.udt_cfg_infos && Object.keys(nodeInfo.udt_cfg_infos).length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">UDT Configuration</h3>
                <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2">
                  {JSON.stringify(nodeInfo.udt_cfg_infos, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      <ButtonsPanel>
        <Button onClick={() => router.push("/")}>Back</Button>
        <Button onClick={initSdk}>Init Fiber SDK</Button>
      </ButtonsPanel>
    </div>
  );
}
