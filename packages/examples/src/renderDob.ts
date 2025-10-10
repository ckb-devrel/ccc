import { spore } from "@ckb-ccc/ccc";

const sporeId =
  "dc19e68af1793924845e2a4dbc23598ed919dcfe44d3f9cd90964fe590efb0e4";

const dobRender = await spore.dob.renderByTokenKey(sporeId);
console.log(dobRender);
