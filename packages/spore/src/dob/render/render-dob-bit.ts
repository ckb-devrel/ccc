import satori from "satori";
import SpaceGroteskBoldBase64 from "./fonts/SpaceGrotesk-Bold.base64";
import { traitsParser } from "./traits-parser";
import type { DobDecodeResult, RenderPartialOutput } from "./types";
import { base64ToArrayBuffer } from "./utils/string";

const iconBase64 =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwMCIgaGVpZ2h0PSIxMDAwIiB2aWV3Qm94PSIwIDAgMTAwMCAxMDAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZyBjbGlwLXBhdGg9InVybCgjY2xpcDBfNTA0XzI4OCkiPgo8cmVjdCB3aWR0aD0iMTAwMCIgaGVpZ2h0PSIxMDAwIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTAwMCAwSDBWMTAwMEgxMDAwVjBaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNTAwIDY0NS42NjlDNjE1LjE1NyA2NDUuNjY5IDcwOC42NjEgNTUyLjE2NSA3MDguNjYxIDQzNy4wMDhDNzA4LjY2MSAzOTAuMDkyIDY5My4yNDIgMzQ2Ljc4NSA2NjYuOTk1IDMxMi4wMDhDNjkyLjI1NyAyOTIuNjUxIDcwOC42NjEgMjYyLjQ2NyA3MDguNjYxIDIyOC4zNDZINTAwQzM4NC44NDMgMjI4LjM0NiAyOTEuMzM5IDMyMS44NSAyOTEuMzM5IDQzNy4wMDhDMjkxLjMzOSA1NTEuODM3IDM4NS4xNzEgNjQ1LjY2OSA1MDAgNjQ1LjY2OVpNNTAwIDMyMy44MTlDNTYyLjMzNiAzMjMuODE5IDYxMy4xODkgMzc0LjY3MiA2MTMuMTg5IDQzNy4wMDhDNjEzLjE4OSA0OTkuMzQ0IDU2Mi4zMzYgNTUwLjE5NyA1MDAgNTUwLjE5N0M0MzcuNjY0IDU1MC4xOTcgMzg2LjgxMSA0OTkuMzQ0IDM4Ni44MTEgNDM3LjAwOEMzODYuODExIDM3NC42NzIgNDM3LjY2NCAzMjMuODE5IDUwMCAzMjMuODE5WiIgZmlsbD0iIzAwREY5QiIvPgo8cGF0aCBkPSJNNTAwIDgxMS4zNTJDNDA0LjE5OSA4MTEuMzUyIDMwOC4zOTkgNzc0LjkzNCAyMzUuMjM2IDcwMS43NzJDMjQ2LjcxOSA2NzEuNTg4IDI3MS45ODIgNjQ2LjY1NCAzMDUuNzc0IDYzNy4xMzlDMzU5LjkwOCA2ODkuNjMzIDQyOS43OSA3MTUuODc5IDUwMCA3MTUuODc5QzU3MC4yMSA3MTUuODc5IDY0MC4wOTIgNjg5LjYzMyA2OTQuMjI2IDYzNy4xMzlDNzI4LjAxOCA2NDYuNjU0IDc1My4yODEgNjcxLjI2IDc2NC43NjQgNzAxLjc3MkM2OTEuOTI5IDc3NC42MDYgNTk1LjgwMSA4MTEuMzUyIDUwMCA4MTEuMzUyWiIgZmlsbD0iIzI0NzFGRSIvPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzUwNF8yODgiPgo8cmVjdCB3aWR0aD0iMTAwMCIgaGVpZ2h0PSIxMDAwIiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo=";

export function renderDobBit(
  dob0Data: DobDecodeResult | string,
  _props?: {
    outputType?: "svg";
  },
) {
  if (typeof dob0Data === "string") {
    dob0Data = JSON.parse(dob0Data) as DobDecodeResult;
  }
  if (typeof dob0Data.render_output === "string") {
    dob0Data.render_output = JSON.parse(
      dob0Data.render_output,
    ) as RenderPartialOutput[];
  }
  const { traits } = traitsParser(dob0Data.render_output);
  const account =
    traits.find((trait) => trait.name === "Account")?.value ?? "-";
  let fontSize = 76;
  if (typeof account === "string") {
    if (account.length > 10) {
      fontSize = fontSize / 2;
    }
    if (account.length > 20) {
      fontSize = fontSize / 2;
    }
    if (account.length > 30) {
      fontSize = fontSize * 0.75;
    }
  }
  const spaceGroteskBoldFont = base64ToArrayBuffer(SpaceGroteskBoldBase64);
  return satori(
    {
      key: "container",
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "500px",
          background: "#3A3A43",
          color: "#fff",
          height: "500px",
          textAlign: "center",
        },
        children: [
          {
            type: "img",
            props: {
              src: iconBase64,
              width: 100,
              height: 100,
              style: {
                width: "100px",
                height: "100px",
                borderRadius: "100%",
                marginBottom: "40px",
              },
            },
          },
          {
            type: "div",
            props: {
              children: account,
              style: {
                marginBottom: "20px",
                fontSize: `${fontSize}px`,
                textAlign: "center",
              },
            },
          },
          {
            type: "div",
            props: {
              children: ".bit",
              style: {
                fontSize: "44px",
                padding: "4px 40px",
                borderRadius: "200px",
                background: "rgba(255, 255, 255, 0.10)",
              },
            },
          },
        ],
      },
    },
    {
      width: 500,
      height: 500,
      fonts: [
        {
          name: "SpaceGrotesk",
          data: spaceGroteskBoldFont,
          weight: 700,
        },
      ],
    },
  );
}
