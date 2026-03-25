export type AttendanceStatus = 'ok' | 'absent' | 'incomplete' | 'anomaly';

export interface DailyRecord {
  employee_id: number;
  matricule?: string | null;
  full_name?: string | null;
  department?: string | null;
  work_date: string;
  weekday_label?: string;
  in_time?: string | null;
  out_time?: string | null;
  worked_minutes?: number | null;
  expected_minutes?: number | null;
  late_minutes?: number | null;
  status: AttendanceStatus;
}

export interface DailyStatsResponse {
  date: string;
  weekday_label?: string;
  kpis: {
    present: number;
    absent: number;
    incomplete: number;
    anomalies: number;
    avg_late_minutes: number;
    total_overtime_minutes: number;
  };
  by_department: Array<{
    department: string;
    ok: number;
    absent: number;
    incomplete: number;
    anomaly: number;
  }>;
  late_top: Array<{ full_name: string; late_minutes: number; department?: string | null }>;
  records: DailyRecord[];
}

export interface PeriodEmployeeRow {
  employee_id: number;
  matricule?: string | null;
  full_name?: string | null;
  service?: string | null;
  worked_hours: number;
  expected_hours: number;
  delta_minutes: number;
  present_days?: number;
  absent_days?: number;
  total_late_minutes?: number;
}

export interface WeeklyStatsResponse {
  week: string;
  start?: string;
  end?: string;
  worked_minutes: number;
  expected_minutes: number;
  present_days: number;
  absent_days: number;
  by_employee: PeriodEmployeeRow[];
  top_absent: Array<{ full_name: string; count: number }>;
  top_late: Array<{ full_name: string; late_minutes: number }>;
}

export interface MonthlyStatsResponse {
  month: string;
  start?: string;
  end?: string;
  worked_minutes: number;
  expected_minutes: number;
  by_employee: PeriodEmployeeRow[];
  top_absent: Array<{ full_name: string; count: number }>;
  top_overtime: Array<{ full_name: string; overtime_minutes: number }>;
}
