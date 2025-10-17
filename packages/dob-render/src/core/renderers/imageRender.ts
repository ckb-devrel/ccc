import satori from "satori";
import { Key } from "../../config/constants.js";
import { RENDER_CONSTANTS } from "../../types/constants.js";
import type { ParsedTrait } from "../../types/core.js";
import type { QueryOptions } from "../../types/query.js";
import { processFileServerResult } from "../../utils/mime.js";
import { isBtcFs, isCkbFs, isIpfs, isUrl } from "../../utils/string.js";
import { backgroundColorParser } from "../parsers/backgroundColorParser.js";

export async function renderImageSvg(
  traits: ParsedTrait[],
  options?: QueryOptions,
): Promise<string> {
  const prevBg = traits.find((trait) => trait.name === String(Key.Bg));
  const bgColor = backgroundColorParser(traits, { defaultColor: "#FFFFFF00" });

  let bgImage = "";
  if (prevBg?.value && typeof prevBg.value === "string") {
    if (isBtcFs(prevBg.value)) {
      if (options?.queryBtcFsFn) {
        const btcFsResult = await options.queryBtcFsFn(prevBg.value);
        bgImage = processFileServerResult(btcFsResult);
      }
    } else if (isIpfs(prevBg.value)) {
      if (options?.queryIpfsFn) {
        const ipfsFsResult = await options.queryIpfsFn(prevBg.value);
        bgImage = processFileServerResult(ipfsFsResult);
      }
    } else if (isCkbFs(prevBg.value)) {
      if (options?.queryCkbFsFn) {
        const ckbFsResult = await options.queryCkbFsFn(prevBg.value);
        bgImage = processFileServerResult(ckbFsResult);
      }
    } else if (isUrl(prevBg.value)) {
      bgImage = prevBg.value;
    }
  }

  return satori(
    {
      key: "container",
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "500px",
          background: bgColor,
          color: "#fff",
          height: "500px",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        },
        children: [
          bgImage
            ? {
                key: "bg_image",
                type: "img",
                props: {
                  src: bgImage,
                  style: {
                    objectFit: "contain",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  },
                },
              }
            : null,
        ],
      },
    },
    {
      width: RENDER_CONSTANTS.CANVAS_WIDTH,
      height: RENDER_CONSTANTS.CANVAS_HEIGHT,
      fonts: [],
    },
  );
}
