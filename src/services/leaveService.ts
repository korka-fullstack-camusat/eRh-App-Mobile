import api from '@/api/axios';
import type { LeaveRequest, LeaveBalance, LeaveType } from '@/types/leave';

function normalizeLeaveRequest(raw: any): LeaveRequest {
  return {
    ...raw,
    leave_type_name: raw.leave_type?.label ?? raw.leave_type_name,
    leave_type_code: raw.leave_type?.code ?? raw.leave_type_code,
    employee_name: raw.employee?.full_name ?? raw.employee_name,
    matricule: raw.employee?.matricule ?? raw.matricule,
    service: raw.employee?.service ?? raw.service,
    leave_type: typeof raw.leave_type === 'object' ? raw.leave_type?.id : raw.leave_type,
    employee: typeof raw.employee === 'object' ? raw.employee?.id : raw.employee,
  };
}

function normalizeLeaveBalance(raw: any): LeaveBalance {
  return {
    ...raw,
    leave_type_name: raw.leave_type?.label ?? raw.leave_type_name,
    leave_type_code: raw.leave_type?.code ?? raw.leave_type_code,
    leave_type_color: raw.leave_type?.color ?? raw.leave_type_color,
    leave_type: typeof raw.leave_type === 'object' ? raw.leave_type?.id : raw.leave_type,
    total_days: raw.acquired ?? raw.total_days ?? 0,
    used_days: raw.taken ?? raw.used_days ?? 0,
    remaining_days: raw.remaining ?? raw.remaining_days ?? 0,
  };
}

function calcDays(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

export async function getMyLeaveRequests(employeeId: number): Promise<LeaveRequest[]> {
  const { data } = await api.get(`/api/leaves/requests/employee/${employeeId}/`);
  const list: any[] = Array.isArray(data) ? data : data?.results ?? [];
  return list.map(normalizeLeaveRequest);
}

export async function getMyLeaveBalances(employeeId: number): Promise<LeaveBalance[]> {
  const { data } = await api.get(`/api/leaves/balances/employee/${employeeId}/`);
  const list: any[] = Array.isArray(data) ? data : data?.results ?? [];
  return list.map(normalizeLeaveBalance);
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
  motif?: string;
  justification?: { uri: string; name: string; mimeType?: string };
}): Promise<LeaveRequest> {
  const days = calcDays(payload.start_date, payload.end_date);

  if (payload.justification) {
    const form = new FormData();
    form.append('employee_id', String(payload.employee));
    form.append('leave_type_id', String(payload.leave_type));
    form.append('start_date', payload.start_date);
    form.append('end_date', payload.end_date);
    form.append('days', String(days));
    if (payload.motif) form.append('motif', payload.motif);
    form.append('justification_document', {
      uri: payload.justification.uri,
      name: payload.justification.name,
      type: payload.justification.mimeType ?? 'application/octet-stream',
    } as any);
    const { data } = await api.post<LeaveRequest>('/api/leaves/requests/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeLeaveRequest(data);
  }

  const { data } = await api.post<LeaveRequest>('/api/leaves/requests/', {
    employee_id: payload.employee,
    leave_type_id: payload.leave_type,
    start_date: payload.start_date,
    end_date: payload.end_date,
    days,
    motif: payload.motif,
  });
  return normalizeLeaveRequest(data);
}

export async function cancelLeaveRequest(id: number): Promise<LeaveRequest> {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/cancel/`);
  return normalizeLeaveRequest(data);
}
