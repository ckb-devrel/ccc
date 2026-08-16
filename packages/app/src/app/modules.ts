import type { ccc } from "@ckb-ccc/connector-react";
import {
  ArrowLeftRight,
  BadgeCent,
  BookKey,
  Braces,
  CircleDotDashed,
  Combine,
  FileLock,
  Hash,
  KeySquare,
  LockKeyhole,
  Network,
  PackagePlus,
  PiggyBank,
  Rocket,
  Signature,
  Sparkles,
  Stamp,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import type { DemoLogLevel } from "./activity-console";
import type { ShowModuleReadout } from "./module-readout";
import { CreateSporeClusterModule } from "./modules/create-spore-cluster-module";
import { DepGroupModule } from "./modules/dep-group-module";
import { DeployScriptModule } from "./modules/deploy-script-module";
import { HashModule } from "./modules/hash-module";
import {
  IssueXUdtSusModule,
  IssueXUdtTypeIdModule,
} from "./modules/issue-xudt-module";
import { KeystoreModule } from "./modules/keystore-module";
import { MintSporeModule } from "./modules/mint-spore-module";
import { MnemonicModule } from "./modules/mnemonic-module";
import { NervosDaoModule } from "./modules/nervos-dao-module";
import { SignModule } from "./modules/sign-module";
import { SsriModule } from "./modules/ssri-module";
import { TimeLockedTransferModule } from "./modules/time-locked-transfer-module";
import { TransferLumosModule } from "./modules/transfer-lumos-module";
import { TransferModule } from "./modules/transfer-module";
import { TransferSporeClusterModule } from "./modules/transfer-spore-cluster-module";
import { TransferSporeModule } from "./modules/transfer-spore-module";
import { TransferUdtModule } from "./modules/transfer-udt-module";

export type ModuleRuntimeProps = {
  client: ccc.Client;
  log: (message: string, level?: DemoLogLevel) => void;
  show: ShowModuleReadout;
  signer?: ccc.Signer;
};

export type ModuleGroup =
  | "Cryptography"
  | "Development"
  | "Protocol"
  | "Spore"
  | "Token"
  | "Transaction"
  | "Utilities"
  | "Wallet";

export type DemoModule = {
  id: string;
  name: string;
  group: ModuleGroup;
  icon: LucideIcon;
  access: "signer" | "local";
  component: ComponentType<ModuleRuntimeProps>;
};

type DemoModuleDefinition = Omit<DemoModule, "id">;

export function moduleIdFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defineModules(definitions: readonly DemoModuleDefinition[]) {
  const ids = new Set<string>();
  return definitions.map((definition): DemoModule => {
    const id = moduleIdFromName(definition.name);
    if (!id || ids.has(id)) {
      throw new Error(`Invalid or duplicate module name: ${definition.name}`);
    }
    ids.add(id);
    return { ...definition, id };
  });
}

export const demoModules: readonly DemoModule[] = defineModules([
  {
    name: "Hash",
    group: "Utilities",
    icon: Hash,
    access: "local",
    component: HashModule,
  },
  {
    name: "Mnemonic",
    group: "Wallet",
    icon: BookKey,
    access: "local",
    component: MnemonicModule,
  },
  {
    name: "Keystore",
    group: "Wallet",
    icon: FileLock,
    access: "local",
    component: KeystoreModule,
  },
  {
    name: "Sign",
    group: "Cryptography",
    icon: Signature,
    access: "signer",
    component: SignModule,
  },
  {
    name: "Transfer",
    group: "Transaction",
    icon: ArrowLeftRight,
    access: "signer",
    component: TransferModule,
  },
  {
    name: "Transfer xUDT",
    group: "Token",
    icon: BadgeCent,
    access: "signer",
    component: TransferUdtModule,
  },
  {
    name: "Nervos DAO",
    group: "Protocol",
    icon: PiggyBank,
    access: "signer",
    component: NervosDaoModule,
  },
  {
    name: "Transfer Spore",
    group: "Spore",
    icon: CircleDotDashed,
    access: "signer",
    component: TransferSporeModule,
  },
  {
    name: "Transfer Spore Cluster",
    group: "Spore",
    icon: Network,
    access: "signer",
    component: TransferSporeClusterModule,
  },
  {
    name: "Time Locked Transfer",
    group: "Transaction",
    icon: LockKeyhole,
    access: "signer",
    component: TimeLockedTransferModule,
  },
  {
    name: "Deploy Script",
    group: "Development",
    icon: Rocket,
    access: "signer",
    component: DeployScriptModule,
  },
  {
    name: "Dep Group",
    group: "Development",
    icon: Combine,
    access: "signer",
    component: DepGroupModule,
  },
  {
    name: "Issue xUDT (Type ID)",
    group: "Token",
    icon: KeySquare,
    access: "signer",
    component: IssueXUdtTypeIdModule,
  },
  {
    name: "Issue xUDT (SUS)",
    group: "Token",
    icon: Stamp,
    access: "signer",
    component: IssueXUdtSusModule,
  },
  {
    name: "Create Spore Cluster",
    group: "Spore",
    icon: PackagePlus,
    access: "signer",
    component: CreateSporeClusterModule,
  },
  {
    name: "Mint Spore",
    group: "Spore",
    icon: Sparkles,
    access: "signer",
    component: MintSporeModule,
  },
  {
    name: "SSRI",
    group: "Development",
    icon: Braces,
    access: "signer",
    component: SsriModule,
  },
  {
    name: "Transfer with Lumos",
    group: "Transaction",
    icon: Workflow,
    access: "signer",
    component: TransferLumosModule,
  },
]);
