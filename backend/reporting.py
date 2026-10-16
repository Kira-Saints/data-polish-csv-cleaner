"""Builds the data-quality report from actual processing results."""

from .cleaning import CleaningResult
from .models import (
    CleaningOptions,
    EnrichmentSummary,
    MissingColumn,
    OperationCount,
    RenamedColumn,
    Report,
)
from .rules import is_missing

_OP_LABELS = {
    "trim": "Cells trimmed of surrounding whitespace",
    "collapse": "Cells with repeated spaces collapsed",
    "case": "Cells with text case changed",
}


def missing_counts(columns: list[str], rows: list[list[str]]) -> dict[str, int]:
    return {name: sum(1 for row in rows if is_missing(row[i])) for i, name in enumerate(columns)}


def count_changed_values(
    original_rows: list[list[str]], cleaned: CleaningResult, n_columns: int
) -> int:
    changed = 0
    for new_row, source in zip(cleaned.rows, cleaned.original_index):
        old_row = original_rows[source]
        for i in range(n_columns):
            if new_row[i] != old_row[i]:
                changed += 1
    return changed


def build_report(
    *,
    columns: list[str],
    original_rows: list[list[str]],
    cleaned: CleaningResult,
    opts: CleaningOptions,
    final_column_count: int,
    renamed: list[RenamedColumn],
    removed: list[str],
    added: list[str],
    reordered: bool,
    enrichment: list[EnrichmentSummary],
) -> Report:
    original_missing = missing_counts(columns, original_rows)
    missing_report = []
    for name in columns:
        filled = cleaned.filled_by_column.get(name, 0)
        if original_missing[name] or filled:
            missing_report.append(MissingColumn(
                column=name,
                original_missing=original_missing[name],
                filled=filled,
                remaining=max(original_missing[name] - filled, 0),
            ))

    operations = [OperationCount(label=_OP_LABELS[k], count=v) for k, v in cleaned.ops.items() if k in _OP_LABELS]
    if cleaned.emails.checked:
        operations.append(OperationCount(label="Email addresses normalized", count=cleaned.emails.changed))
    if cleaned.dates.checked:
        operations.append(OperationCount(label="Dates normalized", count=cleaned.dates.normalized))
    if cleaned.numbers.checked:
        operations.append(OperationCount(label="Numbers normalized", count=cleaned.numbers.normalized))
    if opts.fill_missing:
        operations.append(OperationCount(label="Missing values filled", count=sum(cleaned.filled_by_column.values())))

    values_changed = count_changed_values(original_rows, cleaned, len(columns))
    rows_removed = cleaned.duplicates_removed
    no_changes = (
        values_changed == 0 and rows_removed == 0 and not renamed
        and not removed and not added and not reordered
    )

    return Report(
        original_rows=len(original_rows),
        cleaned_rows=len(cleaned.rows),
        original_columns=len(columns),
        final_columns=final_column_count,
        duplicate_rows_detected=cleaned.duplicates_detected,
        duplicate_rows_removed=cleaned.duplicates_removed,
        malformed_emails_detected=cleaned.emails.malformed,
        values_changed=values_changed,
        invalid_dates=cleaned.dates.invalid,
        ambiguous_dates=cleaned.dates.ambiguous,
        invalid_numbers=cleaned.numbers.invalid,
        missing_by_column=missing_report,
        operations=operations,
        emails=cleaned.emails,
        dates=cleaned.dates,
        numbers=cleaned.numbers,
        issues=cleaned.issues.to_list(),
        columns_renamed=renamed,
        columns_removed=removed,
        columns_added=added,
        columns_reordered=reordered,
        enrichment=enrichment,
        no_changes=no_changes,
    )
