"use client";

import { ccc, spore } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, showTransaction } from "./module-helpers";

function formatJson(value: string) {
  return JSON.stringify(JSON.parse(value), undefined, 2);
}

function dobExamples(client: ccc.Client) {
  const description = "My First DOB Cluster";
  const dob0Pattern: spore.dob.PatternElementDob0[] = [
    {
      traitName: "BackgroundColor",
      dobType: "String",
      dnaOffset: 0,
      dnaLength: 1,
      patternType: "options",
      traitArgs: ["red", "blue", "green", "black", "white"],
    },
    {
      traitName: "Type",
      dobType: "Number",
      dnaOffset: 1,
      dnaLength: 1,
      patternType: "range",
      traitArgs: [10, 50],
    },
    {
      traitName: "Timestamp",
      dobType: "Number",
      dnaOffset: 2,
      dnaLength: 4,
      patternType: "rawNumber",
    },
  ];
  const dob0: spore.dob.Dob0 = {
    description,
    dob: {
      ver: 0,
      decoder: spore.dob.getDecoder(client, "dob0"),
      pattern: dob0Pattern,
    },
  };
  const dob1Pattern: spore.dob.PatternElementDob1[] = [
    {
      imageName: "IMAGE.0",
      svgFields: "attributes",
      traitName: "",
      patternType: "raw",
      traitArgs: "xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'",
    },
    {
      imageName: "IMAGE.0",
      svgFields: "elements",
      traitName: "BackgroundColor",
      patternType: "options",
      traitArgs: [
        ["red", "<rect width='300' height='200' fill='red' />"],
        ["blue", "<rect width='300' height='200' fill='blue' />"],
        [["*"], "<rect width='300' height='200' fill='black' />"],
      ],
    },
  ];
  const dob1: spore.dob.Dob1 = {
    description,
    dob: {
      ver: 1,
      decoders: [
        { decoder: spore.dob.getDecoder(client, "dob0"), pattern: dob0Pattern },
        { decoder: spore.dob.getDecoder(client, "dob1"), pattern: dob1Pattern },
      ],
    },
  };
  return {
    dob0: formatJson(spore.dob.encodeClusterDescriptionForDob0(dob0)),
    dob1: formatJson(spore.dob.encodeClusterDescriptionForDob1(dob1)),
  };
}

function normalizeClusterDescription(description: string) {
  return description.trim().startsWith("{")
    ? JSON.stringify(JSON.parse(description))
    : description;
}

async function buildCluster(
  signer: ccc.Signer,
  name: string,
  description: string,
) {
  const { tx, id } = await spore.createSporeCluster({
    signer,
    data: { name, description: normalizeClusterDescription(description) },
  });
  await tx.completeFeeBy(signer);
  return { id, tx };
}

// -----------------------------------------------------------------------------

export function CreateSporeClusterModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [name, setName] = useState("My First DOB Cluster");
  const [description, setDescription] = useState(
    () => dobExamples(client).dob1,
  );
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const { id, tx } = await buildCluster(signer, name, description);
      const txHash = await signer.sendTransaction(tx);
      showTransaction(
        client,
        show,
        txHash,
        `Cluster ${id.slice(0, 10)} created`,
      );
      log(`Transaction sent: ${txHash}; Cluster ID: ${id}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(client, show, txHash, "Cluster creation committed", true);
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "Cluster creation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Cluster name</span>
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Description</span>
          <ModuleTextarea
            className="module-output"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="module-actions">
        <button
          type="button"
          onClick={() => setDescription(dobExamples(client).dob0)}
        >
          DOB/0 example
        </button>
        <button
          type="button"
          onClick={() => setDescription(dobExamples(client).dob1)}
        >
          DOB/1 example
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={!signer || busy || !name}
          onClick={create}
        >
          {busy ? "Creating…" : "Create cluster"}
        </button>
      </div>
    </div>
  );
}
