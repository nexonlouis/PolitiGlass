import type { Representative } from "@/lib/types";

export function RepresentativeCard({ rep }: { rep: Representative }) {
  const chamberLabel =
    rep.chamber === "house"
      ? "U.S. Representative"
      : rep.chamber === "senate"
        ? "U.S. Senator"
        : "State Legislator";

  return (
    <div className="flex gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
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
        <p className="text-sm text-slate-500">{chamberLabel}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {rep.party ?? "Party unknown"}
          {rep.district ? ` · District ${rep.district}` : ""}
          {rep.state ? ` · ${rep.state}` : ""}
        </p>
      </div>
    </div>
  );
}
