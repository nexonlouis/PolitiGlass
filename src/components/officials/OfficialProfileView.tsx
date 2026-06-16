import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { OfficialProfile } from "@/lib/officials/types";

function chamberLabel(profile: OfficialProfile): string {
  if (profile.chamber === "house") return "U.S. Representative";
  if (profile.chamber === "senate") return "U.S. Senator";
  if (profile.stateLegislativeChamber === "upper") return "State Senator";
  if (profile.stateLegislativeChamber === "lower") return "State Representative";
  return "State Legislator";
}

function formatBirthDate(value: string): string {
  if (/^\d{4}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function OfficialProfileView({ profile }: { profile: OfficialProfile }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-6 p-6 sm:flex-row">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-slate-100 text-3xl font-semibold text-slate-600 dark:bg-slate-800">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoUrl}
                alt=""
                className="h-28 w-28 rounded-full object-cover"
              />
            ) : (
              profile.fullName.charAt(0)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{profile.fullName}</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">{chamberLabel(profile)}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {profile.party ?? "Party unknown"}
              {profile.district ? ` · District ${profile.district}` : ""}
              {profile.state ? ` · ${profile.state}` : ""}
            </p>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">About</h2>
        <Card className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
          {profile.birthDate && (
            <p>
              <span className="font-medium text-slate-900 dark:text-slate-100">Born:</span>{" "}
              {formatBirthDate(profile.birthDate)}
            </p>
          )}
          {profile.gender && (
            <p>
              <span className="font-medium text-slate-900 dark:text-slate-100">Gender:</span>{" "}
              {profile.gender}
            </p>
          )}
          {profile.email && (
            <p>
              <span className="font-medium text-slate-900 dark:text-slate-100">Email:</span>{" "}
              <a href={`mailto:${profile.email}`} className="underline">
                {profile.email}
              </a>
            </p>
          )}
          {profile.phone && (
            <p>
              <span className="font-medium text-slate-900 dark:text-slate-100">Phone:</span>{" "}
              <a href={`tel:${profile.phone}`} className="underline">
                {profile.phone}
              </a>
            </p>
          )}
          {profile.officeAddress && (
            <p>
              <span className="font-medium text-slate-900 dark:text-slate-100">Office:</span>{" "}
              {profile.officeAddress}
            </p>
          )}
          {profile.officialWebsite && (
            <p>
              <span className="font-medium text-slate-900 dark:text-slate-100">Website:</span>{" "}
              <a
                href={profile.officialWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {profile.officialWebsite.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}
          {!profile.birthDate &&
            !profile.gender &&
            !profile.email &&
            !profile.phone &&
            !profile.officeAddress &&
            !profile.officialWebsite && (
              <p className="text-slate-500">
                Limited biography metadata is available for this official. Use the links below for
                more from public sources.
              </p>
            )}
        </Card>
      </section>

      {profile.terms.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Service history</h2>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="px-4 py-2 font-medium">Chamber</th>
                  <th className="px-4 py-2 font-medium">State</th>
                  <th className="px-4 py-2 font-medium">District</th>
                  <th className="px-4 py-2 font-medium">Party</th>
                  <th className="px-4 py-2 font-medium">Years</th>
                </tr>
              </thead>
              <tbody>
                {[...profile.terms].reverse().map((term, index) => (
                  <tr
                    key={`${term.chamber}-${term.start}-${index}`}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-2">{term.chamber}</td>
                    <td className="px-4 py-2">{term.state ?? "—"}</td>
                    <td className="px-4 py-2">{term.district ?? "—"}</td>
                    <td className="px-4 py-2">{term.party ?? "—"}</td>
                    <td className="px-4 py-2">
                      {term.start ?? "—"}
                      {term.end ? ` – ${term.end}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {profile.externalLinks.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">External profiles</h2>
          <ul className="space-y-2">
            {profile.externalLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-800 underline dark:text-slate-200"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-500">
        Sources: {profile.sources.join(", ")}. Full narrative biographies are not included in bulk
        legislative data; federal prose bios may be available on Congress.gov.
      </p>

      <Link href="/dashboard" className="inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to dashboard
      </Link>
    </div>
  );
}
