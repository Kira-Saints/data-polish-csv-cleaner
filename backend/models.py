"""Pydantic models for requests (options) and responses."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from .config import MAX_COLUMNS

# Column names and new-column names: trimmed, non-empty, bounded.
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------------------- options
class CaseRule(StrictModel):
    column: Name
    mode: Literal["lower", "upper", "title"]


class MissingFill(StrictModel):
    columns: list[Name] = Field(min_length=1, max_length=MAX_COLUMNS)
    value: str = Field(min_length=1, max_length=500)


class ColumnConfig(StrictModel):
    name: Name
    new_name: Name | None = None
    keep: bool = True


class CleaningOptions(StrictModel):
    trim_whitespace: bool = False
    collapse_spaces: bool = False
    case_rules: list[CaseRule] = Field(default_factory=list, max_length=MAX_COLUMNS)
    email_columns: list[Name] = Field(default_factory=list, max_length=MAX_COLUMNS)
    date_columns: list[Name] = Field(default_factory=list, max_length=MAX_COLUMNS)
    date_output_format: Literal["iso", "us", "eu"] = "iso"
    ambiguous_dates: Literal["leave", "mdy", "dmy"] = "leave"
    number_columns: list[Name] = Field(default_factory=list, max_length=MAX_COLUMNS)
    decimal_places: int | None = Field(default=None, ge=0, le=6)
    fill_missing: MissingFill | None = None
    remove_duplicates: bool = False
    columns: list[ColumnConfig] | None = Field(default=None, max_length=MAX_COLUMNS)


class EmailEnrichment(StrictModel):
    source_column: Name
    add_domain: bool = True
    add_provider_category: bool = False
    domain_column: Name = "email_domain"
    category_column: Name = "email_provider_type"


class FullNameEnrichment(StrictModel):
    first_name_column: Name
    last_name_column: Name
    output_column: Name = "full_name"


class KeywordRule(StrictModel):
    keyword: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)


class KeywordCategorization(StrictModel):
    source_column: Name
    output_column: Name = "category"
    rules: list[KeywordRule] = Field(min_length=1, max_length=50)
    default_category: str = Field(default="Uncategorized", min_length=1, max_length=100)


TransformOperation = Literal[
    "text_length", "word_count", "first_word", "last_word", "initials", "extract_year"
]


class Transformation(StrictModel):
    operation: TransformOperation
    source_column: Name
    output_column: Name


class EnrichmentOptions(StrictModel):
    email: EmailEnrichment | None = None
    full_name: FullNameEnrichment | None = None
    keyword_categories: KeywordCategorization | None = None
    transformations: list[Transformation] = Field(default_factory=list, max_length=10)


class ProcessOptions(StrictModel):
    cleaning: CleaningOptions = Field(default_factory=CleaningOptions)
    enrichment: EnrichmentOptions = Field(default_factory=EnrichmentOptions)


# ------------------------------------------------------------------------- responses
class ColumnInfo(BaseModel):
    name: str
    type: Literal["text", "number", "date", "email", "empty"]
    missing_count: int


class Observation(BaseModel):
    level: Literal["info", "warning"]
    message: str


class PreviewResponse(BaseModel):
    file_name: str
    size_bytes: int
    delimiter: str
    encoding: str
    row_count: int
    column_count: int
    duplicate_row_count: int
    columns: list[ColumnInfo]
    preview_rows: list[list[str]]
    preview_row_limit: int
    observations: list[Observation]


class SampleResponse(BaseModel):
    file_name: str
    csv: str


class OperationCount(BaseModel):
    label: str
    count: int


class Issue(BaseModel):
    kind: Literal["invalid_email", "invalid_date", "ambiguous_date", "invalid_number"]
    column: str
    count: int
    examples: list[str]


class EmailStats(BaseModel):
    checked: int = 0
    changed: int = 0
    malformed: int = 0


class DateStats(BaseModel):
    checked: int = 0
    normalized: int = 0
    already_standard: int = 0
    resolved_by_rule: int = 0
    ambiguous: int = 0
    invalid: int = 0


class NumberStats(BaseModel):
    checked: int = 0
    normalized: int = 0
    already_standard: int = 0
    invalid: int = 0


class MissingColumn(BaseModel):
    column: str
    original_missing: int
    filled: int
    remaining: int


class RenamedColumn(BaseModel):
    original: str
    renamed_to: str


class EnrichmentSummary(BaseModel):
    label: str
    columns_added: list[str]
    details: list[OperationCount]


class Report(BaseModel):
    original_rows: int
    cleaned_rows: int
    original_columns: int
    final_columns: int
    duplicate_rows_detected: int
    duplicate_rows_removed: int
    malformed_emails_detected: int
    values_changed: int
    invalid_dates: int
    ambiguous_dates: int
    invalid_numbers: int
    missing_by_column: list[MissingColumn]
    operations: list[OperationCount]
    emails: EmailStats
    dates: DateStats
    numbers: NumberStats
    issues: list[Issue]
    columns_renamed: list[RenamedColumn]
    columns_removed: list[str]
    columns_added: list[str]
    columns_reordered: bool
    enrichment: list[EnrichmentSummary]
    no_changes: bool


class ProcessResponse(BaseModel):
    columns: list[ColumnInfo]
    preview_rows: list[list[str]]
    preview_row_limit: int
    report: Report
    csv: str
    csv_file_name: str
    formula_protected_cells: int
