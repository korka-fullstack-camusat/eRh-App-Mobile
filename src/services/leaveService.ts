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
}): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>('/api/leaves/requests/', payload);
  return data;
}

export async function cancelLeaveRequest(id: number): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/cancel/`);
  return data;
}
