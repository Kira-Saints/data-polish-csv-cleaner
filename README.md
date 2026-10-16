# DataPolish: Smart CSV Cleaner & Data Enrichment Tool

DataPolish lets you upload a messy CSV, inspect it, clean common data-quality problems, enrich records using local rules, review an honest report of what changed, and download the result. Nothing is stored, no database is used, and no external or paid services are contacted.

## Features

- Drag-and-drop or file-picker upload (`.csv`, `.tsv`), UTF-8 and UTF-8 BOM handling, automatic delimiter detection, size/row/column limits, clear errors
- Preview with inferred column types (text, number, date, email) and data-quality observations
- Cleaning: trim, collapse spaces, text case per column, missing-value replacement, email normalization and syntax checks, duplicate detection/removal, date and number normalization, rename/remove/reorder columns
- Report: original vs. processed counts, duplicates detected/removed, malformed emails, missing values by column, values changed, invalid/ambiguous dates, invalid numbers, column changes, and a detected / corrected / removed / left-unchanged table
- Local enrichment: `email_domain`, `email_provider_type`, `full_name`, keyword categories, and a fixed list of built-in transformations (no `eval`/`exec`)
- CSV export (UTF-8, selected column order, correct escaping, formula-injection protection)
- Built-in synthetic sample dataset

## Technology stack

Next.js (App Router), React, TypeScript, Tailwind CSS 3, Lucide React; Python, FastAPI, Pydantic. The backend uses Python's standard `csv` module instead of Pandas. This keeps the Vercel function small and fast to start, and cell-level cleaning does not need DataFrames.

## Architecture

```
Browser (Next.js)  --/api/*-->  FastAPI app (backend/main.py)
```

- `app/`, `components/`, `lib/`: frontend
- `backend/`: FastAPI app and modules (`parsing`, `profiling`, `cleaning`, `enrichment`, `reporting`, `export`, `pipeline`)
- `api/index.py`: Vercel entry point that exposes the FastAPI `app`
- `vercel.json`: routes `/api/*` to that Python function

The frontend always calls relative URLs such as `/api/preview`.
- **Locally**, `next.config.mjs` proxies `/api/*` to `http://127.0.0.1:8000` (uvicorn). No API URL configuration is needed.
- **On Vercel**, `vercel.json` routes `/api/*` to the Python function.

Flow: `POST /api/preview` (file) shows the preview. `POST /api/process` (file + JSON options) re-reads the file, runs the pipeline, and returns the preview rows, report and the full processed CSV text. The browser turns that text into the download. The server keeps no state between requests.

Endpoints: `GET /api/health`, `GET /api/sample-csv`, `POST /api/preview`, `POST /api/process`. Interactive docs are at `/api/docs` when running locally.

## Prerequisites

- **Node.js 20 or newer** (LTS from https://nodejs.org). Check with `node --version` and `npm --version`.
- **Python 3.10 or newer**. On Windows the `py` launcher is used below. Check with `py --version`. If your machine uses `python` instead, replace `py` with `python` in every command.
- **Git** (only needed for GitHub).

Restart VS Code (or your terminal) after installing Node.js so the new command is found.

## Install (Windows PowerShell)

Open the project folder (the one containing `package.json` and `backend/`) in VS Code, then open a terminal with **Terminal > New Terminal**:

```powershell
# Python backend (one time)
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt

# Frontend (one time)
npm install
```

When the virtual environment is active, the prompt starts with `(.venv)`. If activation is blocked, run this once and retry:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

If VS Code offers to use the new `.venv` as your Python interpreter, accept.

## Run locally

Use two terminals, both opened in the project root. Use the **+** button in the VS Code terminal panel to open a second one.

**Terminal 1: Python API**

```powershell
.\.venv\Scripts\Activate.ps1
py -m uvicorn backend.main:app --reload --port 8000
```

Wait for "Uvicorn running on http://127.0.0.1:8000". Optional check: open http://127.0.0.1:8000/api/health in a browser. It should return `{"status":"ok", ...}`.

**Terminal 2: Next.js frontend**

```powershell
npm run dev
```

Open http://localhost:3000. Nothing needs configuring: in development, Next.js forwards `/api/*` to port 8000 (see `next.config.mjs`). Stop either server with `Ctrl+C`.

On later runs you only need the two "Run locally" steps.

## How to use

1. Click **Upload a CSV** (or drop a file), or **Load sample data**.
2. Review the preview and observations.
3. Open the Cleaning and Enrichment sections and choose what to apply. Detected email, date and number columns are pre-selected.
4. Click **Process data**.
5. Review the report and processed preview, then **Download processed CSV** (`data-polish-cleaned.csv`).

## Behaviour notes

- **Missing values**: blank cells and `N/A`, `null`, `nan`, `none`, `#N/A` (any case).
- **Dates**: accepted forms are `YYYY-MM-DD` (also with `/` or `.`), `15 Mar 2026`, `March 4, 2026`, `17-May-2026`, and numeric day/month forms where one part is above 12 (e.g. `25/12/2025`). Values like `03/04/2026` are **ambiguous** and left unchanged unless you explicitly choose month/day or day/month. Anything else (including times, two-digit years, impossible dates) is reported as unreadable and left unchanged.
- **Numbers**: handles `1,234.50`, `1.234,50`, `1 234`, `$12.50`, `(12.50)`. Ambiguous or invalid values (`12,5`, `abc`, integers with leading zeros such as `007`) are reported, never turned into zero.
- **Emails**: trimmed and lowercased. Syntax-only check. DataPolish does **not** verify that an address exists or can receive mail.
- **Duplicates**: whole-row comparison after cleaning, across all original columns, before column removal. The first occurrence is kept.
- **Email provider type** (`email_provider_type`): `personal` = common free providers (gmail.com, yahoo.com, outlook.com, icloud.com, etc.); `business` = a small built-in list of well-known company domains; `other` = example/test domains and `.edu`/`.gov`/`.mil`; `unknown` = anything else. Invalid or missing emails get an empty value. These are local heuristics only.
- **Export safety**: cells beginning with `=`, `+`, `-`, `@`, tab or carriage return get a leading `'` so spreadsheets treat them as text. Plain numbers such as `-12.5` are left alone. Other values like `+1 555 0100` will be prefixed. The count is shown after processing. The download has a UTF-8 BOM so Excel detects the encoding.
- **Enrichment is local**: it uses built-in lists and your own rules; no data leaves the server process.

## Push to GitHub

Create an empty repository on github.com, then:

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/data-polish-csv-cleaner.git
git push -u origin main
```

Then edit `GITHUB_URL` in `lib/config.ts` to your repository URL.

## Deploy to Vercel Hobby

1. Sign in at https://vercel.com with GitHub.
2. **Add New → Project**, import the repository.
3. Keep the detected **Next.js** preset and the defaults. No environment variables are required.
4. Click **Deploy**. Vercel installs `package.json` dependencies and builds the frontend, and installs `requirements.txt` for the Python function at `api/index.py`.

## Limitations

- **Request/response size**: Vercel functions allow about 4.5 MB per request or response body. The app limits uploads to 3 MB and the returned CSV to about 3.5 MB, and also caps files at 20,000 rows and 100 columns. Enrichment can enlarge the result, in which case you get a clear "too large" message.
- **Execution time**: Hobby functions have a time limit (10 seconds by default; check Vercel's current docs). Files near the limits may be slow on a cold start.
- **Re-upload on process**: the server is stateless, so the file is sent again when you click Process.
- **Verify the Python routing**: Vercel's Python runtime conventions change over time. This project uses `api/index.py` exposing an ASGI `app` plus a rewrite in `vercel.json`. If `/api/health` returns 404 after deploy, check the function logs and Vercel's current FastAPI guide.
- If Vercel Hobby cannot run this combination in future, the simplest alternative is to host the frontend on Vercel and the FastAPI app on another free Python host, then point `/api/*` there with a rewrite in `next.config.mjs`.

## Troubleshooting

- **"Could not reach the API" in the browser**: the Python server is not running, or it was started from the wrong folder. Start it in Terminal 1 from the project root.
- **`No module named backend`**: you are not in the project root. `cd` to the folder that contains `package.json`, then rerun uvicorn.
- **`No module named fastapi` / `uvicorn`**: the virtual environment is not active or the install did not finish. Run `.\.venv\Scripts\Activate.ps1`, then `py -m pip install -r requirements.txt`.
- **`py` or `node` not recognized**: install Python / Node.js, then restart VS Code.
- **Script execution disabled when activating the venv**: run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once.
- **Port already in use**: use another port, e.g. `--port 8001`, and update the `destination` in `next.config.mjs` to match.
- **Upload says the file is not valid UTF-8**: re-save it as "CSV UTF-8" in Excel.
- **Dates left unchanged**: they are probably ambiguous or unreadable. See "Values that need your attention" in the results, or choose how to treat ambiguous dates.
- **Zip extracted into a nested folder**: open the inner folder in VS Code, the one that directly contains `package.json`.
- **Vercel 404 on `/api/...`**: confirm `vercel.json` and `api/index.py` were committed and pushed.
- **Vercel 413 or "too large"**: use a smaller file or remove columns.

## License

Choose a license for your repository (for example MIT) before publishing.
