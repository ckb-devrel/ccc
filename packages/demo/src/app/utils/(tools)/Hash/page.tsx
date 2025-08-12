"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";

export default function Hash() {
  const { createSender } = useApp();
  const { log } = createSender("Hash");

  const [messageToHash, setMessageToHash] = useState<string>("");

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Message"
        placeholder="Message to hash"
        state={[messageToHash, setMessageToHash]}
      />
      <ButtonsPanel>
        <Button
          onClick={async () => {
            log("Hash:", ccc.hashCkb(ccc.bytesFrom(messageToHash, "utf8")));
          }}
        >
          Hash as UTF-8
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            log("Hash:", ccc.hashCkb(messageToHash));
          }}
        >
          Hash as hex
        </Button>
      </ButtonsPanel>
    </div>
  );
}
