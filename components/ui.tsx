"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-500 disabled:bg-slate-100";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function CollapsibleSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="border-t border-slate-200 first:border-t-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {icon && <span className="text-indigo-600">{icon}</span>}
        <span className="flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id={panelId} hidden={!open} className="space-y-4 px-4 pb-4">
        {children}
      </div>
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-800">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-700">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ColumnSelect({
  label,
  columns,
  value,
  onChange,
}: {
  label: string;
  columns: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function ColumnChecklist({
  legend,
  columns,
  selected,
  onChange,
}: {
  legend: string;
  columns: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (name: string, on: boolean) =>
    onChange(on ? [...selected, name] : selected.filter((s) => s !== name));
  return (
    <fieldset>
      <div className="mb-1 flex items-center justify-between">
        <legend className="text-xs font-medium text-slate-700">{legend}</legend>
        <span className="space-x-2 text-xs">
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => onChange([...columns])}>
            All
          </button>
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => onChange([])}>
            None
          </button>
        </span>
      </div>
      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
        {columns.map((name) => (
          <Checkbox key={name} label={name} checked={selected.includes(name)} onChange={(on) => toggle(name, on)} />
        ))}
      </div>
    </fieldset>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    text: "bg-slate-100 text-slate-700",
    number: "bg-blue-100 text-blue-800",
    date: "bg-violet-100 text-violet-800",
    email: "bg-indigo-100 text-indigo-800",
    empty: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${colors[type] ?? colors.text}`}>{type}</span>
  );
}
