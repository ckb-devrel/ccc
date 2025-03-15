"use client";

import { useApp } from "@/src/context";
import { Dropdown } from "@/src/components/Dropdown";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { icons } from "lucide-react";
import { BigButton } from "@/src/components/BigButton";

const TABS: [string, string, keyof typeof icons, string][] = [
  ["Hash", "/utils/Hash", "Barcode", "text-violet-500"],
  ["Mnemonic", "/utils/Mnemonic", "SquareAsterisk", "text-fuchsia-500"],
  ["Keystore", "/utils/Keystore", "Notebook", "text-rose-500"],
  ["Molecule", "/utils/Molecule", "Hash", "text-emerald-500"],
];

export default function Page() {
  const router = useRouter();
  const { signer } = useApp();

  useEffect(() => {
    if (signer) {
      router.push("/connected");
    }
  }, [signer, router]);

  useEffect(() => {
    TABS.forEach(([_, path]) => router.prefetch(path));
  }, [router]);

  return (
    <div className="flex flex-wrap justify-center gap-4 px-4 lg:px-16">
      {TABS.map(([name, link, iconName, classes]) => (
        <BigButton
          key={link}
          size="sm"
          iconName={iconName}
          onClick={() => router.push(link)}
          className={classes}
        >
          {name}
        </BigButton>
      ))}
    </div>
  );
}
