"use client";

import { AtSign, Plus, Tags, Trash2, UserRound, Wand2 } from "lucide-react";
import { nextId } from "@/lib/options";
import type { EnrichmentState } from "@/lib/options";
import type { PreviewResponse, TransformOp } from "@/lib/types";
import { Card, Checkbox, CollapsibleSection, ColumnSelect, Field, inputClass, secondaryButton } from "./ui";

const TRANSFORM_LABELS: Record<TransformOp, string> = {
  text_length: "Text length",
  word_count: "Word count",
  first_word: "First word",
  last_word: "Last word",
  initials: "Initials",
  extract_year: "Year from a date",
};

export function EnrichmentPanel({
  preview,
  state,
  onChange,
}: {
  preview: PreviewResponse;
  state: EnrichmentState;
  onChange: (state: EnrichmentState) => void;
}) {
  const names = preview.columns.map((c) => c.name);
  const set = (patch: Partial<EnrichmentState>) => onChange({ ...state, ...patch });

  return (
    <Card>
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">Enrichment options</h3>
        <p className="text-xs text-slate-500">Everything runs locally. No outside services are contacted.</p>
      </div>

      <CollapsibleSection title="Email domain and provider type" icon={<AtSign className="h-4 w-4" aria-hidden />} defaultOpen>
        <Checkbox label="Add email columns" checked={state.emailEnabled} onChange={(v) => set({ emailEnabled: v })} />
        {state.emailEnabled && (
          <div className="space-y-3">
            <ColumnSelect label="Email column" columns={names} value={state.emailSource} onChange={(v) => set({ emailSource: v })} />
            <Checkbox label="Add email_domain" checked={state.addDomain} onChange={(v) => set({ addDomain: v })} />
            <Checkbox
              label="Add email_provider_type"
              hint="personal = common free providers, business = a small list of well-known company domains, other = example/test domains and .edu/.gov/.mil, unknown = anything else."
              checked={state.addCategory}
              onChange={(v) => set({ addCategory: v })}
            />
            <p className="text-xs text-slate-500">Invalid or missing addresses get an empty value. Categories say nothing about whether an address exists or is deliverable.</p>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Full name" icon={<UserRound className="h-4 w-4" aria-hidden />}>
        <Checkbox label="Generate a full name column" checked={state.fullNameEnabled} onChange={(v) => set({ fullNameEnabled: v })} />
        {state.fullNameEnabled && (
          <div className="grid gap-3 sm:grid-cols-3">
            <ColumnSelect label="First name column" columns={names} value={state.firstColumn} onChange={(v) => set({ firstColumn: v })} />
            <ColumnSelect label="Last name column" columns={names} value={state.lastColumn} onChange={(v) => set({ lastColumn: v })} />
            <Field label="New column name">
              {(id) => <input id={id} className={inputClass} value={state.fullNameOutput} onChange={(e) => set({ fullNameOutput: e.target.value })} />}
            </Field>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Keyword categories" description="Label rows by keywords found in a text column" icon={<Tags className="h-4 w-4" aria-hidden />}>
        <Checkbox label="Categorize by keywords" checked={state.keywordEnabled} onChange={(v) => set({ keywordEnabled: v })} />
        {state.keywordEnabled && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <ColumnSelect label="Text column" columns={names} value={state.keywordSource} onChange={(v) => set({ keywordSource: v })} />
              <Field label="New column name">
                {(id) => <input id={id} className={inputClass} value={state.keywordOutput} onChange={(e) => set({ keywordOutput: e.target.value })} />}
              </Field>
              <Field label="Default category">
                {(id) => <input id={id} className={inputClass} value={state.keywordDefault} onChange={(e) => set({ keywordDefault: e.target.value })} />}
              </Field>
            </div>
            <p className="text-xs text-slate-500">Rules are checked top to bottom, ignoring case. The first matching keyword wins.</p>
            <ul className="space-y-2">
              {state.keywordRules.map((rule, i) => (
                <li key={rule.id} className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={rule.keyword}
                    placeholder="Keyword"
                    aria-label={`Keyword ${i + 1}`}
                    onChange={(e) => set({ keywordRules: state.keywordRules.map((r) => (r.id === rule.id ? { ...r, keyword: e.target.value } : r)) })}
                  />
                  <input
                    className={inputClass}
                    value={rule.category}
                    placeholder="Category"
                    aria-label={`Category ${i + 1}`}
                    onChange={(e) => set({ keywordRules: state.keywordRules.map((r) => (r.id === rule.id ? { ...r, category: e.target.value } : r)) })}
                  />
                  <button type="button" className="rounded p-2 text-slate-600 hover:bg-slate-100" aria-label={`Remove rule ${i + 1}`} onClick={() => set({ keywordRules: state.keywordRules.filter((r) => r.id !== rule.id) })}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={secondaryButton} onClick={() => set({ keywordRules: [...state.keywordRules, { id: nextId(), keyword: "", category: "" }] })}>
              <Plus className="h-4 w-4" aria-hidden /> Add rule
            </button>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Other transformations" description="Add a column from a built-in operation" icon={<Wand2 className="h-4 w-4" aria-hidden />}>
        <ul className="space-y-3">
          {state.transforms.map((t, i) => (
            <li key={t.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="Operation">
                {(id) => (
                  <select id={id} className={inputClass} value={t.operation} onChange={(e) => set({ transforms: state.transforms.map((x) => (x.id === t.id ? { ...x, operation: e.target.value as TransformOp } : x)) })}>
                    {(Object.keys(TRANSFORM_LABELS) as TransformOp[]).map((op) => (
                      <option key={op} value={op}>{TRANSFORM_LABELS[op]}</option>
                    ))}
                  </select>
                )}
              </Field>
              <ColumnSelect label="Source column" columns={names} value={t.sourceColumn} onChange={(v) => set({ transforms: state.transforms.map((x) => (x.id === t.id ? { ...x, sourceColumn: v } : x)) })} />
              <Field label="New column name">
                {(id) => <input id={id} className={inputClass} value={t.outputColumn} onChange={(e) => set({ transforms: state.transforms.map((x) => (x.id === t.id ? { ...x, outputColumn: e.target.value } : x)) })} />}
              </Field>
              <button type="button" className="mb-0.5 rounded p-2 text-slate-600 hover:bg-slate-100" aria-label={`Remove transformation ${i + 1}`} onClick={() => set({ transforms: state.transforms.filter((x) => x.id !== t.id) })}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={secondaryButton}
          disabled={state.transforms.length >= 10}
          onClick={() => set({ transforms: [...state.transforms, { id: nextId(), operation: "word_count", sourceColumn: names[0] ?? "", outputColumn: `new_column_${state.transforms.length + 1}` }] })}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add transformation
        </button>
      </CollapsibleSection>
    </Card>
  );
}
