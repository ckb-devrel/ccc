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
  Radio,
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
import { DeployerModule } from "./modules/deployer-module";
import { HashModule } from "./modules/hash-module";
import {
  IssueXUdtSusModule,
  IssueXUdtTypeIdModule,
} from "./modules/issue-xudt-module";
import { KeystoreModule } from "./modules/keystore-module";
import { KhieModule } from "./modules/khie/khie-module";
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

export type TransactionAction = (
  tx: ccc.Transaction,
) => ccc.Transaction | Promise<ccc.Transaction>;

export type SubmitTransaction = (
  actionName: string,
  action: TransactionAction,
  options?: { feeRate?: ccc.Num },
) => Promise<ccc.Hex>;

export type ModuleRuntimeProps = {
  client: ccc.Client;
  log: (message: string, level?: DemoLogLevel) => void;
  setClient: (client: ccc.Client) => unknown;
  show: ShowModuleReadout;
  signer?: ccc.Signer;
  wallet?: ccc.Wallet;
  submitTransaction: SubmitTransaction;
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
  description: string;
  resources?: readonly {
    label: string;
    href: string;
  }[];
  group: ModuleGroup;
  icon: LucideIcon;
  access: "signer" | "local";
  component: ComponentType<ModuleRuntimeProps>;
};

type DemoModuleDefinition = Omit<DemoModule, "id">;

const SPORE_PROTOCOL_RESOURCES = [
  {
    label: "Spore Protocol Docs",
    href: "https://docs.spore.pro/",
  },
] as const;

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
    name: "Khie",
    description: "Connect another CCC app to the current signer over Khie.",
    group: "Development",
    icon: Radio,
    access: "signer",
    component: KhieModule,
  },
  {
    name: "Hash",
    description:
      "Hash UTF-8 text or raw hex bytes with CKB's default Blake2b configuration.",
    group: "Utilities",
    icon: Hash,
    access: "local",
    component: HashModule,
  },
  {
    name: "Mnemonic",
    description:
      "Generate or import a mnemonic, derive CKB accounts, and export an encrypted keystore.",
    group: "Wallet",
    icon: BookKey,
    access: "local",
    component: MnemonicModule,
  },
  {
    name: "Keystore",
    description:
      "Decrypt a JSON keystore and derive its CKB accounts with an optional address limit.",
    group: "Wallet",
    icon: FileLock,
    access: "local",
    component: KeystoreModule,
  },
  {
    name: "Sign",
    description:
      "Sign arbitrary messages with the connected signer and verify serialized signatures.",
    group: "Cryptography",
    icon: Signature,
    access: "signer",
    component: SignModule,
  },
  {
    name: "Transfer",
    description:
      "Send CKB to one or many addresses, attach output data, or calculate the maximum spendable amount.",
    group: "Transaction",
    icon: ArrowLeftRight,
    access: "signer",
    component: TransferModule,
  },
  {
    name: "Transfer xUDT",
    description:
      "Configure an xUDT script and transfer tokens to one or more CKB addresses.",
    group: "Token",
    icon: BadgeCent,
    access: "signer",
    component: TransferUdtModule,
  },
  {
    name: "Nervos DAO",
    description:
      "Deposit CKB into Nervos DAO, then redeem and withdraw existing DAO cells.",
    group: "Protocol",
    icon: PiggyBank,
    access: "signer",
    component: NervosDaoModule,
  },
  {
    name: "Transfer Spore",
    description:
      "Find Spores owned by the signer and transfer a selected Spore to another address.",
    resources: SPORE_PROTOCOL_RESOURCES,
    group: "Spore",
    icon: CircleDotDashed,
    access: "signer",
    component: TransferSporeModule,
  },
  {
    name: "Transfer Spore Cluster",
    description:
      "Find Spore clusters owned by the signer and transfer a selected cluster to another address.",
    resources: SPORE_PROTOCOL_RESOURCES,
    group: "Spore",
    icon: Network,
    access: "signer",
    component: TransferSporeClusterModule,
  },
  {
    name: "Time Locked Transfer",
    description:
      "Lock CKB for a relative number of blocks or claim matured time-locked cells.",
    group: "Transaction",
    icon: LockKeyhole,
    access: "signer",
    component: TimeLockedTransferModule,
  },
  {
    name: "Deployer",
    description:
      "Deploy, update, or burn an on-chain cell backed by a Type ID.",
    group: "Development",
    icon: Rocket,
    access: "signer",
    component: DeployerModule,
  },
  {
    name: "Dep Group",
    description:
      "Create, inspect, or update a Type ID dep group from a list of cell outpoints.",
    resources: [
      {
        label: "RFC 22 · Dep Group",
        href: "https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md#dep-group",
      },
    ],
    group: "Development",
    icon: Combine,
    access: "signer",
    component: DepGroupModule,
  },
  {
    name: "Issue xUDT (Type ID)",
    description:
      "Issue an xUDT through two or three transactions, with owner authority controlled by a Type ID proxy lock.",
    resources: [
      {
        label: "Single-Use Seals · EN/CN",
        href: "https://talk.nervos.org/t/en-cn-misc-single-use-seals/8279",
      },
    ],
    group: "Token",
    icon: KeySquare,
    access: "signer",
    component: IssueXUdtTypeIdModule,
  },
  {
    name: "Issue xUDT (SUS)",
    description:
      "Create a single-use seal, owner cell, and xUDT issuance across three signed transactions.",
    resources: [
      {
        label: "Single-Use Seals · EN/CN",
        href: "https://talk.nervos.org/t/en-cn-misc-single-use-seals/8279",
      },
    ],
    group: "Token",
    icon: Stamp,
    access: "signer",
    component: IssueXUdtSusModule,
  },
  {
    name: "Create Spore Cluster",
    description:
      "Create a Spore cluster with plain metadata or a DOB/0 or DOB/1 description.",
    resources: SPORE_PROTOCOL_RESOURCES,
    group: "Spore",
    icon: PackagePlus,
    access: "signer",
    component: CreateSporeClusterModule,
  },
  {
    name: "Mint Spore",
    description:
      "Mint a Spore with custom content, optionally assigning it to one of your clusters.",
    resources: SPORE_PROTOCOL_RESOURCES,
    group: "Spore",
    icon: Sparkles,
    access: "signer",
    component: MintSporeModule,
  },
  {
    name: "SSRI",
    description:
      "Locate a contract by Type ID and invoke an SSRI method through a local executor.",
    resources: [
      {
        label: "SSRI Design Notes · EN/CN",
        href: "https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256",
      },
    ],
    group: "Development",
    icon: Braces,
    access: "signer",
    component: SsriModule,
  },
  {
    name: "Transfer with Lumos",
    description:
      "Build and send a basic CKB transfer through the legacy Lumos integration.",
    group: "Transaction",
    icon: Workflow,
    access: "signer",
    component: TransferLumosModule,
  },
]);
