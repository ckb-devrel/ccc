"use client";

import { Button } from "@/src/components/Button";
import { useEffect, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { ccc } from "@ckb-ccc/connector-react";
import { useRouter } from "next/navigation";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { FiberSDK } from "@ckb-ccc/fiber";

export default function Page() {
  const router = useRouter();
  const { client } = ccc.useCcc();
  const [endpoint, setEndpoint] = useState("");
 
  const initSdk = () => {
    const fiber = new FiberSDK({
      endpoint: endpoint,
      timeout: 5000,
    });
    if (fiber) {
      console.log(fiber);
      console.log("Fiber SDK initialized");
    } else {
      console.log("Fiber SDK initialization failed");
    }
  };
  return (
    <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
      <TextInput
        label="Private Key"
        state={[endpoint, setEndpoint]}
        placeholder="127.0.0.1:8227"
      />
      <ButtonsPanel>
        <Button onClick={() => router.push("/")}>Back</Button>
        <Button
          className="ml-2"
          onClick={() => {
            initSdk()
          }}
        >
          Init SDK
        </Button>
      </ButtonsPanel>
    </div>
  );
}
