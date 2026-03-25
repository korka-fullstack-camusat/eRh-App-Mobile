import api from '@/api/axios';
import type { DailyStatsResponse, WeeklyStatsResponse, MonthlyStatsResponse } from '@/types/attendance';

export async function getDailyStats(date: string): Promise<DailyStatsResponse> {
  const { data } = await api.get('/api/attendance/daily-stats/', { params: { date } });
  return data;
}

export async function getWeeklyStats(week: string): Promise<WeeklyStatsResponse> {
  const { data } = await api.get('/api/attendance/weekly-stats/', { params: { week } });
  return data;
}

export async function getMonthlyStats(month: string): Promise<MonthlyStatsResponse> {
  const { data } = await api.get('/api/attendance/monthly-stats/', { params: { month } });
  return data;
}
