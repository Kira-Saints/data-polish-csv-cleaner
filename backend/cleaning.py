"""Cleaning operations applied to in-memory rows.

Order of operations: whitespace -> text case -> emails -> dates -> numbers ->
missing-value fill -> duplicates. Column management and enrichment run later.
"""

import re
from collections import defaultdict
from dataclasses import dataclass, field

from .models import CleaningOptions, DateStats, EmailStats, Issue, NumberStats
from .rules import (
    email_domain,
    format_date,
    format_number,
    is_missing,
    parse_date,
    parse_number,
)

_COLLAPSE = re.compile(r"[^\S\r\n]{2,}")
_WORD = re.compile(r"[^\W\d_]+")


def _collapse(s: str) -> str:
    return _COLLAPSE.sub(" ", s)


def _title(s: str) -> str:
    return _WORD.sub(lambda m: m.group(0)[0].upper() + m.group(0)[1:].lower(), s)


_CASE_FUNCS = {"lower": str.lower, "upper": str.upper, "title": _title}


class IssueTracker:
    def __init__(self) -> None:
        self._data: dict[tuple[str, str], list] = {}

    def add(self, kind: str, column: str, value: str) -> None:
        entry = self._data.setdefault((kind, column), [0, []])
        entry[0] += 1
        shown = value.strip()[:60]
        if len(entry[1]) < 5 and shown not in entry[1]:
            entry[1].append(shown)

    def to_list(self) -> list[Issue]:
        return [Issue(kind=k, column=c, count=v[0], examples=v[1]) for (k, c), v in self._data.items()]


@dataclass
class CleaningResult:
    rows: list[list[str]]
    original_index: list[int]
    ops: dict[str, int]
    emails: EmailStats
    dates: DateStats
    numbers: NumberStats
    issues: IssueTracker
    duplicates_detected: int
    duplicates_removed: int
    filled_by_column: dict[str, int] = field(default_factory=dict)


def clean_table(columns: list[str], rows: list[list[str]], opts: CleaningOptions) -> CleaningResult:
    idx = {name: i for i, name in enumerate(columns)}
    work = [list(r) for r in rows]
    ops: dict[str, int] = defaultdict(int)
    tracker = IssueTracker()
    emails, dates, numbers = EmailStats(), DateStats(), NumberStats()

    def apply(indexes, fn, key: str) -> None:
        for row in work:
            for i in indexes:
                new = fn(row[i])
                if new != row[i]:
                    row[i] = new
                    ops[key] += 1

    everything = range(len(columns))
    if opts.trim_whitespace:
        apply(everything, str.strip, "trim")
    if opts.collapse_spaces:
        apply(everything, _collapse, "collapse")
    for rule in opts.case_rules:
        apply([idx[rule.column]], _CASE_FUNCS[rule.mode], "case")

    for name in opts.email_columns:
        i = idx[name]
        for row in work:
            raw = row[i]
            if is_missing(raw):
                continue
            emails.checked += 1
            normalized = raw.strip().lower()
            if normalized != raw:
                row[i] = normalized
                emails.changed += 1
            if email_domain(normalized) is None:
                emails.malformed += 1
                tracker.add("invalid_email", name, normalized)

    for name in opts.date_columns:
        i = idx[name]
        for row in work:
            raw = row[i]
            if is_missing(raw):
                continue
            dates.checked += 1
            result = parse_date(raw, opts.ambiguous_dates)
            if result.status == "ok" and result.value is not None:
                if result.resolved:
                    dates.resolved_by_rule += 1
                new = format_date(result.value, opts.date_output_format)
                if new != raw:
                    row[i] = new
                    dates.normalized += 1
                else:
                    dates.already_standard += 1
            elif result.status == "ambiguous":
                dates.ambiguous += 1
                tracker.add("ambiguous_date", name, raw)
            else:
                dates.invalid += 1
                tracker.add("invalid_date", name, raw)

    for name in opts.number_columns:
        i = idx[name]
        for row in work:
            raw = row[i]
            if is_missing(raw):
                continue
            numbers.checked += 1
            parsed = parse_number(raw)
            if parsed is None:
                numbers.invalid += 1
                tracker.add("invalid_number", name, raw)
                continue
            new = format_number(parsed, opts.decimal_places)
            if new != raw:
                row[i] = new
                numbers.normalized += 1
            else:
                numbers.already_standard += 1

    filled: dict[str, int] = {}
    if opts.fill_missing:
        for name in opts.fill_missing.columns:
            i, count = idx[name], 0
            for row in work:
                if is_missing(row[i]):
                    row[i] = opts.fill_missing.value
                    count += 1
            filled[name] = count

    seen: set[tuple[str, ...]] = set()
    kept_rows: list[list[str]] = []
    kept_index: list[int] = []
    detected = 0
    for n, row in enumerate(work):
        key = tuple(row)
        if key in seen:
            detected += 1
            if opts.remove_duplicates:
                continue
        else:
            seen.add(key)
        kept_rows.append(row)
        kept_index.append(n)

    return CleaningResult(
        rows=kept_rows,
        original_index=kept_index,
        ops=dict(ops),
        emails=emails,
        dates=dates,
        numbers=numbers,
        issues=tracker,
        duplicates_detected=detected,
        duplicates_removed=detected if opts.remove_duplicates else 0,
        filled_by_column=filled,
    )
