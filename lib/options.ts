import type { ColumnInfo, PreviewResponse, ProcessPayload, TransformOp } from "./types";

export type CaseMode = "none" | "lower" | "upper" | "title";

export interface ColumnConfigState {
  name: string;
  newName: string;
  keep: boolean;
}

export interface CleaningState {
  trimWhitespace: boolean;
  collapseSpaces: boolean;
  caseModes: Record<string, CaseMode>;
  emailColumns: string[];
  dateColumns: string[];
  dateOutputFormat: "iso" | "us" | "eu";
  ambiguousDates: "leave" | "mdy" | "dmy";
  numberColumns: string[];
  decimalPlaces: string;
  fillEnabled: boolean;
  fillColumns: string[];
  fillValue: string;
  removeDuplicates: boolean;
  columns: ColumnConfigState[];
}

export interface KeywordRuleState {
  id: string;
  keyword: string;
  category: string;
}

export interface TransformState {
  id: string;
  operation: TransformOp;
  sourceColumn: string;
  outputColumn: string;
}

export interface EnrichmentState {
  emailEnabled: boolean;
  emailSource: string;
  addDomain: boolean;
  addCategory: boolean;
  fullNameEnabled: boolean;
  firstColumn: string;
  lastColumn: string;
  fullNameOutput: string;
  keywordEnabled: boolean;
  keywordSource: string;
  keywordOutput: string;
  keywordDefault: string;
  keywordRules: KeywordRuleState[];
  transforms: TransformState[];
}

let counter = 0;
export function nextId(): string {
  counter += 1;
  return `item-${counter}`;
}

const namesOfType = (columns: ColumnInfo[], type: ColumnInfo["type"]) =>
  columns.filter((c) => c.type === type).map((c) => c.name);

export function initialCleaningState(preview: PreviewResponse): CleaningState {
  const caseModes: Record<string, CaseMode> = {};
  preview.columns.forEach((c) => {
    caseModes[c.name] = "none";
  });
  return {
    trimWhitespace: true,
    collapseSpaces: false,
    caseModes,
    emailColumns: namesOfType(preview.columns, "email"),
    dateColumns: namesOfType(preview.columns, "date"),
    dateOutputFormat: "iso",
    ambiguousDates: "leave",
    numberColumns: namesOfType(preview.columns, "number"),
    decimalPlaces: "",
    fillEnabled: false,
    fillColumns: preview.columns.filter((c) => c.missing_count > 0).map((c) => c.name),
    fillValue: "",
    removeDuplicates: preview.duplicate_row_count > 0,
    columns: preview.columns.map((c) => ({ name: c.name, newName: "", keep: true })),
  };
}

export function initialEnrichmentState(preview: PreviewResponse): EnrichmentState {
  const names = preview.columns.map((c) => c.name);
  const email = preview.columns.find((c) => c.type === "email")?.name ?? "";
  const first = names.find((n) => /first/i.test(n)) ?? "";
  const last = names.find((n) => /last|sur/i.test(n)) ?? "";
  return {
    emailEnabled: email !== "",
    emailSource: email || names[0] || "",
    addDomain: true,
    addCategory: true,
    fullNameEnabled: first !== "" && last !== "",
    firstColumn: first || names[0] || "",
    lastColumn: last || names[0] || "",
    fullNameOutput: "full_name",
    keywordEnabled: false,
    keywordSource: names.find((n) => /note|comment|desc|message|text/i.test(n)) ?? names[0] ?? "",
    keywordOutput: "category",
    keywordDefault: "Other",
    keywordRules: [
      { id: nextId(), keyword: "refund", category: "Billing" },
      { id: nextId(), keyword: "invoice", category: "Billing" },
      { id: nextId(), keyword: "crash", category: "Bug" },
      { id: nextId(), keyword: "how do i", category: "Question" },
    ],
    transforms: [],
  };
}

export function buildPayload(c: CleaningState, e: EnrichmentState): ProcessPayload {
  const places = c.decimalPlaces.trim();
  const rules = e.keywordRules
    .map((r) => ({ keyword: r.keyword.trim(), category: r.category.trim() }))
    .filter((r) => r.keyword && r.category);

  return {
    cleaning: {
      trim_whitespace: c.trimWhitespace,
      collapse_spaces: c.collapseSpaces,
      case_rules: Object.entries(c.caseModes)
        .filter(([, mode]) => mode !== "none")
        .map(([column, mode]) => ({ column, mode: mode as "lower" | "upper" | "title" })),
      email_columns: c.emailColumns,
      date_columns: c.dateColumns,
      date_output_format: c.dateOutputFormat,
      ambiguous_dates: c.ambiguousDates,
      number_columns: c.numberColumns,
      decimal_places: places === "" ? null : Math.max(0, Math.min(6, Math.floor(Number(places)) || 0)),
      fill_missing:
        c.fillEnabled && c.fillColumns.length > 0 && c.fillValue !== ""
          ? { columns: c.fillColumns, value: c.fillValue }
          : null,
      remove_duplicates: c.removeDuplicates,
      columns: c.columns.map((col) => {
        const renamed = col.newName.trim();
        return { name: col.name, new_name: renamed && renamed !== col.name ? renamed : null, keep: col.keep };
      }),
    },
    enrichment: {
      email:
        e.emailEnabled && e.emailSource && (e.addDomain || e.addCategory)
          ? { source_column: e.emailSource, add_domain: e.addDomain, add_provider_category: e.addCategory }
          : null,
      full_name:
        e.fullNameEnabled && e.firstColumn && e.lastColumn && e.fullNameOutput.trim()
          ? {
              first_name_column: e.firstColumn,
              last_name_column: e.lastColumn,
              output_column: e.fullNameOutput.trim(),
            }
          : null,
      keyword_categories:
        e.keywordEnabled && e.keywordSource && rules.length > 0 && e.keywordOutput.trim()
          ? {
              source_column: e.keywordSource,
              output_column: e.keywordOutput.trim(),
              rules,
              default_category: e.keywordDefault.trim() || "Uncategorized",
            }
          : null,
      transformations: e.transforms
        .filter((t) => t.sourceColumn && t.outputColumn.trim())
        .map((t) => ({
          operation: t.operation,
          source_column: t.sourceColumn,
          output_column: t.outputColumn.trim(),
        })),
    },
  };
}
