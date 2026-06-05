export interface VoteRow {
  post_id: string;
  user_id: string;
  value: number;
}

export function aggregateVotes(
  votes: VoteRow[],
  currentUserId: string | null,
): Map<string, { score: number; userVote: -1 | 1 | null }> {
  const map = new Map<string, { score: number; userVote: -1 | 1 | null }>();

  for (const v of votes) {
    const entry = map.get(v.post_id) ?? { score: 0, userVote: null };
    entry.score += v.value;
    if (currentUserId && v.user_id === currentUserId) {
      entry.userVote = v.value === 1 ? 1 : -1;
    }
    map.set(v.post_id, entry);
  }

  return map;
}
