export type ColumnType = "text" | "number" | "date" | "email" | "empty";

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  missing_count: number;
}

export interface Observation {
  level: "info" | "warning";
  message: string;
}

export interface PreviewResponse {
  file_name: string;
  size_bytes: number;
  delimiter: string;
  encoding: string;
  row_count: number;
  column_count: number;
  duplicate_row_count: number;
  columns: ColumnInfo[];
  preview_rows: string[][];
  preview_row_limit: number;
  observations: Observation[];
}

export interface SampleResponse {
  file_name: string;
  csv: string;
}

export interface OperationCount {
  label: string;
  count: number;
}

export interface Issue {
  kind: "invalid_email" | "invalid_date" | "ambiguous_date" | "invalid_number";
  column: string;
  count: number;
  examples: string[];
}

export interface EmailStats {
  checked: number;
  changed: number;
  malformed: number;
}

export interface DateStats {
  checked: number;
  normalized: number;
  already_standard: number;
  resolved_by_rule: number;
  ambiguous: number;
  invalid: number;
}

export interface NumberStats {
  checked: number;
  normalized: number;
  already_standard: number;
  invalid: number;
}

export interface MissingColumn {
  column: string;
  original_missing: number;
  filled: number;
  remaining: number;
}

export interface RenamedColumn {
  original: string;
  renamed_to: string;
}

export interface EnrichmentSummary {
  label: string;
  columns_added: string[];
  details: OperationCount[];
}

export interface Report {
  original_rows: number;
  cleaned_rows: number;
  original_columns: number;
  final_columns: number;
  duplicate_rows_detected: number;
  duplicate_rows_removed: number;
  malformed_emails_detected: number;
  values_changed: number;
  invalid_dates: number;
  ambiguous_dates: number;
  invalid_numbers: number;
  missing_by_column: MissingColumn[];
  operations: OperationCount[];
  emails: EmailStats;
  dates: DateStats;
  numbers: NumberStats;
  issues: Issue[];
  columns_renamed: RenamedColumn[];
  columns_removed: string[];
  columns_added: string[];
  columns_reordered: boolean;
  enrichment: EnrichmentSummary[];
  no_changes: boolean;
}

export interface ProcessResponse {
  columns: ColumnInfo[];
  preview_rows: string[][];
  preview_row_limit: number;
  report: Report;
  csv: string;
  csv_file_name: string;
  formula_protected_cells: number;
}

// ---- Request payload sent to POST /api/process (as JSON in the "options" form field)
export interface ProcessPayload {
  cleaning: {
    trim_whitespace: boolean;
    collapse_spaces: boolean;
    case_rules: { column: string; mode: "lower" | "upper" | "title" }[];
    email_columns: string[];
    date_columns: string[];
    date_output_format: "iso" | "us" | "eu";
    ambiguous_dates: "leave" | "mdy" | "dmy";
    number_columns: string[];
    decimal_places: number | null;
    fill_missing: { columns: string[]; value: string } | null;
    remove_duplicates: boolean;
    columns: { name: string; new_name: string | null; keep: boolean }[];
  };
  enrichment: {
    email: { source_column: string; add_domain: boolean; add_provider_category: boolean } | null;
    full_name: { first_name_column: string; last_name_column: string; output_column: string } | null;
    keyword_categories: {
      source_column: string;
      output_column: string;
      rules: { keyword: string; category: string }[];
      default_category: string;
    } | null;
    transformations: { operation: TransformOp; source_column: string; output_column: string }[];
  };
}

export type TransformOp =
  | "text_length"
  | "word_count"
  | "first_word"
  | "last_word"
  | "initials"
  | "extract_year";
