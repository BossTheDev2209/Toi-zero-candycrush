/**
 * Returns true if every char of `needle` appears in `haystack` in order.
 * Score = lower is better; rewards exact-prefix.
 */
export function fuzzyScore(needle: string, haystack: string): number | null {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (h.startsWith(n)) return 0;
  let hi = 0;
  let score = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return null;
    score += found - hi;
    hi = found + 1;
  }
  return score + (h.length - n.length) * 0.01;
}
