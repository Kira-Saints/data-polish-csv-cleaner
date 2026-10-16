"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import type { RefObject } from "react";

export function UploadZone({
  inputRef,
  onFile,
  busy,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  busy: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      htmlFor="csv-upload"
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 ${
        dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-indigo-400"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <input
        ref={inputRef}
        id="csv-upload"
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      {busy ? (
        <Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden />
      ) : (
        <FileSpreadsheet className="h-9 w-9 text-indigo-600" aria-hidden />
      )}
      <span className="text-base font-semibold text-slate-900">
        {busy ? "Reading your file…" : "Drop a CSV here, or choose a file"}
      </span>
      <span className="text-sm text-slate-500">.csv or .tsv, up to 3 MB. Files are processed in memory and never stored.</span>
      {!busy && (
        <span className="mt-2 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          <Upload className="h-4 w-4" aria-hidden /> Choose file
        </span>
      )}
    </label>
  );
}
