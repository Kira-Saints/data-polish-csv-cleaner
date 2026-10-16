"use client";

import { AlertCircle, FileSpreadsheet, Github, Loader2, Play, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { CleaningPanel } from "@/components/CleaningPanel";
import { DataTable } from "@/components/DataTable";
import { EnrichmentPanel } from "@/components/EnrichmentPanel";
import { FileSummary } from "@/components/FileSummary";
import { ResultsPanel } from "@/components/ResultsPanel";
import { UploadZone } from "@/components/UploadZone";
import { Card, primaryButton, secondaryButton } from "@/components/ui";
import { ApiClientError, fetchSample, previewCsv, processCsv } from "@/lib/api";
import { GITHUB_URL, MAX_FILE_BYTES } from "@/lib/config";
import { downloadCsv } from "@/lib/download";
import { buildPayload, initialCleaningState, initialEnrichmentState } from "@/lib/options";
import type { CleaningState, EnrichmentState } from "@/lib/options";
import type { PreviewResponse, ProcessResponse } from "@/lib/types";

interface ErrorState {
  message: string;
  details: string[];
}

function toErrorState(e: unknown): ErrorState {
  if (e instanceof ApiClientError) return { message: e.message, details: e.details };
  return { message: "Something unexpected went wrong. Please try again.", details: [] };
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [cleaning, setCleaning] = useState<CleaningState | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentState | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "processing">("idle");
  const [error, setError] = useState<ErrorState | null>(null);

  async function loadFile(f: File) {
    setError(null);
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".tsv")) {
      setError({ message: "Only .csv or .tsv files are supported.", details: [] });
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError({ message: "The file is larger than the 3 MB limit.", details: [] });
      return;
    }
    setStatus("loading");
    try {
      const p = await previewCsv(f);
      setFile(f);
      setPreview(p);
      setCleaning(initialCleaningState(p));
      setEnrichment(initialEnrichmentState(p));
      setResult(null);
    } catch (e) {
      setError(toErrorState(e));
    } finally {
      setStatus("idle");
    }
  }

  async function loadSample() {
    setError(null);
    setStatus("loading");
    try {
      const sample = await fetchSample();
      await loadFile(new File([sample.csv], sample.file_name, { type: "text/csv" }));
    } catch (e) {
      setError(toErrorState(e));
      setStatus("idle");
    }
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleProcess() {
    if (!file || !cleaning || !enrichment) return;
    setStatus("processing");
    setError(null);
    try {
      const r = await processCsv(file, buildPayload(cleaning, enrichment));
      setResult(r);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(toErrorState(e));
    } finally {
      setStatus("idle");
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setCleaning(null);
    setEnrichment(null);
    setResult(null);
    setError(null);
  }

  const busy = status !== "idle";

  return (
    <>
      <main>
        <section className="bg-gradient-to-b from-indigo-50 to-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Clean your CSV. Trust your data.</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-600">
              Upload a messy spreadsheet export, fix whitespace, duplicates, dates, numbers and emails, add a few helpful columns, and download a tidy file with a report of exactly what changed.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className={primaryButton}
                onClick={() => {
                  document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
                  inputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" aria-hidden /> Upload a CSV
              </button>
              <button type="button" className={secondaryButton} onClick={loadSample} disabled={busy}>
                <FileSpreadsheet className="h-4 w-4" aria-hidden /> Load sample data
              </button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="h-4 w-4 text-indigo-600" aria-hidden /> Processed in memory on request. Nothing is stored, and no outside services are used.
            </p>
          </div>
        </section>

        <section id="workspace" className="mx-auto max-w-6xl scroll-mt-4 space-y-6 px-4">
          <h2 className="text-xl font-semibold text-slate-900">Workspace</h2>

          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">{error.message}</p>
                {error.details.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {error.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!preview || !cleaning || !enrichment ? (
            <div className="space-y-4">
              <UploadZone inputRef={inputRef} onFile={loadFile} busy={status === "loading"} />
              <Card className="p-6 text-center text-sm text-slate-600">
                No data yet. Upload a CSV above, or{" "}
                <button type="button" className="font-semibold text-indigo-600 hover:underline" onClick={loadSample} disabled={busy}>
                  load the sample dataset
                </button>{" "}
                to see how DataPolish works.
              </Card>
            </div>
          ) : (
            <>
              <FileSummary preview={preview} onReset={reset} />
              <Card className="p-4">
                <h3 className="mb-3 text-base font-semibold text-slate-900">
                  Original data preview{" "}
                  <span className="text-sm font-normal text-slate-500">
                    (first {Math.min(preview.preview_row_limit, preview.row_count)} of {preview.row_count.toLocaleString()} rows)
                  </span>
                </h3>
                <DataTable columns={preview.columns} rows={preview.preview_rows} label="Original data preview" />
              </Card>

              <div className="grid items-start gap-6 lg:grid-cols-2">
                <CleaningPanel preview={preview} state={cleaning} onChange={setCleaning} />
                <EnrichmentPanel preview={preview} state={enrichment} onChange={setEnrichment} />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={primaryButton} onClick={handleProcess} disabled={busy}>
                  {status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                  {status === "processing" ? "Processing…" : "Process data"}
                </button>
                <span role="status" className="text-sm text-slate-500">
                  {status === "processing" ? "Cleaning and enriching your data…" : "Review the options above, then process."}
                </span>
              </div>
            </>
          )}

          {result && (
            <div ref={resultsRef} className="scroll-mt-4 border-t border-slate-200 pt-8">
              <ResultsPanel result={result} onDownload={() => downloadCsv(result.csv, result.csv_file_name)} />
            </div>
          )}
        </section>
      </main>
    </>
  );
}
