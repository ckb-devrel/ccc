"use client";

import { BigButton } from "@/src/components/BigButton";
import { useApp } from "@/src/context";
import { icons } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const TABS: [string, string, keyof typeof icons, string][] = [
  ["Hash", "/utils/Hash", "Barcode", "text-violet-500"],
  ["Mnemonic", "/utils/Mnemonic", "SquareAsterisk", "text-fuchsia-500"],
  ["Keystore", "/utils/Keystore", "Notebook", "text-rose-500"],
  ["Dep Group", "/utils/DepGroup", "Boxes", "text-amber-500"],
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
