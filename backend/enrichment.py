"""Local, offline enrichment. No network calls, no eval/exec.

Email provider category rule (documented in the README):
  personal -> domain is on the built-in list of common free mailbox providers
  business -> domain is on the small built-in list of well-known company domains
  other    -> reserved example/test domains and .edu / .gov / .mil institutions
  unknown  -> anything else (we cannot categorise it confidently)
"""

from collections import Counter
from dataclasses import dataclass

from .models import EnrichmentOptions, EnrichmentSummary, OperationCount
from .rules import email_domain, is_missing, parse_date

PERSONAL_DOMAINS = frozenset({
    "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com",
    "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me",
    "protonmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com",
})
BUSINESS_DOMAINS = frozenset({
    "google.com", "microsoft.com", "amazon.com", "apple.com", "ibm.com", "oracle.com",
    "salesforce.com", "adobe.com", "cisco.com", "intel.com", "meta.com", "netflix.com",
})
RESERVED_DOMAINS = ("example.com", "example.org", "example.net")
OTHER_SUFFIXES = (".example", ".test", ".invalid", ".localhost", ".edu", ".gov", ".mil")


def categorize_domain(domain: str) -> str:
    if domain in PERSONAL_DOMAINS:
        return "personal"
    if domain in BUSINESS_DOMAINS:
        return "business"
    if any(domain == d or domain.endswith("." + d) for d in RESERVED_DOMAINS) or domain.endswith(OTHER_SUFFIXES):
        return "other"
    return "unknown"


def _initials(s: str) -> str:
    return "".join(w[0].upper() for w in s.split() if w[:1].isalnum())


def _year(s: str) -> str:
    result = parse_date(s)
    return str(result.value.year) if result.status == "ok" and result.value else ""


def _word(s: str, last: bool) -> str:
    parts = s.split()
    return parts[-1 if last else 0] if parts else ""


TRANSFORMS = {
    "text_length": lambda s: str(len(s.strip())),
    "word_count": lambda s: str(len(s.split())),
    "first_word": lambda s: _word(s, False),
    "last_word": lambda s: _word(s, True),
    "initials": _initials,
    "extract_year": _year,
}

TRANSFORM_LABELS = {
    "text_length": "Text length",
    "word_count": "Word count",
    "first_word": "First word",
    "last_word": "Last word",
    "initials": "Initials",
    "extract_year": "Year from date",
}


@dataclass
class NewColumn:
    name: str
    values: list[str]


def build_enrichment(
    columns: list[str], rows: list[list[str]], opts: EnrichmentOptions
) -> tuple[list[NewColumn], list[EnrichmentSummary]]:
    idx = {name: i for i, name in enumerate(columns)}
    new_cols: list[NewColumn] = []
    summaries: list[EnrichmentSummary] = []

    if opts.email and (opts.email.add_domain or opts.email.add_provider_category):
        e, i = opts.email, idx[opts.email.source_column]
        domains: list[str] = []
        cats: list[str] = []
        valid = invalid = blank = 0
        counts: Counter[str] = Counter()
        for row in rows:
            raw = row[i]
            if is_missing(raw):
                blank += 1
                domains.append("")
                cats.append("")
                continue
            domain = email_domain(raw)
            if domain is None:
                invalid += 1
                domains.append("")
                cats.append("")
                continue
            valid += 1
            category = categorize_domain(domain)
            counts[category] += 1
            domains.append(domain)
            cats.append(category)
        added = []
        details = [
            OperationCount(label="Valid addresses processed", count=valid),
            OperationCount(label="Invalid addresses (left empty)", count=invalid),
            OperationCount(label="Missing addresses (left empty)", count=blank),
        ]
        if e.add_domain:
            new_cols.append(NewColumn(e.domain_column, domains))
            added.append(e.domain_column)
        if e.add_provider_category:
            new_cols.append(NewColumn(e.category_column, cats))
            added.append(e.category_column)
            for label in ("personal", "business", "other", "unknown"):
                details.append(OperationCount(label=f"Provider type: {label}", count=counts.get(label, 0)))
        summaries.append(EnrichmentSummary(label="Email domain and provider type", columns_added=added, details=details))

    if opts.full_name:
        f = opts.full_name
        fi, li = idx[f.first_name_column], idx[f.last_name_column]
        values = []
        for row in rows:
            parts = [("" if is_missing(row[k]) else " ".join(row[k].split())) for k in (fi, li)]
            values.append(" ".join(p for p in parts if p))
        made = sum(1 for v in values if v)
        new_cols.append(NewColumn(f.output_column, values))
        summaries.append(EnrichmentSummary(
            label="Full name",
            columns_added=[f.output_column],
            details=[OperationCount(label="Names generated", count=made),
                     OperationCount(label="Empty (both parts missing)", count=len(values) - made)],
        ))

    if opts.keyword_categories:
        k, i = opts.keyword_categories, idx[opts.keyword_categories.source_column]
        rules = [(r.keyword.strip().lower(), r.category.strip()) for r in k.rules if r.keyword.strip() and r.category.strip()]
        values = []
        counts = Counter()
        defaulted = 0
        for row in rows:
            text = row[i].lower()
            match = next((cat for kw, cat in rules if kw in text), None)
            if match is None:
                defaulted += 1
                values.append(k.default_category)
            else:
                counts[match] += 1
                values.append(match)
        details = [OperationCount(label=f"Matched: {c}", count=n) for c, n in counts.items()]
        details.append(OperationCount(label=f"Default ({k.default_category})", count=defaulted))
        new_cols.append(NewColumn(k.output_column, values))
        summaries.append(EnrichmentSummary(label="Keyword categories", columns_added=[k.output_column], details=details))

    for t in opts.transformations:
        i = idx[t.source_column]
        fn = TRANSFORMS[t.operation]
        values = [fn(row[i]) for row in rows]
        made = sum(1 for v in values if v != "")
        new_cols.append(NewColumn(t.output_column, values))
        summaries.append(EnrichmentSummary(
            label=f"{TRANSFORM_LABELS[t.operation]} from \"{t.source_column}\"",
            columns_added=[t.output_column],
            details=[OperationCount(label="Values produced", count=made),
                     OperationCount(label="Empty results", count=len(values) - made)],
        ))

    return new_cols, summaries
