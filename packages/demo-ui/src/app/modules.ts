import type { ccc } from "@ckb-ccc/connector-react";
import { Hash, Send, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { DemoLogLevel } from "./activity-console";
import type { ShowModuleReadout } from "./module-readout";
import { HashModule } from "./modules/hash-module";
import { TransferModule } from "./modules/transfer-module";

export type ModuleRuntimeProps = {
  client: ccc.Client;
  log: (message: string, level?: DemoLogLevel) => void;
  show: ShowModuleReadout;
  signer?: ccc.Signer;
};

export type DemoModule = {
  id: "hash" | "transfer";
  name: string;
  group: string;
  icon: LucideIcon;
  access: "signer" | "local";
  component: ComponentType<ModuleRuntimeProps>;
};

export const demoModules: readonly DemoModule[] = [
  {
    id: "hash",
    name: "Hash",
    group: "Utilities",
    icon: Hash,
    access: "local",
    component: HashModule,
  },
  {
    id: "transfer",
    name: "Transfer",
    group: "Transaction",
    icon: Send,
    access: "signer",
    component: TransferModule,
  },
];
