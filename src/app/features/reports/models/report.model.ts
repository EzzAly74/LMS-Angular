/**
 * The NAS reports API (backend D-112): GET admin/reports, GET admin/reports/{key},
 * GET admin/reports/options/{source}, GET admin/reports/{key}/export.
 */

export type ReportColumnType = 'text' | 'number' | 'percent' | 'date' | 'datetime' | 'yes_no';

export interface ReportColumn {
  readonly key: string;
  readonly label: string;
  readonly group: string;
  readonly group_label: string;
  readonly type: ReportColumnType;
  /** False for a field the system does not capture yet: the column stays, empty. */
  readonly available: boolean;
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
  readonly required: boolean;
  /** Narrowed by the values of this other filter (cohorts by course). */
  readonly depends_on: string | null;
  /** Fixed choices of a status filter. */
  readonly options: readonly ReportFilterOption[];
}

export interface ReportDefinition {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly row_unit: string;
  readonly columns: readonly ReportColumn[];
  readonly filters: readonly ReportFilter[];
  readonly last_exported_at: string | null;
}

export type ReportCell = string | number | boolean | null;

export type ReportRow = Readonly<Record<string, ReportCell>>;

export interface ReportPage {
  readonly columns: readonly ReportColumn[];
  readonly rows: readonly ReportRow[];
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
