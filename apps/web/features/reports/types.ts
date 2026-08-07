export type ReportCategory = "production" | "reproduction" | "health" | "financial" | "combined";
export type ReportFormat = "pdf" | "csv";
export type ReportParamKey =
  | "date"
  | "month"
  | "year"
  | "shedId"
  | "cattleId"
  | "lactationId"
  | "fromDate"
  | "toDate"
  | "status"
  | "search"
  | "category";

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  formats: ReportFormat[];
  frequency: "on_demand";
  version: "MVP";
  params: ReportParamKey[];
  last_generated: string | null;
}

export interface ReportCategoryGroup {
  category: ReportCategory;
  reports: ReportDef[];
}

export interface ReportCatalogue {
  report_categories: ReportCategoryGroup[];
}

export type ReportJobStatus = "queued" | "generating" | "completed" | "failed";

export interface ReportJob {
  job_id: string;
  report_id: string;
  status: ReportJobStatus;
  format: ReportFormat;
  file_name: string | null;
  byte_size: number | null;
  error: string | null;
  download_url: string | null;
  expires_at: string | null;
}

export interface GenerateReportResult {
  job_id: string;
  status: "queued";
  estimated_seconds: number;
}

export type ReportScheduleFrequency = "daily" | "weekly" | "monthly";

export interface ReportSchedule {
  id: string;
  report_id: string;
  format: ReportFormat;
  frequency: ReportScheduleFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  is_active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
}
