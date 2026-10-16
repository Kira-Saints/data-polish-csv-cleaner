"""FastAPI application. Stateless: nothing is stored, nothing uploaded is logged."""

import logging

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import MAX_FILE_BYTES, MAX_OPTIONS_CHARS
from .errors import ApiError, error_body
from .models import PreviewResponse, ProcessOptions, ProcessResponse, SampleResponse
from .parsing import parse_csv
from .pipeline import run_pipeline
from .profiling import build_preview
from .sample import SAMPLE_CSV, SAMPLE_FILE_NAME

logger = logging.getLogger("datapolish")

app = FastAPI(
    title="DataPolish API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)


@app.exception_handler(ApiError)
async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details))


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_body("invalid_request", "The request is missing a required field (for example the CSV file) or contains invalid values."),
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error of type %s", type(exc).__name__)  # never log data or stack traces
    return JSONResponse(status_code=500, content=error_body("internal_error", "Something went wrong while processing the file. Please try again."))


async def _read_upload(file: UploadFile) -> bytes:
    raw = await file.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise ApiError(413, "file_too_large", f"The file is larger than the {MAX_FILE_BYTES // (1024 * 1024)} MB limit.")
    return raw


def _describe(exc: ValidationError) -> list[str]:
    return [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()[:10]]


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "datapolish-api", "version": "1.0.0"}


@app.get("/api/sample-csv", response_model=SampleResponse)
def sample_csv() -> SampleResponse:
    return SampleResponse(file_name=SAMPLE_FILE_NAME, csv=SAMPLE_CSV)


@app.post("/api/preview", response_model=PreviewResponse)
async def preview(file: UploadFile = File(...)) -> PreviewResponse:
    name = file.filename or "upload.csv"
    raw = await _read_upload(file)
    return build_preview(parse_csv(raw, name), name, len(raw))


@app.post("/api/process", response_model=ProcessResponse)
async def process(file: UploadFile = File(...), options: str = Form("{}")) -> ProcessResponse:
    if len(options) > MAX_OPTIONS_CHARS:
        raise ApiError(413, "options_too_large", "The processing options are too large.")
    try:
        opts = ProcessOptions.model_validate_json(options)
    except ValidationError as exc:
        raise ApiError(422, "invalid_options", "The processing options are invalid.", _describe(exc))
    name = file.filename or "upload.csv"
    raw = await _read_upload(file)
    return run_pipeline(parse_csv(raw, name), opts)
