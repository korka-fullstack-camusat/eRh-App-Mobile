import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/api/axios';
import { useAuth } from './AuthContext';
import type { Employee } from '@/types/employee';

interface EmployeeContextType {
  employee: Employee | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextType | null>(null);

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployee = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setEmployee(null);
      setIsLoading(false);
      return;
    }
    try {
      // Cherche l'employé lié à l'utilisateur connecté (par email ou username)
      const { data } = await api.get('/api/employees/', {
        params: { search: user.email || user.username },
      });
      const list = Array.isArray(data) ? data : [];
      // Prend le premier résultat qui correspond
      const found = list.find(
        (e: Employee) =>
          e.email?.toLowerCase() === user.email?.toLowerCase() ||
          e.matricule?.toLowerCase() === user.username?.toLowerCase()
      ) || list[0] || null;
      setEmployee(found);
    } catch {
      setEmployee(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  return (
    <EmployeeContext.Provider value={{ employee, isLoading, reload: fetchEmployee }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error('useEmployee must be used within EmployeeProvider');
  return ctx;
}
