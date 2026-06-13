/** One entry per bill — keeps the most recent roll call when a bill appears multiple times. */
export function dedupeVotesByBill<T extends { billId: string; votedAt: string }>(
  records: T[],
): T[] {
  const byBill = new Map<string, T>();

  for (const record of records) {
    const existing = byBill.get(record.billId);
    if (!existing || record.votedAt > existing.votedAt) {
      byBill.set(record.billId, record);
    }
  }

  return [...byBill.values()].sort((a, b) => b.votedAt.localeCompare(a.votedAt));
}
