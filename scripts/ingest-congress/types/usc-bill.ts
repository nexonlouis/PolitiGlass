/** unitedstates/congress bill data.json (subset) — https://github.com/unitedstates/congress/wiki/bills */

export interface UscBillFile {
  bill_id?: string;
  bill_type: string;
  number: number;
  congress: number;
  titles?: Array<{ title: string; type?: string }>;
  summary?: { text?: string };
  subjects?: Array<{ name: string } | string>;
  introduced_at?: string;
  updated_at?: string;
}
