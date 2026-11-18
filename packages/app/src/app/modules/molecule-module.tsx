"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { Schema } from "@ckb-ccc/molecule";
import { useId, useMemo, useRef, useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError } from "./module-helpers";
import styles from "./molecule-module.module.css";

const EXAMPLE_SCHEMA = `vector Bytes <byte>;

table Message {
    version: byte,
    payload: Bytes,
}`;
const EXAMPLE_JSON = '{\n  "version": "0x01",\n  "payload": "0x68656c6c6f"\n}';

function convertValue(
  codec: ccc.Codec<unknown, unknown, unknown>,
  direction: "encode" | "decode",
  input: string,
) {
  const bytes =
    direction === "encode"
      ? codec.encode(JSON.parse(input))
      : ccc.bytesFrom(input.trim());
  const value =
    direction === "encode"
      ? ccc.hexFrom(bytes)
      : JSON.stringify(
          codec.decode(bytes),
          (_key, value) => {
            // JSON has no undefined value: represent absent Molecule options as null.
            if (value === undefined) {
              return null;
            }
            return typeof value === "bigint" ? value.toString() : value;
          },
          2,
        );
  return { value, byteLength: bytes.length };
}

// -----------------------------------------------------------------------------

export function MoleculeModule({ log, show }: ModuleRuntimeProps) {
  const [schema, setSchema] = useState(EXAMPLE_SCHEMA);
  const [selection, setSelection] = useState("Message");
  const [json, setJson] = useState(EXAMPLE_JSON);
  const [hex, setHex] = useState("");
  const [conversionError, setConversionError] = useState<{
    direction: "encode" | "decode";
    message: string;
  }>();
  const conversionErrorId = useId();
  const hasReadout = useRef(false);
  const schemaErrorId = useId();
  const parsed = useMemo(() => {
    try {
      return { codecs: Schema.from(schema), error: undefined };
    } catch (cause) {
      return {
        codecs: undefined,
        error: cause instanceof Error ? cause.message : "Invalid schema",
      };
    }
  }, [schema]);
  const names = [...(parsed.codecs?.keys() ?? [])];
  const selected = names.includes(selection) ? selection : (names[0] ?? "");
  const codec = selected ? parsed.codecs?.get(selected) : undefined;

  function invalidateReadout() {
    setConversionError(undefined);
    if (!hasReadout.current) {
      return;
    }
    hasReadout.current = false;
    show({
      label: "OUTPUT",
      tone: "idle",
      content: (
        <strong className="is-empty">Inputs changed. Convert again.</strong>
      ),
    });
  }

  function convert(direction: "encode" | "decode") {
    if (!codec) {
      return;
    }
    setConversionError(undefined);
    try {
      const { value: result, byteLength } = convertValue(
        codec,
        direction,
        direction === "encode" ? json : hex,
      );
      if (direction === "encode") {
        setHex(result);
      } else {
        setJson(result);
      }
      hasReadout.current = true;
      show({
        label: `${selected} · ${byteLength} BYTES · ${direction === "encode" ? "ENCODED" : "DECODED"}`,
        tone: "success",
        content: (
          <CopyableReadoutValue
            value={result}
            onError={(cause) =>
              reportModuleError(cause, show, log, "Unable to copy result")
            }
          >
            <span className={styles.result}>{result}</span>
          </CopyableReadoutValue>
        ),
      });
      log(
        `${selected}: ${direction === "encode" ? "encoded" : "decoded"} ${byteLength} bytes`,
        "success",
      );
    } catch (cause) {
      setConversionError({
        direction,
        message:
          cause instanceof Error
            ? cause.message
            : "Unable to convert Molecule data",
      });
      hasReadout.current = true;
      reportModuleError(cause, show, log, "Unable to convert Molecule data");
    }
  }

  return (
    <div className="module-console">
      <label className="module-field">
        <span>Molecule schema</span>
        <ModuleTextarea
          value={schema}
          rows={7}
          spellCheck={false}
          aria-invalid={Boolean(parsed.error)}
          aria-describedby={parsed.error ? schemaErrorId : undefined}
          onChange={(event) => {
            setSchema(event.currentTarget.value);
            invalidateReadout();
          }}
        />
      </label>
      {parsed.error ? (
        <p id={schemaErrorId} className={styles.error} role="status">
          {parsed.error}
        </p>
      ) : null}
      <div className={styles.typeRow}>
        <label className="module-field">
          <span>Type</span>
          <select
            value={selected}
            disabled={names.length === 0}
            onChange={(event) => {
              setSelection(event.currentTarget.value);
              invalidateReadout();
            }}
          >
            {names.length === 0 ? (
              <option value="">No types available</option>
            ) : null}
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.hint}>
          Paste your schema, choose a type, then convert in either direction.
          All processing stays in your browser.
        </p>
      </div>
      <div className={`module-fields ${styles.values}`}>
        <div className={styles.value}>
          <label className="module-field">
            <span>JSON value</span>
            <ModuleTextarea
              value={json}
              aria-invalid={conversionError?.direction === "encode"}
              aria-describedby={
                conversionError?.direction === "encode"
                  ? conversionErrorId
                  : undefined
              }
              rows={6}
              spellCheck={false}
              onChange={(event) => {
                setJson(event.currentTarget.value);
                invalidateReadout();
              }}
            />
          </label>
          {conversionError?.direction === "encode" ? (
            <p id={conversionErrorId} className={styles.error} role="status">
              {conversionError.message}
            </p>
          ) : null}
          <div className="module-actions">
            <button
              type="button"
              className="is-primary"
              disabled={!codec}
              onClick={() => convert("encode")}
            >
              Encode to hex
            </button>
          </div>
        </div>
        <div className={styles.value}>
          <label className="module-field">
            <span>Encoded hex</span>
            <ModuleTextarea
              value={hex}
              aria-invalid={conversionError?.direction === "decode"}
              aria-describedby={
                conversionError?.direction === "decode"
                  ? conversionErrorId
                  : undefined
              }
              rows={6}
              spellCheck={false}
              placeholder="0x…"
              onChange={(event) => {
                setHex(event.currentTarget.value);
                invalidateReadout();
              }}
            />
          </label>
          {conversionError?.direction === "decode" ? (
            <p id={conversionErrorId} className={styles.error} role="status">
              {conversionError.message}
            </p>
          ) : null}
          <div className="module-actions">
            <button
              type="button"
              disabled={!codec}
              onClick={() => convert("decode")}
            >
              Decode to JSON
            </button>
          </div>
        </div>
      </div>
      <p className={styles.hint}>
        Use hex strings for bytes and byte arrays/vectors; null for absent
        options. Include imported definitions in the schema; no files are
        fetched automatically.
      </p>
    </div>
  );
}
