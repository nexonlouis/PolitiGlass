import Link from "next/link";
import type { Representative } from "@/lib/types";

function chamberLabel(rep: Representative): string {
  if (rep.chamber === "house") return "U.S. Representative";
  if (rep.chamber === "senate") return "U.S. Senator";
  if (rep.stateLegislativeChamber === "upper") return "State Senator";
  if (rep.stateLegislativeChamber === "lower") return "State Representative";
  return "State Legislator";
}

function RepresentativeCardContent({ rep }: { rep: Representative }) {
  return (
    <>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600 dark:bg-slate-800">
        {rep.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rep.photoUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          rep.fullName.charAt(0)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{rep.fullName}</p>
        <p className="text-sm text-slate-500">{chamberLabel(rep)}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {rep.party ?? "Party unknown"}
          {rep.district ? ` · District ${rep.district}` : ""}
          {rep.state ? ` · ${rep.state}` : ""}
        </p>
      </div>
    </>
  );
}

export function RepresentativeCard({
  rep,
  href,
}: {
  rep: Representative;
  href?: string;
}) {
  const className =
    "flex gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700";

  if (href) {
    return (
      <Link
        href={href}
        className={`${className} transition hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-900/50`}
      >
        <RepresentativeCardContent rep={rep} />
      </Link>
    );
  }

  return (
    <div className={className}>
      <RepresentativeCardContent rep={rep} />
    </div>
  );
}
