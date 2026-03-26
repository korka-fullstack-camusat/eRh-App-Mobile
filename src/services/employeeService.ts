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
