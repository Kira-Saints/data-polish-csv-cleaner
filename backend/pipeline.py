"""Orchestrates validation, cleaning, enrichment, column management and export."""

from .cleaning import clean_table
from .config import MAX_OUTPUT_COLUMNS, MAX_RESPONSE_CSV_BYTES, PROCESSED_PREVIEW_ROWS
from .enrichment import build_enrichment
from .errors import ApiError
from .export import to_csv
from .models import ColumnConfig, ProcessOptions, ProcessResponse, RenamedColumn
from .parsing import ParsedCsv
from .profiling import column_infos
from .reporting import build_report


def _validate(opts: ProcessOptions, columns: list[str]) -> None:
    known = set(columns)

    def check(names: list[str], where: str) -> None:
        for name in names:
            if name not in known:
                raise ApiError(422, "unknown_column", f'{where}: column "{name[:60]}" does not exist in the uploaded file.')

    c, e = opts.cleaning, opts.enrichment
    check([r.column for r in c.case_rules], "Text case")
    check(c.email_columns, "Email columns")
    check(c.date_columns, "Date columns")
    check(c.number_columns, "Number columns")
    if c.fill_missing:
        check(c.fill_missing.columns, "Missing values")
    if c.columns is not None:
        names = [cfg.name for cfg in c.columns]
        check(names, "Column settings")
        if len(set(names)) != len(names) or set(names) != known:
            raise ApiError(422, "invalid_columns", "Column settings must list every column exactly once.")
    if e.email:
        check([e.email.source_column], "Email enrichment")
    if e.full_name:
        check([e.full_name.first_name_column, e.full_name.last_name_column], "Full name")
    if e.keyword_categories:
        check([e.keyword_categories.source_column], "Keyword categories")
        if not any(r.keyword.strip() and r.category.strip() for r in e.keyword_categories.rules):
            raise ApiError(422, "invalid_rules", "Keyword categories need at least one non-blank keyword and category.")
    check([t.source_column for t in e.transformations], "Transformations")


def run_pipeline(parsed: ParsedCsv, opts: ProcessOptions) -> ProcessResponse:
    columns = parsed.columns
    _validate(opts, columns)
    idx = {name: i for i, name in enumerate(columns)}

    cleaned = clean_table(columns, parsed.rows, opts.cleaning)
    new_cols, summaries = build_enrichment(columns, cleaned.rows, opts.enrichment)

    configs = opts.cleaning.columns or [ColumnConfig(name=name) for name in columns]
    kept = [cfg for cfg in configs if cfg.keep]
    final_names = [cfg.new_name or cfg.name for cfg in kept] + [nc.name for nc in new_cols]
    if not final_names:
        raise ApiError(422, "no_columns", "At least one column must remain in the output.")
    if len(final_names) > MAX_OUTPUT_COLUMNS:
        raise ApiError(422, "too_many_columns", f"The result would have more than {MAX_OUTPUT_COLUMNS} columns.")
    if len(set(final_names)) != len(final_names):
        raise ApiError(422, "duplicate_column_names", "Column names in the result must be unique. Check renamed columns and new enrichment columns.")

    kept_idx = [idx[cfg.name] for cfg in kept]
    final_rows = [
        [row[i] for i in kept_idx] + [nc.values[n] for nc in new_cols]
        for n, row in enumerate(cleaned.rows)
    ]

    csv_text, protected = to_csv(final_names, final_rows)
    if len(csv_text.encode("utf-8")) > MAX_RESPONSE_CSV_BYTES:
        raise ApiError(413, "result_too_large", "The processed CSV is too large to return in one response. Remove columns or upload a smaller file.")

    renamed = [RenamedColumn(original=cfg.name, renamed_to=cfg.new_name) for cfg in kept if cfg.new_name and cfg.new_name != cfg.name]
    removed = [cfg.name for cfg in configs if not cfg.keep]
    reordered = [cfg.name for cfg in kept] != [name for name in columns if name in {k.name for k in kept}]

    report = build_report(
        columns=columns,
        original_rows=parsed.rows,
        cleaned=cleaned,
        opts=opts.cleaning,
        final_column_count=len(final_names),
        renamed=renamed,
        removed=removed,
        added=[nc.name for nc in new_cols],
        reordered=reordered,
        enrichment=summaries,
    )
    return ProcessResponse(
        columns=column_infos(final_names, final_rows),
        preview_rows=final_rows[:PROCESSED_PREVIEW_ROWS],
        preview_row_limit=PROCESSED_PREVIEW_ROWS,
        report=report,
        csv=csv_text,
        csv_file_name="data-polish-cleaned.csv",
        formula_protected_cells=protected,
    )
