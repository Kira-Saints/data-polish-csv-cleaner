"""Column type inference and data-quality observations for the preview."""

from .config import PREVIEW_ROWS
from .models import ColumnInfo, Observation, PreviewResponse
from .parsing import ParsedCsv
from .rules import email_domain, is_missing, parse_date, parse_number

_THRESHOLD = 0.6
_SAMPLE = 1000
_DELIMITER_NAMES = {",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe"}


def infer_type(values: list[str]) -> str:
    present = [v for v in values if not is_missing(v)][:_SAMPLE]
    if not present:
        return "empty"
    n = len(present)
    if sum(1 for v in present if email_domain(v)) / n >= _THRESHOLD:
        return "email"
    if sum(1 for v in present if parse_number(v) is not None) / n >= _THRESHOLD:
        return "number"
    if sum(1 for v in present if parse_date(v).status != "invalid") / n >= _THRESHOLD:
        return "date"
    return "text"


def column_infos(columns: list[str], rows: list[list[str]]) -> list[ColumnInfo]:
    infos = []
    for i, name in enumerate(columns):
        values = [row[i] for row in rows]
        infos.append(ColumnInfo(
            name=name,
            type=infer_type(values),
            missing_count=sum(1 for v in values if is_missing(v)),
        ))
    return infos


def count_duplicate_rows(rows: list[list[str]]) -> int:
    seen: set[tuple[str, ...]] = set()
    dupes = 0
    for row in rows:
        key = tuple(row)
        if key in seen:
            dupes += 1
        else:
            seen.add(key)
    return dupes


def _observations(parsed: ParsedCsv, infos: list[ColumnInfo], dupes: int) -> list[Observation]:
    obs: list[Observation] = []
    if parsed.ragged_rows:
        obs.append(Observation(level="warning", message=f"{parsed.ragged_rows} row(s) had a different number of fields than the header and were padded or trimmed."))
    if parsed.skipped_blank_rows:
        obs.append(Observation(level="info", message=f"{parsed.skipped_blank_rows} completely blank row(s) were ignored."))
    if parsed.renamed_headers:
        obs.append(Observation(level="info", message=f"{parsed.renamed_headers} empty or repeated header(s) were given unique names."))
    if dupes:
        obs.append(Observation(level="warning", message=f"{dupes} exact duplicate row(s) found."))

    missing_total = sum(c.missing_count for c in infos)
    if missing_total:
        cols = sum(1 for c in infos if c.missing_count)
        obs.append(Observation(level="warning", message=f"{missing_total} missing or blank value(s) across {cols} column(s)."))

    padded = sum(1 for row in parsed.rows for cell in row if cell != cell.strip())
    if padded:
        obs.append(Observation(level="info", message=f"{padded} cell(s) have leading or trailing whitespace."))

    for i, info in enumerate(infos):
        values = [row[i] for row in parsed.rows if not is_missing(row[i])]
        if info.type == "email":
            bad = sum(1 for v in values if email_domain(v) is None)
            if bad:
                obs.append(Observation(level="warning", message=f'{bad} malformed email value(s) in "{info.name}".'))
        elif info.type == "number":
            bad = sum(1 for v in values if parse_number(v) is None)
            if bad:
                obs.append(Observation(level="warning", message=f'{bad} value(s) in "{info.name}" are not valid numbers.'))
        elif info.type == "date":
            results = [parse_date(v).status for v in values]
            ambiguous, invalid = results.count("ambiguous"), results.count("invalid")
            if ambiguous:
                obs.append(Observation(level="warning", message=f'{ambiguous} ambiguous date(s) in "{info.name}" (day/month order unclear).'))
            if invalid:
                obs.append(Observation(level="warning", message=f'{invalid} unreadable date(s) in "{info.name}".'))
    if not obs:
        obs.append(Observation(level="info", message="No obvious data-quality problems were detected."))
    return obs


def build_preview(parsed: ParsedCsv, file_name: str, size_bytes: int) -> PreviewResponse:
    infos = column_infos(parsed.columns, parsed.rows)
    dupes = count_duplicate_rows(parsed.rows)
    return PreviewResponse(
        file_name=file_name,
        size_bytes=size_bytes,
        delimiter=_DELIMITER_NAMES.get(parsed.delimiter, parsed.delimiter),
        encoding=parsed.encoding,
        row_count=len(parsed.rows),
        column_count=len(parsed.columns),
        duplicate_row_count=dupes,
        columns=infos,
        preview_rows=parsed.rows[:PREVIEW_ROWS],
        preview_row_limit=PREVIEW_ROWS,
        observations=_observations(parsed, infos, dupes),
    )
