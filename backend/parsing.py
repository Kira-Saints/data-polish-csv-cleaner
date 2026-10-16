"""CSV upload parsing: decoding, delimiter detection, validation."""

import codecs
import csv
import io
import itertools
from dataclasses import dataclass

from .config import (
    ALLOWED_EXTENSIONS,
    DELIMITER_CANDIDATES,
    MAX_CELL_CHARS,
    MAX_COLUMNS,
    MAX_FILE_BYTES,
    MAX_HEADER_CHARS,
    MAX_ROWS,
)
from .errors import ApiError


@dataclass
class ParsedCsv:
    columns: list[str]
    rows: list[list[str]]
    delimiter: str
    encoding: str
    ragged_rows: int
    skipped_blank_rows: int
    renamed_headers: int


def _decode(raw: bytes) -> tuple[str, str]:
    if not raw.strip():
        raise ApiError(400, "empty_file", "The file is empty.")
    if b"\x00" in raw:
        raise ApiError(400, "not_text", "The file contains binary data and does not look like a CSV file.")
    try:
        if raw.startswith(codecs.BOM_UTF8):
            return raw[len(codecs.BOM_UTF8):].decode("utf-8"), "UTF-8 with BOM"
        return raw.decode("utf-8"), "UTF-8"
    except UnicodeDecodeError:
        raise ApiError(
            400, "bad_encoding",
            "The file is not valid UTF-8. Re-save it as 'CSV UTF-8' from your spreadsheet app and try again.",
        )


def _detect_delimiter(text: str) -> str:
    sample = text[:20_000]
    best, best_score = ",", (0.0, 0)
    for candidate in DELIMITER_CANDIDATES:
        try:
            records = list(itertools.islice(csv.reader(io.StringIO(sample, newline=""), delimiter=candidate), 30))
        except csv.Error:
            continue
        widths = [len(r) for r in records if r]
        if not widths or widths[0] < 2:
            continue
        consistent = sum(1 for w in widths if w == widths[0]) / len(widths)
        score = (consistent, widths[0])
        if score > best_score:
            best, best_score = candidate, score
    return best


def _clean_headers(header: list[str]) -> tuple[list[str], int]:
    names: list[str] = []
    seen: dict[str, int] = {}
    renamed = 0
    for i, cell in enumerate(header):
        name = cell.strip()
        if len(name) > MAX_HEADER_CHARS:
            raise ApiError(400, "not_csv", "The first row is too long to be a header row. Is this a CSV file?")
        if not name:
            name, renamed = f"column_{i + 1}", renamed + 1
        if name in seen:
            seen[name] += 1
            name, renamed = f"{name}_{seen[name]}", renamed + 1
        else:
            seen[name] = 1
        names.append(name)
    return names, renamed


def parse_csv(raw: bytes, file_name: str) -> ParsedCsv:
    if not file_name.lower().endswith(ALLOWED_EXTENSIONS):
        raise ApiError(400, "unsupported_type", "Only .csv or .tsv files are supported.")
    if len(raw) > MAX_FILE_BYTES:
        raise ApiError(413, "file_too_large", f"The file is larger than the {MAX_FILE_BYTES // (1024 * 1024)} MB limit.")

    text, encoding = _decode(raw)
    delimiter = _detect_delimiter(text)
    csv.field_size_limit(MAX_CELL_CHARS)

    header: list[str] | None = None
    rows: list[list[str]] = []
    ragged = blank = 0
    try:
        for record in csv.reader(io.StringIO(text, newline=""), delimiter=delimiter):
            if not any(cell.strip() for cell in record):
                if header is not None:
                    blank += 1
                continue
            if header is None:
                if len(record) > MAX_COLUMNS:
                    raise ApiError(413, "too_many_columns", f"The file has more than {MAX_COLUMNS} columns.")
                header = record
                continue
            if len(rows) >= MAX_ROWS:
                raise ApiError(413, "too_many_rows", f"The file has more than {MAX_ROWS:,} rows.")
            width = len(header)
            if len(record) != width:
                ragged += 1
                record = record[:width] + [""] * (width - len(record))
            rows.append(record)
    except csv.Error:
        raise ApiError(
            400, "malformed_csv",
            "The file could not be read as CSV. Check for unbalanced quotes, very large cells, or an unsupported format.",
        )

    if header is None:
        raise ApiError(400, "empty_file", "The file contains no data.")
    if not rows:
        raise ApiError(400, "no_rows", "The file has a header row but no data rows.")

    columns, renamed = _clean_headers(header)
    return ParsedCsv(columns, rows, delimiter, encoding, ragged, blank, renamed)
