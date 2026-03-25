export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  max_days_per_year?: number;
}

export interface LeaveRequest {
  id: number;
  employee: number;
  employee_name?: string;
  leave_type: number;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason?: string;
  status: LeaveStatus;
  created_at: string;
  reviewed_at?: string;
  reviewer_comment?: string;
}

export interface LeaveBalance {
  id: number;
  employee: number;
  leave_type: number;
  leave_type_name?: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
}
