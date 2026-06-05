/** Current Congress session for member lookups (119th = 2025–2027). */
export function getCurrentCongress(): number {
  const parsed = Number(process.env.CONGRESS_NUMBER ?? "119");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 119;
}
