import api from '@/api/axios';
import type { LeaveRequest, LeaveBalance, LeaveType, ApprovalChain } from '@/types/leave';

export async function getMyLeaveRequests(employeeId: number): Promise<LeaveRequest[]> {
  const { data } = await api.get(`/api/leaves/requests/employee/${employeeId}/`);
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function getMyLeaveBalances(employeeId: number): Promise<LeaveBalance[]> {
  const { data } = await api.get(`/api/leaves/balances/employee/${employeeId}/`);
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function getLeaveTypes(): Promise<LeaveType[]> {
  const { data } = await api.get('/api/leaves/types/');
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function getApprovalChain(employeeId: number): Promise<ApprovalChain> {
  const { data } = await api.get<ApprovalChain>(`/api/leaves/requests/approval-chain/${employeeId}/`);
  return data;
}

export async function createLeaveRequest(payload: {
  employee: number;
  leave_type: number;
  start_date: string;
  end_date: string;
  reason?: string;
  justification?: { uri: string; name: string; mimeType?: string };
}): Promise<LeaveRequest> {
  if (payload.justification) {
    const form = new FormData();
    form.append('employee', String(payload.employee));
    form.append('leave_type', String(payload.leave_type));
    form.append('start_date', payload.start_date);
    form.append('end_date', payload.end_date);
    if (payload.reason) form.append('reason', payload.reason);
    form.append('justification_document', {
      uri: payload.justification.uri,
      name: payload.justification.name,
      type: payload.justification.mimeType ?? 'application/octet-stream',
    } as any);
    const { data } = await api.post<LeaveRequest>('/api/leaves/requests/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
  const { data } = await api.post<LeaveRequest>('/api/leaves/requests/', {
    employee: payload.employee,
    leave_type: payload.leave_type,
    start_date: payload.start_date,
    end_date: payload.end_date,
    reason: payload.reason,
  });
  return data;
}

export async function cancelLeaveRequest(id: number): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/cancel/`);
  return data;
}

// ── Manager / approval ────────────────────────────────────────────────────────

export async function getManagerLeaves(
  managerEmployeeId: number,
  statuses: string[],
): Promise<LeaveRequest[]> {
  const results = await Promise.all(
    statuses.map(s =>
      api.get('/api/leaves/requests/', {
        params: { manager_employee_id: managerEmployeeId, status: s },
      }).then(r => (Array.isArray(r.data) ? r.data : r.data?.results ?? []) as LeaveRequest[]),
    ),
  );
  return results.flat();
}

export async function approveLeaveRequest(id: number, reviewerEmployeeId: number): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/approve/`, {
    reviewer_id: reviewerEmployeeId,
  });
  return data;
}

export async function rejectLeaveRequest(
  id: number,
  reviewerEmployeeId: number,
  rejectReason: string,
): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/reject/`, {
    reviewer_id: reviewerEmployeeId,
    reject_reason: rejectReason,
  });
  return data;
}

export async function hrValidateLeaveRequest(
  id: number,
  hrReviewerEmployeeId?: number,
): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/hr_validate/`, {
    hr_reviewer_id: hrReviewerEmployeeId,
  });
  return data;
}

export async function hrRejectLeaveRequest(
  id: number,
  rejectReason: string,
  hrReviewerEmployeeId?: number,
): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/hr_reject/`, {
    reject_reason: rejectReason,
    hr_reviewer_id: hrReviewerEmployeeId,
  });
  return data;
}

// Kept for backward compat
export async function getManagerPendingLeaves(managerEmployeeId: number): Promise<LeaveRequest[]> {
  return getManagerLeaves(managerEmployeeId, ['PENDING', 'PENDING_SECOND']);
}
