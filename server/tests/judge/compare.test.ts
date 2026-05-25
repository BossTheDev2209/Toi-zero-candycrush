import { describe, expect, test } from "bun:test";
import { compareOutputs } from "../../src/judge/compare";

describe("compareOutputs", () => {
  test("exact match", () => {
    expect(compareOutputs("3\n", "3\n").ok).toBe(true);
  });
  test("trailing whitespace ignored", () => {
    expect(compareOutputs("3 \n", "3\n").ok).toBe(true);
    expect(compareOutputs("3\n\n\n", "3").ok).toBe(true);
  });
  test("intermediate whitespace matters", () => {
    expect(compareOutputs("1 2\n", "12\n").ok).toBe(false);
  });
  test("blank lines in middle still compared", () => {
    expect(compareOutputs("a\n\nb\n", "a\nb\n").ok).toBe(false);
  });
  test("returns a diff line on mismatch", () => {
    const r = compareOutputs("3\n", "4\n");
    expect(r.ok).toBe(false);
    expect(r.diff).toContain("3");
    expect(r.diff).toContain("4");
  });
});
