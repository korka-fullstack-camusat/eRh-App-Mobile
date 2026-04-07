import api from '@/api/axios';
import type { LeaveRequest, LeaveBalance, LeaveType } from '@/types/leave';

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

export async function getManagerPendingLeaves(managerEmployeeId: number): Promise<LeaveRequest[]> {
  const { data } = await api.get('/api/leaves/requests/', {
    params: { manager_employee_id: managerEmployeeId },
  });
  const all: LeaveRequest[] = Array.isArray(data) ? data : data?.results ?? [];
  return all.filter(r => r.status === 'PENDING' || r.status === 'PENDING_SECOND');
}

export async function approveLeaveRequest(id: number, reviewerEmployeeId: number): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/approve/`, {
    reviewer_id: reviewerEmployeeId,
  });
  return data;
}

export async function rejectLeaveRequest(id: number, reviewerEmployeeId: number, rejectReason: string): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/reject/`, {
    reviewer_id: reviewerEmployeeId,
    reject_reason: rejectReason,
  });
  return data;
}
