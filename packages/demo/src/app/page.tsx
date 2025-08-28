"use client";

import { BigButton } from "@/src/components/BigButton";
import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
