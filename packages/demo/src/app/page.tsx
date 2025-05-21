/* eslint-disable @next/next/no-img-element */
"use client";

import { ccc } from "@ckb-ccc/connector-react";
import React, { useEffect } from "react";
import { BigButton } from "@/src/components/BigButton";
import { useRouter } from "next/navigation";
import { useApp } from "@/src/context";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { signer } = useApp();

  useEffect(() => {
    if (signer) {
      router.push("/connected");
    }
  }, [signer, router]);

  useEffect(() => {
    router.prefetch("/connectPrivateKey");
  }, [router]);

  const { open } = ccc.useCcc();

  return (
    <>
      <div className="my-4 flex grow flex-col items-center justify-center gap-8 md:flex-row md:gap-32">
        <BigButton onClick={open} iconName="Wallet" className="text-cyan-500">
          Wallet
        </BigButton>
        <BigButton
          onClick={() => router.push("/connectPrivateKey")}
          iconName="Key"
          className="text-emerald-500"
        >
          Private Key
        </BigButton>
        <BigButton
          onClick={() => router.push("/fiber")}
          iconName="Key"
          className="text-emerald-500"
        >
          Fiber
        </BigButton>
      </div>
      <Link
        href="/utils"
        className="mb-4 rounded rounded-full bg-white px-4 py-2 no-underline shadow"
        prefetch={true}
      >
        Skip Connecting
      </Link>
    </>
  );
}
