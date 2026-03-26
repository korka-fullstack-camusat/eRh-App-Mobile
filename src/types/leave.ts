export type LeaveStatus =
  | 'PENDING'
  | 'PENDING_SECOND'
  | 'PENDING_RH'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVOKED';

export interface LeaveType {
  id: number;
  code: string;
  label: string;
  name?: string;
  is_paid?: boolean;
  requires_justification?: boolean;
  max_days_per_request?: number;
  max_days_per_year?: number;
  monthly_accrual?: number;
  color?: string;
}

export interface LeaveRequest {
  id: number;
  employee: number;
  employee_name?: string;
  matricule?: string;
  service?: string;
  leave_type: number;
  leave_type_name?: string;
  leave_type_code?: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason?: string;
  motif?: string;
  status: LeaveStatus;
  created_at: string;
  // N+1 approval
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_comment?: string;
  // N+2 approval
  second_reviewer?: string;
  second_reviewed_at?: string;
  // HR validation
  hr_reviewer?: string;
  hr_reviewed_at?: string;
  // Rejection/Revocation
  reject_reason?: string;
  revoke_reason?: string;
  // Justification
  justification_document?: string;
  justification_validated?: boolean;
}

export interface LeaveBalance {
  id: number;
  employee: number;
  leave_type: number;
  leave_type_name?: string;
  leave_type_code?: string;
  year: number;
  acquired?: number;
  taken?: number;
  adjusted?: number;
  remaining?: number;
  // Backwards compat aliases
  total_days: number;
  used_days: number;
  remaining_days: number;
}
