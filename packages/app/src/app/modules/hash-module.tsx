"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";

type HashEncoding = "hex" | "utf8";

function hashPayload(payload: string, encoding: HashEncoding) {
  const bytes = encoding === "utf8" ? ccc.bytesFrom(payload, "utf8") : payload;
  return ccc.hashCkb(bytes);
}

// -----------------------------------------------------------------------------

export function HashModule({ log, show }: ModuleRuntimeProps) {
  const [message, setMessage] = useState("");

  function showHash(hash: string) {
    show({
      label: "CKB HASH",
      tone: "success",
      content: (
        <CopyableReadoutValue
          value={hash}
          onError={(cause) => log(errorMessage(cause), "error")}
        />
      ),
    });
  }

  const hash = (encoding: HashEncoding) => {
    try {
      const hash = hashPayload(message, encoding);
      showHash(hash);
      log(`${encoding.toUpperCase()} hash computed: ${hash}`, "success");
    } catch (cause) {
      const error = errorMessage(cause);
      show({
        label: "FAULT",
        tone: "error",
        content: <strong>{error}</strong>,
      });
      log(error, "error");
    }
  };

  return (
    <div className="module-console hash-console">
      <label className="module-field module-field-wide">
        <span>Payload</span>
        <ModuleTextarea
          value={message}
          placeholder="Enter UTF-8 text or a 0x-prefixed hex value"
          spellCheck={false}
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
      </label>

      <div className="module-actions">
        <button
          className="is-primary"
          type="button"
          onClick={() => hash("utf8")}
        >
          Hash UTF-8
        </button>
        <button
          className="is-primary"
          type="button"
          onClick={() => hash("hex")}
        >
          Hash hex
        </button>
      </div>
    </div>
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Unable to hash payload";
}
