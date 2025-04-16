"use client";

import { Button } from "@/src/components/Button";
import { useEffect, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { useRouter } from "next/navigation";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { FiberSDK } from "@ckb-ccc/fiber";
import { useFiber } from "./context/FiberContext";
import { BigButton } from "@/src/components/BigButton";

interface OpenChannelForm {
  peerAddress: string;
  fundingAmount: string;
  feeRate: string;
  tlcExpiryDelta: string;
  tlcMinValue: string;
  tlcFeeProportionalMillionths: string;
  isPublic: boolean;
  isEnabled: boolean;
}

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

  const getNodeInfo = async () => {
    if (!fiber) return;
    try {
      const info = await fiber.nodeInfo();
      console.log(info);
      setNodeInfo(info);
    } catch (error) {
      console.error("Failed to get node info:", error);
    }
  };



  useEffect(() => {
    if (fiber) {
      getNodeInfo();
    }
  }, [fiber]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Fiber </h1>
      </div>
      {fiber ? (
        <div className="flex gap-2">
          <BigButton
            key={'/fiber/channel'}
            size="sm"
            iconName={'ArrowLeftRight'}
            onClick={() => router.push('/fiber/channel')}
            className={'text-yellow-500'}
          >
            channel
          </BigButton>
          <BigButton
            key={'/fiber/Peer'}
            size="sm"
            iconName={'ArrowLeftRight'}
            onClick={() => router.push('/fiber/peer')}
            className={'text-yellow-500'}
          >
            Peer
          </BigButton>
          <BigButton
            key={'/fiber/payment'}
            size="sm"
            iconName={'ArrowLeftRight'}
            onClick={() => router.push('/fiber/payment')}
            className={'text-yellow-500'}
          >
            Payment
          </BigButton>
          <BigButton
            key={'/fiber/invoice'}
            size="sm"
            iconName={'ArrowLeftRight'}
            onClick={() => router.push('/fiber/invoice')}
            className={'text-yellow-500'}
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
          <div className="space-y-2">
            <p>
              <span className="font-semibold">Version:</span> {nodeInfo.version}
            </p>
            <p>
              <span className="font-semibold">Commit Hash:</span>{" "}
              {nodeInfo.commit_hash}
            </p>
            <p>
              <span className="font-semibold">Node ID:</span> {nodeInfo.node_id}
            </p>
            <p>
              <span className="font-semibold">Node Name:</span>{" "}
              {nodeInfo.node_name || "Not set"}
            </p>
            <p>
              <span className="font-semibold">Addresses:</span>{" "}
              {nodeInfo.addresses.length > 0
                ? nodeInfo.addresses.join(", ")
                : "No addresses"}
            </p>
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
