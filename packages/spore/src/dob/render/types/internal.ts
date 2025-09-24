export interface RenderElement<P = unknown, S = object, T = string> {
  type: T;
  props: P & {
    children: RenderElement | RenderElement[];
    style: S;
  };
  key: string | null;
}
