import { CheckCircle2, Download, Info, ShieldCheck } from "lucide-react";
import type { ProcessResponse } from "@/lib/types";
import { DataTable } from "./DataTable";
import { Card, primaryButton } from "./ui";

const ISSUE_LABELS: Record<string, string> = {
  invalid_email: "Malformed email",
  invalid_date: "Unreadable date",
  ambiguous_date: "Ambiguous date",
  invalid_number: "Invalid number",
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function ResultsPanel({ result, onDownload }: { result: ProcessResponse; onDownload: () => void }) {
  const r = result.report;
  const n = (v: number) => v.toLocaleString();
  const totalMissing = r.missing_by_column.reduce((s, m) => s + m.original_missing, 0);
  const totalFilled = r.missing_by_column.reduce((s, m) => s + m.filled, 0);
  const dateDetected = r.dates.ambiguous + r.dates.resolved_by_rule;

  // Detected / corrected / removed / left unchanged, taken directly from the report.
  const outcome: { item: string; detected: number; corrected: number | null; removed: number | null; left: number }[] = [
    { item: "Duplicate rows", detected: r.duplicate_rows_detected, corrected: null, removed: r.duplicate_rows_removed, left: r.duplicate_rows_detected - r.duplicate_rows_removed },
    { item: "Missing values", detected: totalMissing, corrected: totalFilled, removed: null, left: totalMissing - totalFilled },
    { item: "Malformed emails", detected: r.malformed_emails_detected, corrected: null, removed: null, left: r.malformed_emails_detected },
    { item: "Ambiguous dates", detected: dateDetected, corrected: r.dates.resolved_by_rule, removed: null, left: r.dates.ambiguous },
    { item: "Unreadable dates", detected: r.invalid_dates, corrected: null, removed: null, left: r.invalid_dates },
    { item: "Invalid numbers", detected: r.invalid_numbers, corrected: null, removed: null, left: r.invalid_numbers },
  ];
  const dash = (v: number | null) => (v === null ? "–" : n(v));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Results</h2>
          <p className="text-sm text-slate-600">
            {n(r.original_rows)} rows in, {n(r.cleaned_rows)} rows out.
          </p>
        </div>
        <button type="button" className={primaryButton} onClick={onDownload}>
          <Download className="h-4 w-4" aria-hidden /> Download processed CSV
        </button>
      </div>

      {r.no_changes && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> No changes were made with the selected options. The output matches your original data.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rows" value={`${n(r.original_rows)} → ${n(r.cleaned_rows)}`} hint="original → processed" />
        <StatCard label="Columns" value={`${n(r.original_columns)} → ${n(r.final_columns)}`} hint="original → final" />
        <StatCard label="Values changed" value={n(r.values_changed)} hint="cells that differ from the original" />
        <StatCard label="Duplicate rows" value={n(r.duplicate_rows_detected)} hint={`${n(r.duplicate_rows_removed)} removed`} />
        <StatCard label="Malformed emails" value={n(r.malformed_emails_detected)} hint="detected, left unchanged" />
        <StatCard label="Unreadable / ambiguous dates" value={`${n(r.invalid_dates)} / ${n(r.ambiguous_dates)}`} hint="left unchanged" />
        <StatCard label="Invalid numbers" value={n(r.invalid_numbers)} hint="left unchanged" />
        <StatCard label="Columns added" value={n(r.columns_added.length)} hint={r.columns_added.join(", ") || "none"} />
      </div>

      <Card className="p-4">
        <h3 className="text-base font-semibold text-slate-900">What was detected, corrected, removed or left alone</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th scope="col" className="py-2 pr-4 font-medium">Item</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Detected</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Corrected</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Removed</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Left unchanged</th>
              </tr>
            </thead>
            <tbody>
              {outcome.map((o) => (
                <tr key={o.item} className="border-b border-slate-100">
                  <th scope="row" className="py-2 pr-4 font-normal text-slate-800">{o.item}</th>
                  <td className="px-3 py-2 text-right tabular-nums">{n(o.detected)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dash(o.corrected)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dash(o.removed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(o.left)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Duplicates are counted after cleaning. Email checks are syntax-only and do not verify that a mailbox exists.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-base font-semibold text-slate-900">Operations applied</h3>
          {r.operations.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No cleaning operations were selected.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {r.operations.map((o) => (
                <li key={o.label} className="flex justify-between py-1.5">
                  <span className="text-slate-700">{o.label}</span>
                  <span className="font-medium tabular-nums">{n(o.count)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">A cell touched by several operations is counted once in each.</p>
        </Card>

        <Card className="p-4">
          <h3 className="text-base font-semibold text-slate-900">Missing values by column</h3>
          {r.missing_by_column.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No missing values were found.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th scope="col" className="py-1.5 pr-3 font-medium">Column</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Missing</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Filled</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {r.missing_by_column.map((m) => (
                    <tr key={m.column} className="border-b border-slate-100">
                      <th scope="row" className="py-1.5 pr-3 font-normal text-slate-800">{m.column}</th>
                      <td className="px-2 py-1.5 text-right tabular-nums">{n(m.original_missing)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{n(m.filled)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{n(m.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {r.issues.length > 0 && (
        <Card className="p-4">
          <h3 className="text-base font-semibold text-slate-900">Values that need your attention</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {r.issues.map((issue) => (
              <li key={`${issue.kind}-${issue.column}`} className="py-2">
                <span className="font-medium text-slate-900">{ISSUE_LABELS[issue.kind]}</span> in “{issue.column}”: {n(issue.count)} value(s).
                <span className="block text-xs text-slate-500">Examples: {issue.examples.map((e) => `“${e}”`).join(", ")}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(r.columns_renamed.length > 0 || r.columns_removed.length > 0 || r.columns_added.length > 0 || r.columns_reordered || r.enrichment.length > 0) && (
        <Card className="p-4">
          <h3 className="text-base font-semibold text-slate-900">Column and enrichment changes</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {r.columns_renamed.map((c) => (
              <li key={c.original}>Renamed “{c.original}” to “{c.renamed_to}”.</li>
            ))}
            {r.columns_removed.length > 0 && <li>Removed: {r.columns_removed.map((c) => `“${c}”`).join(", ")}.</li>}
            {r.columns_reordered && <li>Columns were reordered.</li>}
          </ul>
          {r.enrichment.map((e) => (
            <div key={e.label + e.columns_added.join()} className="mt-3 rounded-lg bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-900">
                {e.label} <span className="font-normal text-slate-500">→ added {e.columns_added.join(", ")}</span>
              </div>
              <ul className="mt-1 grid gap-x-6 text-sm text-slate-700 sm:grid-cols-2">
                {e.details.map((d) => (
                  <li key={d.label} className="flex justify-between gap-3">
                    <span>{d.label}</span>
                    <span className="tabular-nums">{n(d.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">
          Processed data preview{" "}
          <span className="text-sm font-normal text-slate-500">
            (first {Math.min(result.preview_row_limit, r.cleaned_rows)} of {n(r.cleaned_rows)} rows)
          </span>
        </h3>
        <DataTable columns={result.columns} rows={result.preview_rows} label="Processed data preview" />
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">Export safety:</span> cells that begin with =, +, - or @ (and aren’t plain numbers) get a leading apostrophe in the downloaded file so spreadsheets treat them as text.{" "}
          {result.formula_protected_cells > 0
            ? `${n(result.formula_protected_cells)} cell(s) were protected in this export.`
            : "No cells needed protection in this export."}{" "}
          The file is UTF-8 encoded.
        </p>
      </div>

      <div className="flex items-center pb-8 gap-2 text-sm text-slate-500">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> The download contains the full processed dataset, not just the preview.
      </div>
    </div>
  );
}
