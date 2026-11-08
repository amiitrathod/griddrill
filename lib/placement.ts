export type PlacementQuestion = { id: string; prompt: string; choices: string[]; correct: number; code?: boolean };

/** 8 quick questions, two per tier. Both right in a tier moves the starting module up one step. */
export const PLACEMENT: PlacementQuestion[] = [
  { id: "p1", prompt: "Which cell sits in column C, row 4?", choices: ["C4", "4C", "D3", "C-4"], correct: 0 },
  { id: "p2", prompt: "You type 250 and it lines up on the left of the cell, like text. What is the most likely reason?", choices: ["It is stored as text, not a number", "The column is too narrow", "It is a formula", "It is bold"], correct: 0 },
  { id: "p3", prompt: "B2:B5 holds four sales figures. Which formula gives their total?", choices: ["=SUM(B2:B5)", "=ADD(B2:B5)", "=B2:B5", "=TOTAL(B2,B5)"], correct: 0, code: true },
  { id: "p4", prompt: "What does =AVERAGE(10,20,60) show?", choices: ["30", "45", "90", "20"], correct: 0, code: true },
  { id: "p5", prompt: "C2 holds =A2*B1. You copy C2 down to C3. What does C3 hold?", choices: ["=A3*B2", "=A2*B1", "=A3*B1", "=A2*B2"], correct: 0, code: true },
  { id: "p6", prompt: "Which formula keeps the tax rate in B1 fixed when it is copied down?", choices: ["=A4*$B$1", "=A4*B1", "=$A4*B1", "=A4*B$2"], correct: 0, code: true },
  { id: "p7", prompt: "What does =IF(5>3,\"Yes\",\"No\") show?", choices: ["Yes", "No", "TRUE", "#NAME?"], correct: 0, code: true },
  { id: "p8", prompt: "In =VLOOKUP(E2,A2:C5,3,FALSE), what does the 3 mean?", choices: ["Return the value from the 3rd column of the table", "Look in row 3", "Return the 3rd match found", "Round to 3 decimals"], correct: 0 },
];

/** Starting module (1 to 5): one more than the number of tiers answered fully right, counted from the start. */
export function startModuleFor(correct: boolean[]): number {
  let m = 1;
  for (let t = 0; t < 4; t++) {
    if (correct[t * 2] && correct[t * 2 + 1]) m++;
    else break;
  }
  return Math.min(5, m);
}

/** Shuffle the choices without changing which one is right, using a seed so a refresh shows the same order. */
export function shuffled(q: PlacementQuestion, seed: number): { choices: string[]; correct: number } {
  const order = q.choices.map((_, i) => i);
  let s = seed + q.id.charCodeAt(1) * 31;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { choices: order.map((i) => q.choices[i]), correct: order.indexOf(q.correct) };
}
