import api from '@/api/axios';
import type { EmployeePeriodDetailResponse } from '@/types/attendance';

export async function getMyAttendance(params: {
  employee_id: number;
  start: string;
  end: string;
}): Promise<EmployeePeriodDetailResponse> {
  const { data } = await api.get('/api/attendance/employee-period-detail/', { params });
  return data;
}
