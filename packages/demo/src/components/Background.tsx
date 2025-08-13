/* eslint-disable @next/next/no-img-element */

import { Component, createRef, ReactNode, RefObject } from "react";
import { APP_CONTEXT } from "../context";
import { RandomWalk } from "./RandomWalk";

export class Background extends Component {
  static contextType = APP_CONTEXT;
  context: React.ContextType<typeof APP_CONTEXT>;

  refBg: RefObject<HTMLDivElement> = createRef();
  ref0: RefObject<RandomWalk> = createRef();
  ref1: RefObject<RandomWalk> = createRef();
  ref2: RefObject<RandomWalk> = createRef();

  handler = (e: MouseEvent) => {
    if (
      !this.refBg.current ||
      !this.ref0.current ||
      !this.ref1.current ||
      !this.ref2.current
    ) {
      return;
    }

    const { clientX: x, clientY: y } = e;
    const dx = x - this.refBg.current.clientWidth / 2;
    const dy = y - this.refBg.current.clientHeight / 2;

    this.ref0.current.x = dx * 0.2;
    this.ref0.current.y = dy * 0.2;
    this.ref1.current.x = dx * 0.08;
    this.ref1.current.y = dy * 0.08;
    this.ref2.current.x = dx * 0.03;
    this.ref2.current.y = dy * 0.03;
  };

  componentDidMount(): void {
    document.removeEventListener("mousemove", this.handler);
    document.addEventListener("mousemove", this.handler);
  }

  componentWillUnmount(): void {
    document.removeEventListener("mousemove", this.handler);
  }

  render(): ReactNode {
    return (
      <>
        <div
          className="fixed left-0 top-0 h-full w-full select-none bg-white"
          ref={this.refBg}
          style={{ zIndex: this.context?.backgroundLifted ? 40 : -100 }}
        >
          <div className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]">
            <RandomWalk ref={this.ref0} className="flex flex-col items-center">
              <div className="relative">
                <img
                  style={{
                    width: "min(60vw, 60vh)",
                    maxWidth: "none",
                  }}
                  src="/background/0.svg"
                  alt=""
                />
                <div className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]">
                  <RandomWalk ref={this.ref1}>
                    <img
                      style={{
                        width: "min(60vw, 60vh)",
                        maxWidth: "none",
                      }}
                      src="/background/1.svg"
                      alt=""
                    />
                    <div className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]">
                      <RandomWalk ref={this.ref2}>
                        <img
                          style={{
                            width: "min(60vw, 60vh)",
                            maxWidth: "none",
                          }}
                          src="/background/2.svg"
                          alt=""
                        />
                      </RandomWalk>
                    </div>
                  </RandomWalk>
                </div>
              </div>
              <div className="flex">
                {"CCC".split("").map((c, i) => (
                  <RandomWalk
                    x={0}
                    y={0}
                    className="mx-2 mt-6 text-7xl font-bold"
                    key={i}
                  >
                    {c}
                  </RandomWalk>
                ))}
              </div>
            </RandomWalk>
          </div>
          {this.context?.backgroundLifted ? undefined : (
            <div className="absolute left-0 top-0 h-full w-full bg-white opacity-70"></div>
          )}
        </div>
      </>
    );
  }
}
