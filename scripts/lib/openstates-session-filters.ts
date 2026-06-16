/**
 * Open States legislative session identifier matching.
 *
 * States use different naming schemes:
 * - FL: calendar year + letter specials — `2026`, `2026D`
 * - GA: biennium + underscore specials — `2025_26`, `2023_ss`
 * - Others: compact biennium — `20252026`
 */

/** Folder names under data/openstates/{ST}/ that hold a session archive. */
export function isOpenStatesSessionFolderName(name: string): boolean {
  if (/^\d{4}[A-Z]?$/.test(name)) return true;
  if (/^\d{4}_(?:\d{2}|[a-z]+)$/i.test(name)) return true;
  if (/^\d{8}$/.test(name)) return true;
  return false;
}

function isSpecialSessionIdentifier(identifier: string): boolean {
  return /^\d{4}[A-Z]+$/.test(identifier) || /^\d{4}_[a-z]+$/i.test(identifier);
}

function specialSessionYear(identifier: string): number | null {
  const fl = identifier.match(/^(\d{4})[A-Z]+$/);
  if (fl) return Number(fl[1]);
  const ga = identifier.match(/^(\d{4})_[a-z]+$/i);
  if (ga) return Number(ga[1]);
  return null;
}

function bienniumSpan(identifier: string): { start: number; end: number } | null {
  const underscore = identifier.match(/^(\d{4})_(\d{2})$/);
  if (underscore) {
    const start = Number(underscore[1]);
    return { start, end: start + 1 };
  }

  const compact = identifier.match(/^(\d{4})(\d{4})$/);
  if (compact) {
    return { start: Number(compact[1]), end: Number(compact[2]) };
  }

  return null;
}

function isRegularSessionForYear(identifier: string, year: number): boolean {
  if (/^\d{4}$/.test(identifier)) {
    return Number(identifier) === year;
  }

  const span = bienniumSpan(identifier);
  if (span) {
    return year >= span.start && year <= span.end;
  }

  return false;
}

export function sessionMatchesYear(
  identifier: string,
  year: number,
  opts: { includeSpecialSessions?: boolean; regularSessionOnly?: boolean } = {},
): boolean {
  const includeSpecialSessions = opts.includeSpecialSessions ?? false;
  const regularSessionOnly = opts.regularSessionOnly ?? false;

  if (isSpecialSessionIdentifier(identifier)) {
    if (regularSessionOnly) return false;
    const sessionYear = specialSessionYear(identifier);
    return sessionYear === year && includeSpecialSessions;
  }

  if (regularSessionOnly) {
    return isRegularSessionForYear(identifier, year);
  }

  if (/^\d{4}$/.test(identifier)) {
    return Number(identifier) === year;
  }

  const span = bienniumSpan(identifier);
  if (span) {
    return year >= span.start && year <= span.end;
  }

  const yearStr = String(year);
  if (!identifier.startsWith(yearStr)) return false;
  if (!includeSpecialSessions) return identifier === yearStr;
  return true;
}

export interface SessionFilterable {
  identifier: string;
}

export function filterSessions<T extends SessionFilterable>(
  sessions: T[],
  opts: {
    year?: number;
    session?: string;
    includeSpecialSessions: boolean;
    regularSessionOnly?: boolean;
  },
): T[] {
  if (opts.session) {
    const match = sessions.filter((s) => s.identifier === opts.session);
    if (match.length === 0) {
      throw new Error(`Session not found: ${opts.session}`);
    }
    return match;
  }

  if (opts.year === undefined) {
    return sessions;
  }

  return sessions.filter((s) =>
    sessionMatchesYear(s.identifier, opts.year!, {
      includeSpecialSessions: opts.includeSpecialSessions,
      regularSessionOnly: opts.regularSessionOnly,
    }),
  );
}
