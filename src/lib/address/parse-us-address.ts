export interface ParsedUsAddress {
  street: string;
  city: string;
  state: string;
  zip: string | null;
  singleLine: string;
}

/**
 * Best-effort parser for US addresses entered as a single line.
 */
export function parseUsAddress(raw: string): ParsedUsAddress | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  const fullMatch = trimmed.match(
    /^(.+?),\s*([^,]+),\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$/i,
  );
  if (fullMatch) {
    return {
      street: fullMatch[1].trim(),
      city: fullMatch[2].trim(),
      state: fullMatch[3].toUpperCase(),
      zip: fullMatch[4] ?? null,
      singleLine: trimmed,
    };
  }

  const zipOnly = trimmed.match(/^(\d{5})(?:-\d{4})?$/);
  if (zipOnly) {
    return {
      street: "",
      city: "",
      state: "",
      zip: zipOnly[1],
      singleLine: trimmed,
    };
  }

  const stateZip = trimmed.match(/\b([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (stateZip) {
    const before = trimmed.slice(0, stateZip.index).replace(/,\s*$/, "");
    const parts = before.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        street: parts.slice(0, -1).join(", "),
        city: parts[parts.length - 1],
        state: stateZip[1].toUpperCase(),
        zip: stateZip[2],
        singleLine: trimmed,
      };
    }
  }

  return null;
}
