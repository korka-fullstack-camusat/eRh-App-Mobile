import api from '@/api/axios';
import type { Employee } from '@/types/employee';

export async function getEmployees(opts?: {
  status?: 'ALL' | 'ACTIVE' | 'EXITED';
  search?: string;
}): Promise<Employee[]> {
  const params: Record<string, any> = {};
  if (opts?.status) params.status = opts.status;
  if (opts?.search) params.search = opts.search;
  const { data } = await api.get('/api/employees/', { params });
  return Array.isArray(data) ? data : [];
}

export async function getEmployee(id: number): Promise<Employee> {
  const { data } = await api.get<Employee>(`/api/employees/${id}/`);
  return data;
}

export async function createEmployee(payload: Partial<Employee>): Promise<Employee> {
  const { data } = await api.post<Employee>('/api/employees/', payload);
  return data;
}

export async function updateEmployee(id: number, payload: Partial<Employee>): Promise<Employee> {
  const { data } = await api.put<Employee>(`/api/employees/${id}/`, payload);
  return data;
}

export async function markExit(
  id: number,
  payload: { date_sortie: string; motif_sortie?: string }
): Promise<Employee> {
  const { data } = await api.post<Employee>(`/api/employees/${id}/mark-exit/`, payload);
  return data;
}

export async function reinstate(
  id: number,
  payload?: { date_reintegration?: string }
): Promise<Employee> {
  const { data } = await api.post<Employee>(`/api/employees/${id}/reinstate/`, payload ?? {});
  return data;
}
