import { parseBillId } from "@/lib/legislation/bill-congress-url";

const CONGRESS_API = "https://api.congress.gov/v3";

export interface CongressBillMetadata {
  title: string | null;
  summary: string | null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCongressBillMetadata(
  billId: string,
  apiKey: string,
): Promise<CongressBillMetadata | null> {
  const parsed = parseBillId(billId);
  if (!parsed) return null;

  const base = `${CONGRESS_API}/bill/${parsed.congress}/${parsed.type}/${parsed.number}`;

  try {
    const [billRes, summaryRes] = await Promise.all([
      fetch(`${base}?format=json&api_key=${apiKey}`, { next: { revalidate: 86_400 } }),
      fetch(`${base}/summaries?format=json&api_key=${apiKey}`, {
        next: { revalidate: 86_400 },
      }),
    ]);

    let title: string | null = null;
    if (billRes.ok) {
      const billData = (await billRes.json()) as { bill?: { title?: string } };
      title = billData.bill?.title?.trim() ?? null;
    }

    let summary: string | null = null;
    if (summaryRes.ok) {
      const summaryData = (await summaryRes.json()) as {
        summaries?: Array<{ text?: string }>;
      };
      const latest = summaryData.summaries?.[0]?.text;
      if (latest) summary = stripHtml(latest);
    }

    if (!title && !summary) return null;
    return { title, summary };
  } catch (error) {
    console.error("Congress.gov bill metadata fetch failed", billId, error);
    return null;
  }
}

/**
 * Fetches CRS-style title + summary from Congress.gov for bills missing local metadata.
 */
export async function fetchCongressBillMetadataBatch(
  billIds: string[],
): Promise<Map<string, CongressBillMetadata>> {
  const apiKey = process.env.CONGRESS_GOV_API_KEY;
  const map = new Map<string, CongressBillMetadata>();
  if (!apiKey) return map;

  const unique = [...new Set(billIds)];
  const concurrency = 4;

  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (billId) => {
        const meta = await fetchCongressBillMetadata(billId, apiKey);
        return [billId, meta] as const;
      }),
    );

    for (const [billId, meta] of results) {
      if (meta) map.set(billId, meta);
    }
  }

  return map;
}
