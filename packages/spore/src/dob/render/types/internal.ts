export interface RenderElement<P = any, S = object, T = string> {
  type: T;
  props: P & {
    children: RenderElement | RenderElement[];
    style: S;
  };
  key: string | null;
}
