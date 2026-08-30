"use client";

import dynamic from "next/dynamic";
import type { ModuleRuntimeProps } from "../../modules";

const KhieClientModule = dynamic(
  () =>
    import("./khie-client-module").then((module) => module.KhieClientModule),
  {
    ssr: false,
    loading: () => <strong>Loading browser libp2p module…</strong>,
  },
);

export function KhieModule({
  client,
  log,
  setClient,
  show,
  signer,
  wallet,
}: ModuleRuntimeProps) {
  if (!signer) {
    return null;
  }

  return (
    <KhieClientModule
      client={client}
      log={log}
      setClient={setClient}
      signer={signer}
      signerIcon={wallet?.icon}
      signerName={wallet?.name}
      show={show}
    />
  );
}
