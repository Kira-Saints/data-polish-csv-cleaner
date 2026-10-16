import type { PreviewResponse, ProcessPayload, ProcessResponse, SampleResponse } from "./types";

export class ApiClientError extends Error {
  status: number;
  details: string[];

  constructor(message: string, status = 0, details: string[] = []) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

async function toError(res: Response): Promise<ApiClientError> {
  try {
    const body = await res.json();
    const err = body?.error;
    if (err && typeof err.message === "string") {
      return new ApiClientError(err.message, res.status, Array.isArray(err.details) ? err.details : []);
    }
  } catch {
    // fall through to generic messages
  }
  if (res.status === 413) {
    return new ApiClientError("The file or result is too large for the server. Try a smaller file.", 413);
  }
  return new ApiClientError(`The server returned an unexpected response (HTTP ${res.status}). Please try again.`, res.status);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiClientError("Could not reach the API. If you are running locally, make sure the Python backend is running on port 8000.");
  }
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export function fetchSample(): Promise<SampleResponse> {
  return request<SampleResponse>("/api/sample-csv");
}

export function previewCsv(file: File): Promise<PreviewResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  return request<PreviewResponse>("/api/preview", { method: "POST", body: form });
}

export function processCsv(file: File, payload: ProcessPayload): Promise<ProcessResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("options", JSON.stringify(payload));
  return request<ProcessResponse>("/api/process", { method: "POST", body: form });
}
