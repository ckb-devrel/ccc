import { ccc } from "@ckb-ccc/connector-react";

const TAN_22_5 = Math.tan(Math.PI / 8);
const SQRT_2 = Math.sqrt(2);

export function TrigramLine({
  x = 0,
  y = 0,
  width,
  height,
  gap,
  isBroken,
  fill,
  transform,
}: {
  x?: number;
  y?: number;
  width: number;
  height: number;
  gap: number;
  fill?: string;
  transform?: string;
  isBroken?: boolean;
}) {
  const decoWidth = height * TAN_22_5;
  const brokenWidth = (width - gap) / 2;

  return isBroken ? (
    <>
      <path
        d={`M ${x} ${y} l ${brokenWidth} 0 l 0 ${height} l -${brokenWidth - decoWidth} 0 Z`}
        fill={fill}
        transform={transform}
      />
      <path
        d={`M ${x + brokenWidth + gap} ${y} l ${brokenWidth} 0 l -${decoWidth} ${height} l -${brokenWidth - decoWidth} 0 Z`}
        fill={fill}
        transform={transform}
      />
    </>
  ) : (
    <path
      d={`M ${x} ${y} l ${width} 0 l -${decoWidth} ${height} l -${width - 2 * decoWidth} 0 Z`}
      fill={fill}
      transform={transform}
    />
  );
}

export function Trigram(props: {
  value: ccc.NumLike;
  x?: number;
  y?: number;
  width: number;
  thickness: number;
  gap: number;
  padding: number;
  stroke?: string;
  transform?: string;
}) {
  const {
    x = 0,
    y = 0,
    width,
    thickness,
    gap,
    padding,
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
          gap={gap}
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
  gap,
  padding,
  margin,
  space,
  stroke,
  fill,
  ...props
}: {
  value: ccc.NumLike;
  thickness: number;
  gap: number;
  padding: number;
  margin: number;
  space: number;
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
          gap={gap}
          padding={padding}
          stroke={stroke}
          transform={`rotate(${i * 45} 50 50)`}
        />
      ))}
    </svg>
  );
}
