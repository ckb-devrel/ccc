import type { ccc } from "@ckb-ccc/connector-react";
import { Droplets, Search, SquareTerminal } from "lucide-react";
import type { ReactNode } from "react";

export function HeaderLinks({ client }: { client: ccc.Client }) {
  const explorer =
    client.addressPrefix === "ckb"
      ? "https://explorer.nervos.org"
      : "https://pudge.explorer.nervos.org";

  return (
    <nav className="header-links" aria-label="CCC links">
      <HeaderLink href="https://live.ckbccc.com/" label="CCC Live">
        <SquareTerminal />
      </HeaderLink>
      <HeaderLink href="https://github.com/ckb-devrel/ccc" label="GitHub">
        <svg className="github-mark" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 0a8.03 8.03 0 0 0-2.53 15.65c.4.08.55-.17.55-.38l-.01-1.37c-2.23.49-2.7-1.08-2.7-1.08-.36-.93-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.22.83 1.22.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.9-3.64-3.97 0-.88.31-1.6.82-2.16-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.7 7.7 0 0 1 4.01 0c1.52-1.04 2.2-.82 2.2-.82.43 1.1.16 1.92.08 2.12.51.57.82 1.28.82 2.16 0 3.08-1.87 3.76-3.65 3.96.29.25.54.74.54 1.49l-.01 2.2c0 .22.14.47.55.39A8.03 8.03 0 0 0 8 0Z" />
        </svg>
      </HeaderLink>
      <HeaderLink href="https://faucet.nervos.org/" label="CKB Faucet">
        <Droplets />
      </HeaderLink>
      <HeaderLink href="https://www.nervos.org/" label="Nervos Network">
        <svg className="nervos-mark" viewBox="0 0 208 207" aria-hidden="true">
          <path d="M0 0v206.318h53.151V93.897h40.745L0 0Z" />
          <path d="M154.525 0v112.422h-40.744l93.895 93.896V0h-53.151Z" />
        </svg>
      </HeaderLink>
      <HeaderLink href={explorer} label="CKB Explorer">
        <Search />
      </HeaderLink>
    </nav>
  );
}

function HeaderLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <a
      className="header-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
    >
      {children}
    </a>
  );
}
