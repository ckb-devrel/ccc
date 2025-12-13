import { ccc } from "@ckb-ccc/connector-react";
import React, { useMemo } from "react";

const TAN_22_5 = Math.tan(Math.PI / 8);
const SQRT_2 = Math.sqrt(2);

export function TrigramLine({
  x = 0,
  y = 0,
  width,
  height,
  isBroken,
  dim = 0.4,
  fill,
  transform,
}: {
  x?: number;
  y?: number;
  width: number;
  height: number;
  dim?: number;
  fill?: string;
  transform?: string;
  isBroken?: boolean;
}) {
  const gap = width * 0.236; // 2 * 0.618 - 1
  const decoWidth = height * TAN_22_5;
  const brokenWidth = (width - gap) / 2;

  const animate = useMemo(() => {
    /* eslint-disable react-hooks/purity */
    const percentage = Math.random() * 0.2 + 0.05;
    return (
      <animate
        attributeName="opacity"
        values={`${dim};1;${dim};${dim}`}
        keyTimes={`0;${percentage / 2};${percentage};1`}
        dur={`${Math.random() * 2 + 2}s`}
        begin={`${Math.random() * 3}s`}
        repeatCount="indefinite"
      />
    );
    /* eslint-enable react-hooks/purity */
  }, [dim]);

  return isBroken ? (
    <>
      <path
        d={`M ${x} ${y} l ${brokenWidth} 0 l 0 ${height} l -${brokenWidth - decoWidth} 0 Z`}
        opacity={dim}
        fill={fill}
        transform={transform}
      >
        {animate}
      </path>
      <path
        d={`M ${x + brokenWidth + gap} ${y} l ${brokenWidth} 0 l -${decoWidth} ${height} l -${brokenWidth - decoWidth} 0 Z`}
        opacity={dim}
        fill={fill}
        transform={transform}
      >
        {animate}
      </path>
    </>
  ) : (
    <path
      d={`M ${x} ${y} l ${width} 0 l -${decoWidth} ${height} l -${width - 2 * decoWidth} 0 Z`}
      opacity={dim}
      fill={fill}
      transform={transform}
    >
      {animate}
    </path>
  );
}

export function Trigram(props: {
  value: ccc.NumLike;
  x?: number;
  y?: number;
  width: number;
  thickness: number;
  padding: number;
  dim?: number;
  stroke?: string;
  transform?: string;
}) {
  const {
    x = 0,
    y = 0,
    width,
    thickness,
    padding,
    dim,
    stroke,
    transform,
  } = props;
  const value = ccc.numFrom(props.value);
  const topDiff = thickness + padding;
  const leftDiff = topDiff * TAN_22_5;

  return (
    <>
      {[
        [x, y, width],
        [leftDiff + x, topDiff + y, width - 2 * leftDiff],
        [leftDiff * 2 + x, topDiff * 2 + y, width - 4 * leftDiff],
      ].map(([x, y, width], i) => (
        <TrigramLine
          key={i}
          x={x}
          y={y}
          width={width}
          height={thickness}
          dim={dim}
          fill={stroke}
          transform={transform}
          isBroken={(value & ccc.numFrom(1 << i)) !== ccc.Zero}
        />
      ))}
    </>
  );
}

export function Bagua({
  value: valueLike,
  thickness,
  padding,
  margin,
  space,
  dim,
  stroke,
  fill,
  ...props
}: {
  value: ccc.NumLike;
  thickness: number;
  padding: number;
  margin: number;
  space: number;
  dim?: number;
} & React.ComponentPropsWithRef<"svg">) {
  const value = ccc.numFrom(valueLike);

  const width = ((50 - margin - SQRT_2 * space) * 2) / (1 + SQRT_2);
  const x = (100 - width) / 2;

  const fillLength = 100 / (1 + SQRT_2);
  const fillWidth = (fillLength * SQRT_2) / 2;

  return (
    <svg {...props} viewBox="0 0 100 100">
      <path
        d={`M ${(100 - fillLength) / 2} 0
            l ${fillLength} 0
            l ${fillWidth} ${fillWidth}
            l 0 ${fillLength}
            l -${fillWidth} ${fillWidth}
            l -${fillLength} 0
            l -${fillWidth} -${fillWidth}
            l 0 -${fillLength}
            Z`}
        fill={fill}
      />
      {Array.from(new Array(8), (_, i) => (
        <Trigram
          key={i}
          value={(value & ccc.numFrom(7 << (i * 3))) >> ccc.numFrom(i * 3)}
          x={x}
          y={margin}
          width={width}
          thickness={thickness}
          padding={padding}
          stroke={stroke}
          dim={dim}
          transform={`rotate(${i * 45} 50 50)`}
        />
      ))}
    </svg>
  );
}

export function Taiji({
  yangColor,
  yinColor = "#ffffff40",
  ...props
}: {
  yangColor: string;
  yinColor?: string;
} & React.ComponentPropsWithRef<"div">) {
  return (
    <div
      {...props}
      style={{
        backgroundColor: yangColor,
        ...(props.style ?? {}),
      }}
    >
      <div
        className="absolute right-1/2"
        style={{
          width: "25%",
          height: "50%",
          borderTopLeftRadius: "100vw",
          borderBottomLeftRadius: "100vw",
          backgroundColor: yinColor,
        }}
      ></div>
      <div
        className="absolute left-1/2"
        style={{
          width: "50%",
          height: "100%",
          backgroundColor: yinColor,
        }}
      ></div>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: "50%",
          height: "50%",
          backgroundColor: yangColor,
        }}
      ></div>
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "20%",
          height: "20%",
          backgroundColor: yangColor,
        }}
      ></div>
      <div
        className="absolute top-3/4 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "20%",
          height: "20%",
          backgroundColor: yinColor,
        }}
      ></div>
      {props.children}
    </div>
  );
}
