export interface RenderElement<P = unknown, S = object, T = string> {
  type: T;
  props: P & {
    children: string | RenderElement | RenderElement[];
    style: S;
  };
  key: string | null;
}
