export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  first_login?: boolean;
  employee_id?: number;
  employee_matricule?: string;
  employee_name?: string;
  roles?: string[];
}
