import { expect, it } from "vitest";
import {
  isOutputInspectionTarget,
  shouldResumeFollowing,
} from "../src/app/hooks/useFollowOutput";
it.each([
  [false, true, 100, 200, 0, true],
  [false, true, 100, 200, 1.5, true],
  [false, true, 100, 200, 10, false],
  [false, true, 200, 100, 0, false],
  [false, false, 100, 200, 0, false],
  [false, true, 200, 200, 0, false],
  [true, false, 100, 200, 0, false],
])(
  "resumes only deliberate downward movement to the bottom (%s/%s)",
  (following, user, previous, top, remaining, expected) => {
    expect(
      shouldResumeFollowing(
        following as boolean,
        user as boolean,
        previous as number,
        top as number,
        remaining as number,
      ),
    ).toBe(expected);
  },
);

it.each([
  ["button[data-output-inspect]", true],
  ["summary", true],
  ["button[role=separator]", false],
  ["button[role=tab]", false],
  ["a", false],
])(
  "only explicit inspection controls pause follow: %s",
  (selector, expected) => {
    const target = {
      closest: (query: string) =>
        query.split(", ").includes(selector as string) ? ({} as Element) : null,
    };
    expect(isOutputInspectionTarget(target)).toBe(expected);
  },
);
