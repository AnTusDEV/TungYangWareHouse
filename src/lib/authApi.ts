import {
  User,
  LoginCredentials,
  UpdateProfileData,
  ChangePasswordData,
  CreateUserData,
} from '../types/auth';
import { getStoredSQLServerConfig, hasCustomSQLServerConfig } from './sqlServerSync';

function getMssqlPayloadConfig() {
  return {
    ...getStoredSQLServerConfig(),
    isCustom: hasCustomSQLServerConfig(),
  };
}

function getMssqlHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const cfg = getMssqlPayloadConfig();
  return {
    ...extra,
    'x-mssql-config': encodeURIComponent(JSON.stringify(cfg)),
  };
}

const USERS_STORAGE_KEY = 'tungyang_users_v1';

export function saveStoredLocalUsers(users: User[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users cache', e);
  }
}

export function clearStoredLocalUsers() {
  try {
    localStorage.removeItem(USERS_STORAGE_KEY);
    localStorage.removeItem('tungyang_user_hashes_v1');
  } catch (e) {
    console.error('Failed to clear users cache', e);
  }
}

async function parseApiJson(res: Response, fallbackMsg: string) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  const text = await res.text();
  throw new Error(text || fallbackMsg);
}

// API Functions — all operations strictly verify against SQL Server database via backend
export async function apiLogin(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: getMssqlHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...credentials, config: getMssqlPayloadConfig() }),
    });
    const data = await parseApiJson(res, 'Đăng nhập thất bại');
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Đăng nhập thất bại');
    }
    return { user: data.user, token: data.token };
  } catch (err: any) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Không thể kết nối tới máy chủ để kiểm tra tài khoản trong CSDL.');
    }
    throw err;
  }
}

export async function apiUpdateProfile(userId: string, data: UpdateProfileData): Promise<User> {
  const res = await fetch('/api/auth/profile', {
    method: 'PUT',
    headers: getMssqlHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, ...data, config: getMssqlPayloadConfig() }),
  });
  const result = await parseApiJson(res, 'Không thể cập nhật thông tin');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Không thể cập nhật thông tin');
  }
  return result.user;
}

export async function apiChangePassword(userId: string, data: ChangePasswordData): Promise<string> {
  const res = await fetch('/api/auth/change-password', {
    method: 'PUT',
    headers: getMssqlHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, ...data, config: getMssqlPayloadConfig() }),
  });
  const result = await parseApiJson(res, 'Đổi mật khẩu thất bại');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Đổi mật khẩu thất bại');
  }
  return result.message;
}

export async function apiFetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users', {
    headers: getMssqlHeaders(),
  });
  const result = await parseApiJson(res, 'Không thể tải danh sách tài khoản từ CSDL');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Không thể tải danh sách tài khoản từ CSDL');
  }
  saveStoredLocalUsers(result.users);
  return result.users;
}

export async function apiCreateUser(data: CreateUserData): Promise<User> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: getMssqlHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, config: getMssqlPayloadConfig() }),
  });
  const result = await parseApiJson(res, 'Tạo tài khoản thất bại');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Tạo tài khoản thất bại');
  }
  return result.user;
}

export async function apiUpdateUserStatus(userId: string, status: 'active' | 'locked'): Promise<User> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/status`, {
    method: 'PUT',
    headers: getMssqlHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status, config: getMssqlPayloadConfig() }),
  });
  const result = await parseApiJson(res, 'Cập nhật trạng thái thất bại');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Cập nhật trạng thái thất bại');
  }
  return result.user;
}

export async function apiResetPassword(userId: string, newPassword: string): Promise<string> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'PUT',
    headers: getMssqlHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ newPassword, config: getMssqlPayloadConfig() }),
  });
  const result = await parseApiJson(res, 'Đặt lại mật khẩu thất bại');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Đặt lại mật khẩu thất bại');
  }
  return result.message;
}

export async function apiUpdateUserInfo(userId: string, data: Partial<User>): Promise<User> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: getMssqlHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...data, config: getMssqlPayloadConfig() }),
  });
  const result = await parseApiJson(res, 'Cập nhật thất bại');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Cập nhật thất bại');
  }
  return result.user;
}

export async function apiDeleteUser(userId: string): Promise<void> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: getMssqlHeaders(),
  });
  const result = await parseApiJson(res, 'Xóa tài khoản thất bại');
  if (!res.ok || !result.success) {
    throw new Error(result.message || 'Xóa tài khoản thất bại');
  }
}
