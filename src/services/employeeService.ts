import api from '@/api/axios';
import type { Employee } from '@/types/employee';

export async function getMyEmployee(search: string): Promise<Employee | null> {
  const { data } = await api.get('/api/employees/', { params: { search } });
  const list = Array.isArray(data) ? data : [];
  return list[0] ?? null;
}

export async function getEmployee(id: number): Promise<Employee> {
  const { data } = await api.get<Employee>(`/api/employees/${id}/`);
  return data;
}

export async function getAvailableBulletins(matricule: string): Promise<{ year: number; month: number }[]> {
  const { data } = await api.get(`/api/employees/${matricule}/available-bulletins/`);
  return Array.isArray(data) ? data : [];
}

export async function requestPayslipAccess(payload: {
  months: { year: number; month: number }[];
  message?: string;
}): Promise<{ detail: string; request_id: number }> {
  const { data } = await api.post('/api/employees/request-payslip-access/', payload);
  return data;
}

export interface PayslipRequest {
  id: number;
  status: 'pending' | 'sent' | 'rejected';
  requested_months: { year: number; month: number }[];
  message: string;
  created_at: string;
}

export async function getMyPayslipRequests(): Promise<PayslipRequest[]> {
  const { data } = await api.get('/api/employees/my-payslip-requests/');
  return Array.isArray(data) ? data : [];
}
