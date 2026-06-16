/** Build app route for an official id (Bioguide or ocd-person/…). */
export function officialProfilePath(officialId: string): string {
  const segments = officialId.split("/").filter(Boolean);
  return `/officials/${segments.map(encodeURIComponent).join("/")}`;
}

/** Decode catch-all route segments back to official id. */
export function officialIdFromSegments(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}
