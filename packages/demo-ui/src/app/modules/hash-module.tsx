"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copyText } from "../copy-text";
import type { ModuleRuntimeProps } from "../modules";

type HashEncoding = "hex" | "utf8";

function hashPayload(payload: string, encoding: HashEncoding) {
  const bytes = encoding === "utf8" ? ccc.bytesFrom(payload, "utf8") : payload;
  return ccc.hashCkb(bytes);
}

export function HashModule({ log, show }: ModuleRuntimeProps) {
  const [message, setMessage] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
    },
    [],
  );

  function showHash(hash: string, copied = false) {
    show({
      label: "CKB HASH",
      tone: "success",
      content: (
        <button type="button" onClick={() => copyResult(hash)} title={hash}>
          <strong>{hash}</strong>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      ),
    });
  }

  function copyResult(hash: string) {
    void copyText(hash)
      .then(() => {
        clearTimeout(copyTimer.current);
        showHash(hash, true);
        copyTimer.current = setTimeout(() => showHash(hash), 900);
      })
      .catch((cause) => {
        log(errorMessage(cause), "error");
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
        <textarea
          value={message}
          placeholder="Enter UTF-8 text or a 0x-prefixed hex value"
          spellCheck={false}
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
      </label>

      <div className="module-actions">
        <button type="button" onClick={() => hash("utf8")}>
          Hash UTF-8
        </button>
        <button type="button" onClick={() => hash("hex")}>
          Hash hex
        </button>
      </div>
    </div>
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Unable to hash payload";
}
