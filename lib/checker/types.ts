import type { NumberFormat, RawGrid } from "../grid/engine";

export type Val = string | number | boolean;

export type Check =
  | { type: "formula"; expectValue: Val; mustUse?: string[]; alsoCheck?: Record<string, Val>; exactText?: boolean }
  | { type: "fix"; expectValue: Val; mustUse?: string[]; alsoCheck?: Record<string, Val>; exactText?: boolean }
  | { type: "range"; expect: Record<string, Val>; exactText?: boolean }
  | { type: "format"; expectFormat?: NumberFormat; expectBold?: boolean; expectValue?: Val }
  | { type: "select"; range: string }
  | { type: "shortcut"; combo: string }
  | { type: "quick"; choices: string[]; correct: number };

export type Lesson = {
  id: string;
  module: string;
  title: string;
  minutes: number;
  teach: string;
  /** A worked example the learner watches. Optional text shown under the idea. */
  example?: string;
  grid: RawGrid;
  task: string;
  target: string;
  check: Check;
  hints: string[];
  explainRules: string[];
  accepted: string[];
  xp: number;
  /** Authoring tests. Overlays are cell edits applied on top of `grid`. */
  tests: { correct: Overlay[]; wrong: Overlay[] };
  /** Notes where the simulation differs from real Excel (principle 9). */
  limit?: string;
  /** Functions this lesson teaches, used by the Formula Notebook. */
  functions?: string[];
};

export type Overlay = Record<string, string | number>;

export type LearnerState = {
  raw: RawGrid;
  formats?: Record<string, NumberFormat>;
  bolds?: string[];
  selection?: string; // "A1:B3" or "A1"
  shortcut?: string; // normalized combo the learner pressed
  choice?: number;
};

export type Explanation = { rule: string; message: string; cells: string[] };

export type CheckResult = {
  ok: boolean;
  expected: string;
  found: string;
  message: string;
  explanation?: Explanation;
  /** Extra results shown when a second cell differs (rule 3). */
  extra?: { cell: string; expected: string; found: string }[];
};
