import { Component, ReactNode, RefObject, createRef } from "react";
import { APP_CONTEXT } from "../context";

export type RandomWalkProps = React.ComponentPropsWithoutRef<"div"> & {
  x?: number;
  y?: number;
  stopped?: boolean;
};

export class RandomWalk extends Component<RandomWalkProps> {
  static contextType = APP_CONTEXT;
  context: React.ContextType<typeof APP_CONTEXT>;

  // position, speed, force
  physics: number[] = [0, 0, 0, 0, 0, 0];
  ref: RefObject<HTMLDivElement> = createRef();
  interval: ReturnType<typeof setInterval> | undefined = undefined;

  x: number = 0;
  y: number = 0;

  startLoop() {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      if (!this.ref.current) {
        return;
      }

      const randomAngle = Math.random() * 2 * Math.PI;
      const rx = Math.cos(randomAngle) * 0.04;
      const ry = Math.sin(randomAngle) * 0.04;

      const physics = this.physics;
      const [x, y, vx, vy, fx, fy] = physics;

      const dx = (this.props.x ?? this.x) - x;
      const dy = (this.props.y ?? this.y) - y;

      const fSquare = fx * fx + fy * fy;
      if (fSquare > 0.64) {
        const f = Math.sqrt(fSquare);
        physics[4] *= 0.8 / f;
        physics[5] *= 0.8 / f;
      }

      physics[0] += vx * 0.08;
      physics[1] += vy * 0.08;
      physics[2] = vx * 0.8 + fx + dx * 0.08;
      physics[3] = vy * 0.8 + fy + dy * 0.08;
      physics[4] += rx;
      physics[5] += ry;

      this.ref.current.style.transform = `translate(${x}px, ${y}px)`;
    }, 16);
  }

  stopLoop() {
    clearInterval(this.interval);
    this.interval = undefined;
  }

  componentDidMount(): void {
    this.startLoop();
  }

  componentWillUnmount(): void {
    this.stopLoop();
  }

  componentDidUpdate(): void {
    if (this.context?.enabledAnimate) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  render(): ReactNode {
    return (
      <div {...this.props} ref={this.ref}>
        {this.props.children}
      </div>
    );
  }
}
