export interface RenderElement<
  P = Record<string, unknown>,
  S = Record<string, unknown>,
  T = string,
> {
  type: T;
  props: P & {
    children:
      | RenderElement
      | RenderElement[]
      | string
      | (RenderElement | string)[];
    style: S;
  };
  key: string | null;
}
