import satori from "satori";
import { type INode, stringify } from "svgson";
import { FONTS } from "../../config/fonts.js";
import { RENDER_CONSTANTS } from "../../types/constants.js";
import { base64ToArrayBuffer } from "../../utils/string.js";
import { svgToBase64 } from "../../utils/svg.js";

export async function renderDob1Svg(nodePromise: Promise<INode>) {
  const node = await nodePromise;
  const str = stringify(node);
  const base64 = await svgToBase64(str);
  const spaceGroteskBoldFont = base64ToArrayBuffer(FONTS.SpaceGroteskBold);
  const width =
    parseInt(node.attributes.width, 10) || RENDER_CONSTANTS.CANVAS_WIDTH;
  const height =
    parseInt(node.attributes.height, 10) || RENDER_CONSTANTS.CANVAS_HEIGHT;

  return satori(
    {
      key: "container",
      type: "div",
      props: {
        style: {
          display: "flex",
          width: `${width}px`,
          height: `${height}px`,
        },
        children: [
          {
            type: "img",
            props: {
              src: base64,
              width,
              height,
              style: {
                width: `${width}px`,
                height: `${height}px`,
              },
            },
          },
        ],
      },
    },
    {
      width,
      height,
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
