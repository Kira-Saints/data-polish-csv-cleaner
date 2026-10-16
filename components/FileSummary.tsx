import { AlertTriangle, Info, RotateCcw } from "lucide-react";
import { formatBytes } from "@/lib/download";
import type { PreviewResponse } from "@/lib/types";
import { Card, secondaryButton } from "./ui";

export function FileSummary({ preview, onReset }: { preview: PreviewResponse; onReset: () => void }) {
  const stats = [
    ["Rows", preview.row_count.toLocaleString()],
    ["Columns", preview.column_count.toLocaleString()],
    ["Size", formatBytes(preview.size_bytes)],
    ["Delimiter", preview.delimiter],
    ["Encoding", preview.encoding],
  ];
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{preview.file_name}</h3>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {stats.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-slate-500">{k}:</dt>
                <dd className="font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <button type="button" className={secondaryButton} onClick={onReset}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Start over
        </button>
      </div>
      <ul className="mt-4 space-y-1.5">
        {preview.observations.map((o, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            {o.level === "warning" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Warning" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-label="Info" />
            )}
            {o.message}
          </li>
        ))}
      </ul>
    </Card>
  );
}
