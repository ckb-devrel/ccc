/* eslint-disable @next/next/no-img-element */
"use client";

import { BigButton } from "@/src/components/BigButton";
import { icons } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

/* eslint-disable react/jsx-key */
const TABS: [ReactNode, string, keyof typeof icons, string][] = [
  ["Sign", "/connected/Sign", "Signature", "text-orange-500"],
  ["Transfer", "/connected/Transfer", "ArrowLeftRight", "text-lime-500"],
  [
    "Transfer with Lumos",
    "/connected/TransferLumos",
    "LampWallDown",
    "text-yellow-500",
  ],
  [
    "Time Locked Transfer",
    "/connected/TimeLockedTransfer",
    "Clock",
    "text-amber-500",
  ],
  ["Transfer UDT", "/connected/TransferUdt", "BadgeCent", "text-emerald-500"],
  ["Issue xUDT (SUS)", "/connected/IssueXUdtSus", "Rss", "text-sky-500"],
  [
    <div className="flex flex-col">
      Issue xUDT <span className="whitespace-nowrap">(Type ID)</span>
    </div>,
    "/connected/IssueXUdtTypeId",
    "PencilRuler",
    "text-blue-500",
  ],
  [
    "Create Spore Cluster",
    "/connected/CreateSporeCluster",
    "Wheat",
    "text-indigo-600",
  ],
  ["Mint Spore", "/connected/MintSpore", "Cherry", "text-violet-600"],
  ["Transfer Spore", "/connected/TransferSpore", "Ticket", "text-sky-400"],
  [
    "Transfer Spore Cluster",
    "/connected/TransferSporeCluster",
    "Images",
    "text-cyan-600",
  ],
  ["Nervos DAO", "/connected/NervosDao", "Vault", "text-pink-500"],
  ["Dep Group", "/utils/DepGroup", "Boxes", "text-amber-500"],
  ["SSRI", "/connected/SSRI", "Pill", "text-blue-500"],
  ["Hash", "/utils/Hash", "Barcode", "text-violet-500"],
  ["Mnemonic", "/utils/Mnemonic", "SquareAsterisk", "text-fuchsia-500"],
  ["Keystore", "/utils/Keystore", "Notebook", "text-rose-500"],
];
/* eslint-enable react/jsx-key */

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    TABS.forEach(([_, path]) => router.prefetch(path));
  }, [router]);

  return (
    <div className="flex flex-wrap justify-center gap-8 px-4 lg:px-16">
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
