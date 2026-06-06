export type LeaveStatus =
  | 'PENDING'
  | 'PENDING_SECOND'
  | 'PENDING_RH'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVOKED';

export interface EmployeeMini {
  id: number;
  matricule?: string;
  full_name: string;
  fonction?: string;
  service?: string;
  n1_manager_id?: number | null;
  n2_manager_id?: number | null;
  n1_manager_name?: string | null;
  n2_manager_name?: string | null;
}

export interface LeaveType {
  id: number;
  code: string;
  label: string;
  name?: string;
  is_paid?: boolean;
  requires_justification?: boolean;
  justification_after_leave?: boolean;
  deducts_from_balance?: boolean;
  max_days_per_request?: number;
  min_days_per_request?: number;
  max_days_per_year?: number;
  monthly_accrual?: number;
  notice_days_required?: number;
  is_fixed_duration?: boolean;
  fixed_duration_days?: number;
  color?: string;
}

export interface LeaveRequest {
  id: number;
  employee: EmployeeMini;
  // Backward compat (used in some services)
  employee_name?: string;
  matricule?: string;
  service?: string;
  leave_type: number;
  leave_type_name?: string;
  leave_type_code?: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  days?: string;
  reason?: string;
  motif?: string;
  status: LeaveStatus;
  status_label?: string;
  created_at: string;
  // N+1 approval
  reviewed_by?: EmployeeMini | null;
  reviewed_at?: string | null;
  reviewer_comment?: string;
  reject_reason?: string;
  // N+2 approval
  requires_second_approval?: boolean;
  second_reviewer?: EmployeeMini | null;
  second_reviewed_at?: string | null;
  // HR validation
  hr_reviewer?: EmployeeMini | null;
  hr_reviewed_at?: string | null;
  // Revocation
  revoke_reason?: string;
  revoked_by?: EmployeeMini | null;
  revoked_at?: string | null;
  // Justification
  justification_document?: string | null;
  justification_validated?: boolean;
  justification_validated_by?: EmployeeMini | null;
  justification_validated_at?: string | null;
  justification_deadline?: string | null;
  justification_pending?: boolean;
  marked_as_absent?: boolean;
}

export interface ApprovalStep {
  level: string;
  approver_id?: number | null;
  approver_name?: string | null;
  is_on_leave?: boolean;
}

export interface ApprovalChain {
  is_department_head: boolean;
  department?: string | null;
  approval_flow: 'HIERARCHY' | 'DG_ONLY';
  steps: ApprovalStep[];
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

export type ExitAuthorizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ExitAuthorization {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_matricule?: string;
  employee_service?: string;
  datetime_exit: string;
  datetime_return: string;
  motif: string;
  status: ExitAuthorizationStatus;
  reviewed_by_name?: string;
  reviewed_by_id?: number;
  reviewed_at?: string;
  reject_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ExitAuthorizationCreate {
  employee_id: number;
  datetime_exit: string;
  datetime_return: string;
  motif: string;
}
