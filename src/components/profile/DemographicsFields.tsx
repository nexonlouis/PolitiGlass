import { Input } from "@/components/ui/input";
import { EDUCATION_LEVELS, INCOME_BRACKETS } from "@/lib/constants/issue-tags";
import type { DemographicsInput } from "@/lib/types";

interface DemographicsFieldsProps {
  value: DemographicsInput;
  onChange: (next: DemographicsInput) => void;
}

export function DemographicsFields({ value, onChange }: DemographicsFieldsProps) {
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        Birth year
        <Input
          type="number"
          className="mt-1"
          placeholder="1990"
          value={value.birthYear ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              birthYear: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      </label>
      <label className="block text-sm">
        Education
        <select
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={value.educationLevel ?? ""}
          onChange={(e) =>
            onChange({ ...value, educationLevel: e.target.value || null })
          }
        >
          <option value="">Prefer not to say</option>
          {EDUCATION_LEVELS.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Income bracket
        <select
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={value.incomeBracket ?? ""}
          onChange={(e) =>
            onChange({ ...value, incomeBracket: e.target.value || null })
          }
        >
          <option value="">Prefer not to say</option>
          {INCOME_BRACKETS.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.hasChildren === true}
          onChange={(e) =>
            onChange({ ...value, hasChildren: e.target.checked })
          }
        />
        I have children under 18
      </label>
    </div>
  );
}
