export type HeadingFoldRule = {
  type: "heading";
  path: string[];
  occurrence?: number;
  persist?: boolean;
};

export type ListFoldRule = {
  type: "list";
  path: string[];
  under?: string[];
  occurrence?: number;
  persist?: boolean;
};

export type FoldRule = HeadingFoldRule | ListFoldRule;

export type FoldCandidate = {
  line: number;
  rule: FoldRule;
};

const headingPattern = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const listPattern = /^(\s*)(?:[-+*]|\d+[.)])\s+(.+)$/;

function cleanText(value: string): string {
  return value
    .replace(/\s+\^[A-Za-z0-9-]+\s*$/, "")
    .replace(/^\[[ xX-]\]\s+/, "")
    .replace(/\s+%%\s*fold\s*%%\s*$/, "")
    .trim();
}

function suffixMatches(left: string[], right: string[]): boolean {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.every((value, index) => value === longer[longer.length - shorter.length + index]);
}

export function sameRuleIdentity(left: FoldRule, right: FoldRule): boolean {
  if (left.type !== right.type || !suffixMatches(left.path, right.path)) return false;
  if (left.type === "heading" || right.type === "heading") return true;
  if (left.under === undefined || right.under === undefined) return true;
  return suffixMatches(left.under, right.under);
}

export function normalizeRule(value: unknown): FoldRule | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const persist = record.persist === true ? true : undefined;
  if (typeof record.heading === "string") {
    return { type: "heading", path: [record.heading], persist };
  }
  if (typeof record.list === "string") {
    const under = typeof record.under === "string" ? [record.under] : undefined;
    return { type: "list", path: [record.list], under, persist };
  }
  if (record.type !== "heading" && record.type !== "list") return null;
  if (!Array.isArray(record.path) || !record.path.every((item) => typeof item === "string")) return null;

  const occurrence = typeof record.occurrence === "number" && Number.isInteger(record.occurrence) && record.occurrence > 1
    ? record.occurrence
    : undefined;
  if (record.type === "heading") return { type: "heading", path: record.path, occurrence, persist };
  const under = Array.isArray(record.under) && record.under.every((item) => typeof item === "string")
    ? record.under
    : undefined;
  return { type: "list", path: record.path, under, occurrence, persist };
}

export function serializeRules(markdown: string, rules: readonly FoldRule[]): Array<Record<string, unknown>> {
  const candidates = parseFoldCandidates(markdown);
  return rules.map((rule) => {
    const leaf = rule.path[rule.path.length - 1];
    const matches = candidates.filter((candidate) =>
      candidate.rule.type === rule.type
      && candidate.rule.path[candidate.rule.path.length - 1] === leaf
    );
    const persist = rule.persist ? { persist: true } : {};
    if (matches.length === 1) {
      return rule.type === "heading" ? { heading: leaf, ...persist } : { list: leaf, ...persist };
    }
    return rule.type === "heading"
      ? { type: "heading", path: rule.path, occurrence: rule.occurrence, ...persist }
      : { type: "list", under: rule.under, path: rule.path, occurrence: rule.occurrence, ...persist };
  });
}

export function parseFoldCandidates(markdown: string): FoldCandidate[] {
  const lines = markdown.split(/\r?\n/);
  const headings: string[] = [];
  const listStack: Array<{ indent: number; text: string }> = [];
  const candidates: FoldCandidate[] = [];
  const inFrontmatter = lines[0]?.trim() === "---";
  let frontmatterOpen = inFrontmatter;
  let fence: string | null = null;

  for (let line = 0; line < lines.length; line += 1) {
    const source = lines[line];
    if (line === 0 && frontmatterOpen) continue;
    if (frontmatterOpen) {
      if (source.trim() === "---") frontmatterOpen = false;
      continue;
    }

    const fenceMatch = source.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const heading = source.match(headingPattern);
    if (heading) {
      const level = heading[1].length;
      headings.length = level - 1;
      headings[level - 1] = cleanText(heading[2]);
      listStack.length = 0;
      candidates.push({ line, rule: { type: "heading", path: headings.filter(Boolean) } });
      continue;
    }

    const list = source.match(listPattern);
    if (list) {
      const indent = list[1].replace(/\t/g, "    ").length;
      while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) listStack.pop();
      listStack.push({ indent, text: cleanText(list[2]) });
      candidates.push({
        line,
        rule: {
          type: "list",
          under: headings.filter(Boolean),
          path: listStack.map((item) => item.text)
        }
      });
      continue;
    }

    if (source.trim() !== "") listStack.length = 0;
  }

  const seen: FoldRule[] = [];
  return candidates.map((candidate) => {
    const occurrence = seen.filter((rule) => sameRuleIdentity(rule, candidate.rule)).length + 1;
    seen.push(candidate.rule);
    return occurrence === 1 ? candidate : { ...candidate, rule: { ...candidate.rule, occurrence } };
  });
}

export function rulesForFoldedLines(markdown: string, foldedLines: ReadonlySet<number>): FoldRule[] {
  return parseFoldCandidates(markdown)
    .filter((candidate) => foldedLines.has(candidate.line))
    .map((candidate) => candidate.rule);
}

export function rulesForSync(
  markdown: string,
  foldedLines: ReadonlySet<number>,
  existingRules: readonly FoldRule[]
): FoldRule[] {
  return parseFoldCandidates(markdown)
    .map((candidate) => {
      const existing = existingRules.find((rule) =>
        sameRuleIdentity(rule, candidate.rule)
        && (rule.occurrence ?? 1) === (candidate.rule.occurrence ?? 1)
      );
      if (!foldedLines.has(candidate.line) && !existing?.persist) return null;
      return existing?.persist ? { ...candidate.rule, persist: true } : candidate.rule;
    })
    .filter((rule): rule is FoldRule => rule !== null);
}

export function linesForRules(markdown: string, rules: readonly FoldRule[]): number[] {
  const candidates = parseFoldCandidates(markdown);
  return candidates
    .filter((candidate) => rules.some((rule) => {
      if (!sameRuleIdentity(rule, candidate.rule)) return false;
      return (rule.occurrence ?? 1) === (candidate.rule.occurrence ?? 1);
    }))
    .map((candidate) => candidate.line);
}
