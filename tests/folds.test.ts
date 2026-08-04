import { describe, expect, it } from "vitest";
import { linesForRules, parseFoldCandidates, rulesForFoldedLines } from "../src/folds";

const note = `---
title: Example
---
# Project
## Details
Text
- Tasks
  - First
  - Later
    - Nested
## Details
\`\`\`md
### Not a heading
- Not a list
\`\`\`
`;

describe("fold selectors", () => {
  it("derives heading paths, list paths, and occurrences", () => {
    expect(parseFoldCandidates(note)).toEqual([
      { line: 3, rule: { type: "heading", path: ["Project"] } },
      { line: 4, rule: { type: "heading", path: ["Project", "Details"] } },
      { line: 6, rule: { type: "list", under: ["Project", "Details"], path: ["Tasks"] } },
      { line: 7, rule: { type: "list", under: ["Project", "Details"], path: ["Tasks", "First"] } },
      { line: 8, rule: { type: "list", under: ["Project", "Details"], path: ["Tasks", "Later"] } },
      { line: 9, rule: { type: "list", under: ["Project", "Details"], path: ["Tasks", "Later", "Nested"] } },
      { line: 10, rule: { type: "heading", path: ["Project", "Details"], occurrence: 2 } }
    ]);
  });

  it("round-trips folded lines through selectors", () => {
    const rules = rulesForFoldedLines(note, new Set([4, 6, 8, 10]));
    expect(linesForRules(note, rules)).toEqual([4, 6, 8, 10]);
  });

  it("keeps selectors stable when unrelated lines are inserted", () => {
    const rules = rulesForFoldedLines(note, new Set([8, 10]));
    const edited = note.replace("Text\n", "Text\nAnother paragraph\n");
    expect(linesForRules(edited, rules)).toEqual([9, 11]);
  });
});
