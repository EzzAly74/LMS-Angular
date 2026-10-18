/**
 * The NAS reports API (backend D-112): GET admin/reports, GET admin/reports/{key}?preview=1,
 * GET admin/reports/options/{source}, GET admin/reports/{key}/export, GET admin/reports/export-all.
 */

export type ReportColumnType = 'text' | 'number' | 'percent' | 'date' | 'datetime' | 'yes_no';

/** One spec column (the export's columns). */
export interface ReportColumn {
  readonly key: string;
  readonly label: string;
  readonly group: string;
  readonly group_label: string;
  readonly type: ReportColumnType;
}

export type ReportTone = 'success' | 'warning' | 'danger' | 'neutral';

/** One column of the on-screen preview (Figma 2201:82041). */
export interface ReportPreviewColumn {
  readonly key: string;
  readonly label: string;
  readonly type: ReportColumnType | 'status';
  /** Shown in the heavier weight (the row's name, the main figure). */
  readonly strong: boolean;
  /** Status badges: the tone of each value. */
  readonly tones: readonly { readonly label: string; readonly tone: ReportTone }[];
}

export type ReportFilterType = 'multi' | 'select' | 'status' | 'date_range' | 'date' | 'number';

export interface ReportFilterOption {
  readonly id: string | number;
  readonly label: string;
}

export interface ReportFilter {
  readonly key: string;
  readonly label: string;
  readonly type: ReportFilterType;
  /** Option source for multi / select filters (GET admin/reports/options/{source}). */
  readonly source: string | null;
  /** A choice the report always has (the evaluation template); the server picks a default. */
  readonly required: boolean;
  /** Narrowed by the values of this other filter (cohorts by course). */
  readonly depends_on: string | null;
  /** Fixed choices of a status filter. */
  readonly options: readonly ReportFilterOption[];
  /** A date range's two field labels ("Start Date" / "End Date"). */
  readonly range_labels: { readonly from: string; readonly to: string } | null;
}

export interface ReportDefinition {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** The report page's subtitle. */
  readonly page_description: string;
  readonly row_unit: string;
  readonly columns: readonly ReportColumn[];
  readonly filters: readonly ReportFilter[];
  readonly last_exported_at: string | null;
}

export type ReportCell = string | number | boolean | null;

export type ReportRow = Readonly<Record<string, ReportCell>>;

export interface ReportPage {
  readonly columns: readonly ReportPreviewColumn[];
  readonly rows: readonly ReportRow[];
  /** The filters the server applied, defaults included (the template). */
  readonly filters: ReportFilterParams;
  readonly total: number;
  readonly current_page: number;
  readonly per_page: number;
  readonly last_page: number;
}

export type ReportFormat = 'xlsx' | 'csv';

/** A menu choice as an export format, or null. */
export function asFormat(value: string): ReportFormat | null {
  return value === 'xlsx' || value === 'csv' ? value : null;
}

/** Applied filter values, keyed as the API takes them (`{key}_from` / `{key}_to` for ranges). */
export type ReportFilterParams = Readonly<Record<string, string | number | readonly (string | number)[]>>;
