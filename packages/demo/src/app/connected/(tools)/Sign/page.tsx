"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Textarea } from "@/src/components/Textarea";
import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { CopyIcon } from "lucide-react";
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
        label={
          <>
            Signature
            <button
              className="px-2 py-1"
              onClick={() => {
                window.navigator.clipboard.writeText(signature);
                log("Signature copied");
              }}
            >
              <CopyIcon className="text-gray-600" size="0.8em" />
            </button>
          </>
        }
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
