"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const router = useRouter();
  const { setPrivateKeySigner } = useApp();
  const { client } = ccc.useCcc();
  const [privateKey, setPrivateKey] = useState("");

  return (
    <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
      <TextInput
        label="Private Key"
        state={[privateKey, setPrivateKey]}
        placeholder="0x0123456789..."
      />
      <ButtonsPanel>
        <Button onClick={() => router.push("/")}>Back</Button>
        <Button
          className="ml-2"
          onClick={() => {
            try {
              setPrivateKeySigner(
                new ccc.SignerCkbPrivateKey(client, privateKey),
              );
              router.push("/connected");
            } catch (_) {
              setPrivateKeySigner(undefined);
              Promise.reject("Invalid private key");
            }
          }}
        >
          Connect
        </Button>
      </ButtonsPanel>
    </div>
  );
}
