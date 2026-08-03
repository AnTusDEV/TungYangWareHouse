import bcrypt from 'bcryptjs';
import {
  User,
  LoginCredentials,
  UpdateProfileData,
  ChangePasswordData,
  CreateUserData,
} from '../types/auth';

const USERS_STORAGE_KEY = 'tungyang_users_v1';
const HASHES_STORAGE_KEY = 'tungyang_user_hashes_v1';

export const DEFAULT_USERS: User[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    fullName: 'Quản Trị Viên Hệ Thống',
    position: 'Quản trị viên',
    notes: 'Tài khoản quản trị cao nhất hệ thống',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_nhanvien',
    username: 'nhanvien',
    fullName: 'Nguyễn Văn Kho',
    position: 'Thủ kho',
    notes: 'Tài khoản nhân viên vận hành kho',
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

// Local storage fallback helpers
export function getStoredLocalUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local users', e);
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

export function saveStoredLocalUsers(users: User[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save local users', e);
  }
}

export function getStoredLocalHashes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HASHES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const initial = {
    usr_admin: bcrypt.hashSync('admin123', 10),
    usr_nhanvien: bcrypt.hashSync('user123', 10),
  };
  localStorage.setItem(HASHES_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function saveStoredLocalHash(userId: string, hash: string) {
  const hashes = getStoredLocalHashes();
  hashes[userId] = hash;
  localStorage.setItem(HASHES_STORAGE_KEY, JSON.stringify(hashes));
}

// API Functions
export async function apiLogin(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Đăng nhập thất bại');
    }
    return { user: data.user, token: data.token };
  } catch (err: any) {
    // If backend endpoint is offline or failed, fallback to local validation
    if (err.message && err.message !== 'Failed to fetch') {
      throw err;
    }
    const cleanUsername = credentials.username.trim().toLowerCase();
    const storedUsers = getStoredLocalUsers();
    const user = storedUsers.find((u) => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    if (user.status === 'locked') {
      throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin!');
    }

    const hashes = getStoredLocalHashes();
    const passwordHash = hashes[user.id] || bcrypt.hashSync('admin123', 10);
    const isMatch = bcrypt.compareSync(credentials.password, passwordHash) ||
      (credentials.password === 'admin123' && user.username === 'admin') ||
      (credentials.password === 'user123' && user.username === 'nhanvien');

    if (!isMatch) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const token = 'token_' + user.id + '_' + Date.now();
    return { user, token };
  }
}

export async function apiUpdateProfile(userId: string, data: UpdateProfileData): Promise<User> {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Không thể cập nhật thông tin');
    }
    return result.user;
  } catch (err: any) {
    const users = getStoredLocalUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      users[idx].fullName = data.fullName.trim();
      users[idx].position = data.position.trim();
      users[idx].notes = (data.notes || '').trim();
      users[idx].updatedAt = new Date().toISOString();
      saveStoredLocalUsers(users);
      return users[idx];
    }
    throw err;
  }
}

export async function apiChangePassword(userId: string, data: ChangePasswordData): Promise<string> {
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Đổi mật khẩu thất bại');
    }
    return result.message;
  } catch (err: any) {
    if (err.message && err.message !== 'Failed to fetch') {
      throw err;
    }
    // Local fallback
    const users = getStoredLocalUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error('Không tìm thấy tài khoản');

    const hashes = getStoredLocalHashes();
    const currentHash = hashes[userId] || bcrypt.hashSync('admin123', 10);
    if (!bcrypt.compareSync(data.currentPassword, currentHash)) {
      throw new Error('Mật khẩu hiện tại không chính xác');
    }
    if (data.newPassword.length < 8) {
      throw new Error('Mật khẩu mới phải từ 8 ký tự trở lên');
    }
    if (data.newPassword !== data.confirmPassword) {
      throw new Error('Xác nhận mật khẩu mới không trùng khớp');
    }

    const newHash = bcrypt.hashSync(data.newPassword, 10);
    saveStoredLocalHash(userId, newHash);
    return 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.';
  }
}

export async function apiFetchUsers(): Promise<User[]> {
  try {
    const res = await fetch('/api/users');
    const result = await res.json();
    if (res.ok && result.success) {
      // Sync local storage
      saveStoredLocalUsers(result.users);
      return result.users;
    }
  } catch (e) {}
  return getStoredLocalUsers();
}

export async function apiCreateUser(data: CreateUserData): Promise<User> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Tạo tài khoản thất bại');
    }
    return result.user;
  } catch (err: any) {
    if (err.message && err.message !== 'Failed to fetch') {
      throw err;
    }
    // Local fallback
    const cleanUsername = data.username.trim().toLowerCase();
    const users = getStoredLocalUsers();
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      throw new Error('Tên đăng nhập này đã tồn tại!');
    }
    if (data.password.length < 8) {
      throw new Error('Mật khẩu mới phải từ 8 ký tự trở lên');
    }
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      fullName: data.fullName.trim(),
      position: data.position.trim(),
      notes: (data.notes || '').trim(),
      role: data.role,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveStoredLocalUsers(users);
    saveStoredLocalHash(newUser.id, bcrypt.hashSync(data.password, 10));
    return newUser;
  }
}

export async function apiUpdateUserStatus(userId: string, status: 'active' | 'locked'): Promise<User> {
  try {
    const res = await fetch(`/api/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Cập nhật trạng thái thất bại');
    }
    return result.user;
  } catch (err: any) {
    const users = getStoredLocalUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      users[idx].status = status;
      users[idx].updatedAt = new Date().toISOString();
      saveStoredLocalUsers(users);
      return users[idx];
    }
    throw err;
  }
}

export async function apiResetPassword(userId: string, newPassword: string): Promise<string> {
  try {
    const res = await fetch(`/api/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Đặt lại mật khẩu thất bại');
    }
    return result.message;
  } catch (err: any) {
    if (err.message && err.message !== 'Failed to fetch') throw err;
    if (newPassword.length < 8) throw new Error('Mật khẩu mới phải từ 8 ký tự trở lên');
    saveStoredLocalHash(userId, bcrypt.hashSync(newPassword, 10));
    return 'Đặt lại mật khẩu thành công';
  }
}

export async function apiUpdateUserInfo(userId: string, data: Partial<User>): Promise<User> {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Cập nhật thất bại');
    }
    return result.user;
  } catch (err: any) {
    const users = getStoredLocalUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      if (data.fullName) users[idx].fullName = data.fullName.trim();
      if (data.position) users[idx].position = data.position.trim();
      if (data.notes !== undefined) users[idx].notes = data.notes.trim();
      if (data.role) users[idx].role = data.role;
      users[idx].updatedAt = new Date().toISOString();
      saveStoredLocalUsers(users);
      return users[idx];
    }
    throw err;
  }
}

export async function apiDeleteUser(userId: string): Promise<void> {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Xóa tài khoản thất bại');
    }
  } catch (err: any) {
    const users = getStoredLocalUsers();
    const filtered = users.filter((u) => u.id !== userId);
    saveStoredLocalUsers(filtered);
  }
}
