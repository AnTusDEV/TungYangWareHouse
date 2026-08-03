export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'locked';

export interface User {
  id: string;
  username: string;
  fullName: string;
  position: string;
  notes?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface UpdateProfileData {
  fullName: string;
  position: string;
  notes?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  fullName: string;
  position: string;
  notes?: string;
  role: UserRole;
}
