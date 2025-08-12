/* eslint-disable @next/next/no-img-element */
"use client";

import { Background } from "@/src/components/Background";
import { Button } from "@/src/components/Button";
import { Dropdown } from "@/src/components/Dropdown";
import { AppProvider, useApp } from "@/src/context";
import { formatString, useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import {
  Camera,
  CameraOff,
  FlaskConical,
  FlaskConicalOff,
  Pause,
  Play,
  Search,
  SquareTerminal,
  X,
} from "lucide-react";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

function Links(props: React.ComponentPropsWithoutRef<"div">) {
  const { index } = useGetExplorerLink();

  return (
    <div
      {...props}
      className={`flex items-center justify-center gap-8 ${props.className ?? ""}`}
    >
      <Link href="/" className="h-6 w-6">
        <img
          src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logo.svg"
          alt="CCC"
        />
      </Link>
      <Link href="https://live.ckbccc.com/" target="_blank">
        <SquareTerminal className="h-6 w-6" strokeWidth={3} />
      </Link>
      <Link href="https://github.com/ckb-devrel/ccc" target="_blank">
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          id="github"
        >
          <path d="M7.999 0C3.582 0 0 3.596 0 8.032a8.031 8.031 0 0 0 5.472 7.621c.4.074.546-.174.546-.387 0-.191-.007-.696-.011-1.366-2.225.485-2.695-1.077-2.695-1.077-.363-.928-.888-1.175-.888-1.175-.727-.498.054-.488.054-.488.803.057 1.225.828 1.225.828.714 1.227 1.873.873 2.329.667.072-.519.279-.873.508-1.074-1.776-.203-3.644-.892-3.644-3.969 0-.877.312-1.594.824-2.156-.083-.203-.357-1.02.078-2.125 0 0 .672-.216 2.2.823a7.633 7.633 0 0 1 2.003-.27 7.65 7.65 0 0 1 2.003.271c1.527-1.039 2.198-.823 2.198-.823.436 1.106.162 1.922.08 2.125.513.562.822 1.279.822 2.156 0 3.085-1.87 3.764-3.652 3.963.287.248.543.738.543 1.487 0 1.074-.01 1.94-.01 2.203 0 .215.144.465.55.386A8.032 8.032 0 0 0 16 8.032C16 3.596 12.418 0 7.999 0z"></path>
        </svg>
      </Link>
      <Link href="https://x.com/CKBDevrel" target="_blank">
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
        >
          <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
        </svg>
      </Link>
      <Link href="https://faucet.nervos.org/" target="_blank">
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 360 360"
        >
          <path
            d="M102.342,246.475C99.541,242.42,94.928,240,90,240s-9.541,2.42-12.342,6.475
		c-0.32,0.463-7.925,11.497-15.633,24.785C46.765,297.566,45,308.822,45,315c0,24.813,20.187,45,45,45s45-20.187,45-45
		c0-6.178-1.765-17.434-17.025-43.74C110.267,257.972,102.662,246.938,102.342,246.475z"
          />
          <path
            d="M300,60h-60h-15V30h15c8.284,0,15-6.716,15-15s-6.716-15-15-15h-60c-8.284,0-15,6.716-15,15s6.716,15,15,15
		h15v30h-15h-60c-41.355,0-75,33.645-75,75v60c0,8.284,6.716,15,15,15h60c8.284,0,15-6.716,15-15v-45h45h60h60
		c8.284,0,15-6.716,15-15V75C315,66.716,308.284,60,300,60z"
          />
        </svg>
      </Link>
      <Link href="https://www.nervos.org/" target="_blank">
        <svg
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 207.6765 206.318"
          fill="#000"
        >
          <polygon points="0 0 0 206.318 53.151 206.318 53.151 93.897 93.896 93.897 0 0" />
          <polygon points="154.525 0 154.525 112.422 113.781 112.422 207.676 206.318 207.676 0 154.525 0" />
        </svg>
      </Link>
      <Link href={index} target="_blank">
        <Search className="h-6 w-6" strokeWidth={4} />
      </Link>
    </div>
  );
}

function ClientSwitcher() {
  const { setClient, client } = ccc.useCcc();
  const [isTestnet, setIsTestnet] = useState(true);

  useEffect(() => {
    setIsTestnet(client.addressPrefix !== "ckb");
  }, [client]);

  useEffect(() => {
    setClient(
      isTestnet ? new ccc.ClientPublicTestnet() : new ccc.ClientPublicMainnet(),
    );
  }, [isTestnet, setClient]);

  return (
    <button
      onClick={() => setIsTestnet(!isTestnet)}
      className="mr-4 flex gap-2"
    >
      {isTestnet ? (
        <FlaskConical className="h-6 w-6" />
      ) : (
        <FlaskConicalOff className="h-6 w-6" />
      )}
      {isTestnet ? "Testnet" : "Mainnet"}
    </button>
  );
}

function WalletInfo() {
  const { signer, openAction, openSigner, disconnect } = useApp();

  const [balance, setBalance] = useState(ccc.Zero);
  useEffect(() => {
    if (!signer) {
      return;
    }

    signer.getBalance().then((v) => setBalance(v));
  }, [signer]);

  if (!signer) {
    return (
      <Button
        disabled
        className="h-7 py-0 text-sm"
        style={{ paddingLeft: "0.5rem", paddingRight: "0.5rem" }}
      >
        Not Connected
      </Button>
    );
  }

  return (
    <div className="flex items-center">
      <p className="font-bold">
        {ccc.fixedPointToString(balance / ccc.fixedPointFrom("1", 6), 2)} CKB
      </p>
      <Button
        onClick={openSigner}
        className="ml-3 h-7 py-0 text-sm"
        style={{ paddingLeft: "0.5rem", paddingRight: "0.5rem" }}
      >
        {openAction}
      </Button>
      <Button
        className="ml-1 h-7 w-7"
        onClick={disconnect}
        style={{ padding: 0 }}
      >
        <X size={16} />
      </Button>
    </div>
  );
}

function AnimateControl() {
  const { enabledAnimate, backgroundLifted, setAnimate, setBackgroundLifted } =
    useApp();

  return (
    <div className="ml-4 flex gap-2">
      {enabledAnimate ? (
        <Pause
          fill="black"
          className="z-50 h-8 w-8 cursor-pointer"
          onClick={() => setAnimate(false)}
        />
      ) : (
        <Play
          fill="black"
          className="z-50 h-8 w-8 cursor-pointer"
          onClick={() => setAnimate(true)}
        />
      )}
      {backgroundLifted ? (
        <CameraOff
          className="z-50 h-8 w-8 cursor-pointer"
          onClick={() => setBackgroundLifted(false)}
        />
      ) : (
        <Camera
          className="z-50 h-8 w-8 cursor-pointer"
          onClick={() => setBackgroundLifted(true)}
        />
      )}
    </div>
  );
}

function Addresses() {
  const { signer, sendMessage } = useApp();
  const { explorerAddress } = useGetExplorerLink();

  const [addresses, setAddresses] = useState<string[]>([]);
  useEffect(() => {
    if (!signer) {
      return;
    }

    signer.getAddresses().then((v) => setAddresses(v));
  }, [signer]);

  if (addresses.length === 0 || !signer) {
    return undefined;
  }

  return (
    <Dropdown
      options={addresses.map((address, i) => ({
        name: address,
        displayName: formatString(address, 5, 4),
        iconName: i === 0 ? "HandCoins" : "CircleDollarSign",
      }))}
      selected={addresses[0]}
      onSelect={(address) => {
        sendMessage("info", "Address Copied", [explorerAddress(address)]);
        window.navigator.clipboard.writeText(address);
      }}
    />
  );
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  return (
    <ccc.Provider /*
      defaultClient={new ccc.ClientPublicTestnet()} // Default client used by connector
      connectorProps={{
        style: {
          "--background": "#fff",
          "--divider": "#eee",
          "--btn-primary": "#f8f8f8",
          "--btn-primary-hover": "#efeeee",
          "--btn-secondary": "#ddd",
          "--btn-secondary-hover": "#ccc",
          "--icon-primary": "#1E1E1E",
          "--icon-secondary": "#666666",
          color: "#1e1e1e",
          "--tip-color": "#666",
        } as React.CSSProperties,
      }} // Custom props on the connector element
      name="Custom name" // Custom name for your application, default to website title
      icon="https://custom.icon" // Custom icon for your application, default to website icon
      signerFilter={async (signerInfo, wallet) => true} // Filter out signers that you don't want
      signersController={new ccc.SignersController()}
        // Custom signers controller, see SignersController from @ckb-ccc/ccc
        // Overrides signerFilter
      preferredNetworks={[
        {
          addressPrefix: "ckt",
          signerType: ccc.SignerType.BTC,
          network: "btc",
        },
      ]}
      hideMark // Hide "Powered by CCC"
    */
      clientOptions={[
        {
          name: "CKB Testnet",
          client: new ccc.ClientPublicTestnet(),
        },
        {
          name: "CKB Mainnet",
          client: new ccc.ClientPublicMainnet(),
        },
      ]} // Optional, remove this property to disable client selecting
    >
      <AppProvider>
        <div className="flex h-dvh flex-col">
          <Background />
          <header className="flex w-full flex-col items-center justify-between gap-4 border-b bg-white px-8 py-3 md:flex-row">
            <Links />
            <WalletInfo />
          </header>
          <main className="relative flex grow flex-col items-center justify-around overflow-y-scroll pb-4 pt-8">
            <div className="flex w-full grow flex-col items-center justify-center">
              {children}
            </div>
          </main>
          <footer className="flex w-full items-center justify-between border-t bg-white py-2">
            <AnimateControl />
            <Addresses />
            <ClientSwitcher />
          </footer>
        </div>
      </AppProvider>
    </ccc.Provider>
  );
}
