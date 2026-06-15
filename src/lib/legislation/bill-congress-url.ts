/** Maps PolitiGlass bill_id prefix to congress.gov path segment. */
const CONGRESS_GOV_BILL_TYPE: Record<string, string> = {
  hr: "house-bill",
  s: "senate-bill",
  hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution",
  sconres: "senate-concurrent-resolution",
  hres: "house-resolution",
  sres: "senate-resolution",
};

const BILL_ID_PATTERN = /^([a-z]+)(\d+)-(\d+)$/;

function congressOrdinal(congress: number): string {
  const mod100 = congress % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${congress}th`;
  switch (congress % 10) {
    case 1:
      return `${congress}st`;
    case 2:
      return `${congress}nd`;
    case 3:
      return `${congress}rd`;
    default:
      return `${congress}th`;
  }
}

export interface ParsedBillId {
  type: string;
  number: number;
  congress: number;
}

export function parseBillId(billId: string): ParsedBillId | null {
  const match = billId.toLowerCase().match(BILL_ID_PATTERN);
  if (!match) return null;

  const type = match[1];
  const segment = CONGRESS_GOV_BILL_TYPE[type];
  if (!segment) return null;

  return {
    type,
    number: Number(match[2]),
    congress: Number(match[3]),
  };
}

/** Link to the bill's full text on Congress.gov (null when billId is not a bill). */
export function congressGovBillTextUrl(billId: string): string | null {
  const parsed = parseBillId(billId);
  if (!parsed) return null;

  const segment = CONGRESS_GOV_BILL_TYPE[parsed.type];
  if (!segment) return null;

  return `https://www.congress.gov/bill/${congressOrdinal(parsed.congress)}-congress/${segment}/${parsed.number}/text`;
}
