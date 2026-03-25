import api from '@/api/axios';
import type { LeaveRequest, LeaveBalance, LeaveType } from '@/types/leave';

export async function getLeaveRequests(params?: {
  status?: string;
  employee_id?: number;
}): Promise<LeaveRequest[]> {
  const { data } = await api.get('/api/leaves/requests/', { params });
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function getLeaveRequestsByEmployee(employeeId: number): Promise<LeaveRequest[]> {
  const { data } = await api.get(`/api/leaves/requests/employee/${employeeId}/`);
  return Array.isArray(data) ? data : [];
}

export async function approveLeave(id: number, comment?: string): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/approve/`, {
    reviewer_comment: comment,
  });
  return data;
}

export async function rejectLeave(id: number, comment?: string): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/reject/`, {
    reviewer_comment: comment,
  });
  return data;
}

export async function getLeaveBalances(employeeId?: number): Promise<LeaveBalance[]> {
  const params: Record<string, any> = {};
  if (employeeId) params.employee = employeeId;
  const { data } = await api.get('/api/leaves/balances/', { params });
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function getLeaveTypes(): Promise<LeaveType[]> {
  const { data } = await api.get('/api/leaves/types/');
  return Array.isArray(data) ? data : data?.results ?? [];
}

export async function getLeaveSummary(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}> {
  const { data } = await api.get('/api/leaves/stats/summary/');
  return data;
}
