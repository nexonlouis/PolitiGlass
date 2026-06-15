import type { BillRow } from "../../tag-bills/lib/bills-query.js";
import { ALLOWED_ISSUE_SLUGS } from "../../tag-bills/lib/issue-slugs.js";
import type { StateBillRow } from "./state-bills-query.js";

/** Shape state bill metadata for the shared Ollama prompt builder. */
export function toOllamaBillInput(bill: StateBillRow): BillRow {
  const label = [bill.state, bill.session, bill.identifier].filter(Boolean).join(" ");
  const title = bill.title ? `${label}: ${bill.title}` : label;

  return {
    bill_id: bill.bill_id,
    title,
    short_title: bill.identifier,
    summary: bill.summary,
    subjects: bill.subjects,
    issue_slugs: bill.issue_slugs,
  };
}

/**
 * State-bill system prompt: return [] only for clearly procedural bills;
 * substantive bills must get the best available slug(s) from the catalog.
 */
export function buildStateOllamaSystemPrompt(): string {
  const slugList = ALLOWED_ISSUE_SLUGS.map((s) => `- ${s}`).join("\n");

  return `You classify U.S. state legislature bills into PolitiGlass issue tags for civic engagement scoring.

Allowed issue_slugs (use ONLY these exact strings):
${slugList}

Step 1 — Decide bill type:
A) PROCEDURAL → return {"issue_slugs":[]}
B) SUBSTANTIVE → return 1 to 3 slugs from the allowed list (never empty)

PROCEDURAL (return empty) — no broad policy issue for voters to align on:
- Omnibus appropriations / "General Appropriations Act" / implementing a budget bill
- Pure government reorganization or "Government Administration" with no policy change
- Honorary resolutions, memorial days, commendations, naming days
- Claims / relief bills for a named person or locality
- Local-only charter, boundary, or single-jurisdiction tweaks with no statewide policy
- Technical conforming, codification, revisor, cleanup, or renumbering only
- Committee-only procedural motions with no policy substance

SUBSTANTIVE (must tag) — changes law or policy that voters might care about:
- You MUST return at least 1 issue_slug. Pick the closest allowed slug even if imperfect.
- Use up to 3 tags when multiple areas clearly apply.

Helpful mappings when the fit is indirect:
- Redistricting / reapportionment / congressional districts → civil-rights
- Elections, voting, candidate qualifying, campaign ethics → civil-rights
- Insurance regulation or mandates → healthcare (or deregulation if deregulatory)
- Property tax, homestead, ad valorem → tax-relief or housing-affordability
- Land use, zoning, special districts → housing-affordability or infrastructure-transportation
- Environment, water, reefs, conservation → climate-environment
- Veterans benefits or care → healthcare or national-security
- State employee pay, retirement, labor → jobs-labor-rights
- Criminal law, courts, sentencing, tort reform → crime-prevention or criminal-justice-reform
- Medicaid, public health, medical licensing → healthcare
- K-12 or higher education → public-schools or student-loans
- Business licensing (pro-business) → small-business or deregulation

Output:
- JSON only: {"issue_slugs":["slug1"]} or {"issue_slugs":[]}
- Do not invent slugs outside the allowed list
- When substantive, never return an empty list — choose the best available match`;
}
