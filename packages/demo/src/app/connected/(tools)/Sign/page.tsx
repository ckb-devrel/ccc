"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Textarea } from "@/src/components/Textarea";
import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";

export default function Sign() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Sign");

  const [messageToSign, setMessageToSign] = useState<string>("");
  const [signature, setSignature] = useState<string>("");

  return (
    <div className="flex w-full flex-col items-stretch">
      <Textarea
        label="Message"
        placeholder="Message to sign and verify"
        state={[messageToSign, setMessageToSign]}
      />
      <Textarea
        label="Signature"
        placeholder="Signature to verify"
        state={[signature, setSignature]}
      />
      <ButtonsPanel>
        <Button
          onClick={async () => {
            if (!signer) {
              return;
            }
            const sig = JSON.stringify(await signer.signMessage(messageToSign));
            setSignature(sig);
            window.navigator.clipboard.writeText(sig);
            log("Signature copied");
          }}
        >
          Sign
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            try {
              if (
                await ccc.Signer.verifyMessage(
                  messageToSign,
                  JSON.parse(signature),
                )
              ) {
                log("Valid");
                return;
              }
            } catch (_e) {}
            error("Invalid");
          }}
        >
          Verify
        </Button>
      </ButtonsPanel>
    </div>
  );
}
