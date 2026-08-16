"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";

async function signMessage(signer: ccc.Signer, message: string) {
  return JSON.stringify(await signer.signMessage(message));
}

async function verifyMessage(message: string, signature: string) {
  return ccc.Signer.verifyMessage(message, JSON.parse(signature));
}

export function SignModule({ log, show, signer }: ModuleRuntimeProps) {
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");

  const sign = async () => {
    if (!signer) return;
    try {
      const nextSignature = await signMessage(signer, message);
      setSignature(nextSignature);
      show({
        label: "SIGNATURE",
        tone: "success",
        content: (
          <CopyableReadoutValue
            value={nextSignature}
            onError={(cause) => reportError(cause, show, log)}
          />
        ),
      });
      log("Message signed", "success");
    } catch (cause) {
      reportError(cause, show, log);
    }
  };

  const verify = async () => {
    try {
      const valid = await verifyMessage(message, signature);
      show({
        label: "VERIFICATION",
        tone: valid ? "success" : "error",
        content: (
          <strong>{valid ? "Signature valid" : "Signature invalid"}</strong>
        ),
      });
      log(
        `Signature ${valid ? "valid" : "invalid"}`,
        valid ? "success" : "error",
      );
    } catch (cause) {
      reportError(cause, show, log);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Message</span>
          <ModuleTextarea
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Signature</span>
          <ModuleTextarea
            value={signature}
            placeholder="Signature JSON"
            spellCheck={false}
            onChange={(event) => setSignature(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="module-actions">
        <button
          className="is-primary"
          type="button"
          disabled={!signer}
          onClick={sign}
        >
          Sign
        </button>
        <button type="button" disabled={!signature} onClick={verify}>
          Verify
        </button>
      </div>
    </div>
  );
}

function reportError(
  cause: unknown,
  show: ModuleRuntimeProps["show"],
  log: ModuleRuntimeProps["log"],
) {
  const message =
    cause instanceof Error ? cause.message : "Signature operation failed";
  show({ label: "FAULT", tone: "error", content: <strong>{message}</strong> });
  log(message, "error");
}
