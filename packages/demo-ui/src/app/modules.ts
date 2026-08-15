import {
  ArrowDownToLine,
  Braces,
  CircleDollarSign,
  Cpu,
  Fingerprint,
  Hash,
  KeyRound,
  LockKeyhole,
  Send,
  Shapes,
  Sparkles,
  Vault,
  type LucideIcon,
} from "lucide-react";

export type DemoModule = {
  name: string;
  group: string;
  icon: LucideIcon;
  access: "signer" | "local";
};

export const demoModules: readonly DemoModule[] = [
  { name: "Transfer CKB", group: "Transaction", icon: Send, access: "signer" },
  { name: "Nervos DAO", group: "Transaction", icon: Vault, access: "signer" },
  {
    name: "Sign message",
    group: "Transaction",
    icon: Fingerprint,
    access: "signer",
  },
  {
    name: "Time lock",
    group: "Transaction",
    icon: LockKeyhole,
    access: "signer",
  },
  {
    name: "Issue xUDT",
    group: "Assets",
    icon: CircleDollarSign,
    access: "signer",
  },
  {
    name: "Transfer xUDT",
    group: "Assets",
    icon: ArrowDownToLine,
    access: "signer",
  },
  { name: "Mint Spore", group: "Assets", icon: Sparkles, access: "signer" },
  {
    name: "Spore cluster",
    group: "Assets",
    icon: Shapes,
    access: "signer",
  },
  {
    name: "Deploy script",
    group: "Developer",
    icon: Cpu,
    access: "signer",
  },
  { name: "SSRI", group: "Developer", icon: Braces, access: "signer" },
  { name: "Hash utilities", group: "Utilities", icon: Hash, access: "local" },
  { name: "Mnemonic", group: "Utilities", icon: KeyRound, access: "local" },
];
