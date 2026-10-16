"use client";

import { ArrowDown, ArrowUp, CalendarDays, Columns3, Copy, Eraser, Mail, TextCursorInput } from "lucide-react";
import type { CaseMode, CleaningState } from "@/lib/options";
import type { PreviewResponse } from "@/lib/types";
import { Card, Checkbox, CollapsibleSection, ColumnChecklist, Field, TypeBadge, inputClass } from "./ui";

export function CleaningPanel({
  preview,
  state,
  onChange,
}: {
  preview: PreviewResponse;
  state: CleaningState;
  onChange: (state: CleaningState) => void;
}) {
  const names = preview.columns.map((c) => c.name);
  const typeOf = (name: string) => preview.columns.find((c) => c.name === name)?.type ?? "text";
  const set = (patch: Partial<CleaningState>) => onChange({ ...state, ...patch });

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= state.columns.length) return;
    const next = [...state.columns];
    [next[index], next[target]] = [next[target], next[index]];
    set({ columns: next });
  };
  const updateColumn = (index: number, patch: Partial<CleaningState["columns"][number]>) =>
    set({ columns: state.columns.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

  const totalMissing = preview.columns.reduce((sum, c) => sum + c.missing_count, 0);

  return (
    <Card>
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">Cleaning options</h3>
        <p className="text-xs text-slate-500">Your original data stays unchanged until you process it.</p>
      </div>

      <CollapsibleSection title="Whitespace and missing values" icon={<Eraser className="h-4 w-4" aria-hidden />} defaultOpen>
        <Checkbox label="Trim leading and trailing whitespace" checked={state.trimWhitespace} onChange={(v) => set({ trimWhitespace: v })} />
        <Checkbox label="Collapse repeated spaces inside values" checked={state.collapseSpaces} onChange={(v) => set({ collapseSpaces: v })} />
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <Checkbox
            label="Replace missing values"
            hint={`${totalMissing} missing value(s) detected. Blank cells, N/A, null, nan and none count as missing.`}
            checked={state.fillEnabled}
            onChange={(v) => set({ fillEnabled: v })}
          />
          {state.fillEnabled && (
            <>
              <Field label="Replacement value">
                {(id) => <input id={id} className={inputClass} value={state.fillValue} onChange={(e) => set({ fillValue: e.target.value })} placeholder="For example: Unknown" />}
              </Field>
              <ColumnChecklist legend="Apply to these columns" columns={names} selected={state.fillColumns} onChange={(v) => set({ fillColumns: v })} />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Text case" description="Lowercase, uppercase or title case per column" icon={<TextCursorInput className="h-4 w-4" aria-hidden />}>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {names.map((name) => (
            <div key={name} className="grid grid-cols-[1fr_8rem] items-center gap-2">
              <label htmlFor={`case-${name}`} className="truncate text-sm text-slate-800" title={name}>
                {name}
              </label>
              <select
                id={`case-${name}`}
                className={inputClass}
                value={state.caseModes[name] ?? "none"}
                onChange={(e) => set({ caseModes: { ...state.caseModes, [name]: e.target.value as CaseMode } })}
              >
                <option value="none">No change</option>
                <option value="lower">lowercase</option>
                <option value="upper">UPPERCASE</option>
                <option value="title">Title Case</option>
              </select>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Emails" description="Normalize and flag malformed addresses" icon={<Mail className="h-4 w-4" aria-hidden />}>
        <ColumnChecklist legend="Email columns" columns={names} selected={state.emailColumns} onChange={(v) => set({ emailColumns: v })} />
        <p className="text-xs text-slate-500">
          Addresses are trimmed and lowercased. Malformed ones are reported but not changed. This checks syntax only; it cannot tell whether a mailbox exists or can receive mail.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Dates and numbers" description="Standardize formats without guessing" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
        <ColumnChecklist legend="Date columns" columns={names} selected={state.dateColumns} onChange={(v) => set({ dateColumns: v })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date output format">
            {(id) => (
              <select id={id} className={inputClass} value={state.dateOutputFormat} onChange={(e) => set({ dateOutputFormat: e.target.value as CleaningState["dateOutputFormat"] })}>
                <option value="iso">YYYY-MM-DD</option>
                <option value="us">MM/DD/YYYY</option>
                <option value="eu">DD/MM/YYYY</option>
              </select>
            )}
          </Field>
          <Field label="Ambiguous dates like 03/04/2026">
            {(id) => (
              <select id={id} className={inputClass} value={state.ambiguousDates} onChange={(e) => set({ ambiguousDates: e.target.value as CleaningState["ambiguousDates"] })}>
                <option value="leave">Leave unchanged and report</option>
                <option value="mdy">Treat as month/day</option>
                <option value="dmy">Treat as day/month</option>
              </select>
            )}
          </Field>
        </div>
        <ColumnChecklist legend="Number columns" columns={names} selected={state.numberColumns} onChange={(v) => set({ numberColumns: v })} />
        <Field label="Decimal places (optional)" hint="Leave blank to keep the original precision. Currency symbols and thousands separators are removed; invalid values are reported, never turned into zero.">
          {(id) => (
            <input id={id} type="number" min={0} max={6} className={inputClass} value={state.decimalPlaces} onChange={(e) => set({ decimalPlaces: e.target.value })} />
          )}
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Duplicate rows" icon={<Copy className="h-4 w-4" aria-hidden />}>
        <p className="text-sm text-slate-700">{preview.duplicate_row_count} exact duplicate row(s) in the original file.</p>
        <Checkbox
          label="Remove duplicate rows"
          hint="Keeps the first occurrence. Duplicates are compared after cleaning, across all original columns."
          checked={state.removeDuplicates}
          onChange={(v) => set({ removeDuplicates: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Columns" description="Rename, remove and reorder" icon={<Columns3 className="h-4 w-4" aria-hidden />}>
        <ul className="space-y-2">
          {state.columns.map((col, i) => (
            <li key={col.name} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                checked={col.keep}
                onChange={(e) => updateColumn(i, { keep: e.target.checked })}
                aria-label={`Keep column ${col.name}`}
              />
              <span className={`min-w-0 flex-1 truncate text-sm ${col.keep ? "text-slate-900" : "text-slate-400 line-through"}`} title={col.name}>
                {col.name} <TypeBadge type={typeOf(col.name)} />
              </span>
              <input
                className={`${inputClass} !w-36`}
                value={col.newName}
                placeholder="Rename"
                aria-label={`New name for ${col.name}`}
                onChange={(e) => updateColumn(i, { newName: e.target.value })}
              />
              <button type="button" className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${col.name} up`}>
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" disabled={i === state.columns.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${col.name} down`}>
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">New enrichment columns are added after these. Removed columns can still be used as enrichment sources.</p>
      </CollapsibleSection>
    </Card>
  );
}
