import type { ColumnInfo } from "@/lib/types";
import { TypeBadge } from "./ui";

export function DataTable({
  columns,
  rows,
  label,
}: {
  columns: ColumnInfo[];
  rows: string[][];
  label: string;
}) {
  return (
    <div
      className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-100">
          <tr>
            {columns.map((col) => (
              <th key={col.name} scope="col" className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold text-slate-800">
                <div>{col.name}</div>
                <div className="mt-1">
                  <TypeBadge type={col.type} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="odd:bg-white even:bg-slate-50/60">
              {row.map((cell, c) => (
                <td key={c} className="max-w-[16rem] truncate whitespace-nowrap border-b border-slate-100 px-3 py-1.5 text-slate-700" title={cell}>
                  {cell === "" ? <span className="text-xs italic text-slate-400">empty</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
