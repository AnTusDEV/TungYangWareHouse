import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  User,
  LoginCredentials,
  UpdateProfileData,
  ChangePasswordData,
  CreateUserData,
} from '../types/auth';
import {
  apiLogin,
  apiUpdateProfile,
  apiChangePassword,
  apiFetchUsers,
  apiCreateUser,
  apiUpdateUserStatus,
  apiResetPassword,
  apiUpdateUserInfo,
  apiDeleteUser,
} from '../lib/authApi';
import { useInventoryStore } from './useInventoryStore';
import { saveUserToSQLServer, deleteUserFromSQLServer } from '../lib/sqlServerSync';

function syncUserToDB(user: User, passwordHash?: string) {
  try {
    const invState = useInventoryStore.getState();
    saveUserToSQLServer(invState.sqlServerConfig, user, passwordHash);
  } catch (e) {}
}

function syncDeleteUserFromDB(userId: string) {
  try {
    const invState = useInventoryStore.getState();
    deleteUserFromSQLServer(invState.sqlServerConfig, userId);
  } catch (e) {}
}

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  token: string | null;
  rememberMe: boolean;
  usersList: User[];
  isLoading: boolean;
  authError: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: UpdateProfileData) => Promise<boolean>;
  changePassword: (data: ChangePasswordData) => Promise<string>;
  fetchUsers: () => Promise<void>;
  createUser: (data: CreateUserData) => Promise<boolean>;
  toggleUserStatus: (userId: string, currentStatus: 'active' | 'locked') => Promise<void>;
  resetUserPasswordByAdmin: (userId: string, newPass: string) => Promise<string>;
  updateUserByAdmin: (userId: string, data: Partial<User>) => Promise<void>;
  deleteUserByAdmin: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      token: null,
      rememberMe: true,
      usersList: [],
      isLoading: false,
      authError: null,

      clearError: () => set({ authError: null }),

      login: async (credentials) => {
        set({ isLoading: true, authError: null });
        try {
          const { user, token } = await apiLogin(credentials);
          set({
            currentUser: user,
            isAuthenticated: true,
            token,
            rememberMe: !!credentials.rememberMe,
            isLoading: false,
            authError: null,
          });
          // Also fetch users list if admin
          if (user.role === 'admin') {
            get().fetchUsers();
          }
          return true;
        } catch (err: any) {
          set({
            isLoading: false,
            authError: err.message || 'Đăng nhập không thành công',
            isAuthenticated: false,
            currentUser: null,
          });
          return false;
        }
      },

      logout: () => {
        set({
          currentUser: null,
          isAuthenticated: false,
          token: null,
          authError: null,
        });
      },

      updateProfile: async (data) => {
        const { currentUser } = get();
        if (!currentUser) return false;
        set({ isLoading: true, authError: null });
        try {
          const updatedUser = await apiUpdateProfile(currentUser.id, data);
          set({
            currentUser: updatedUser,
            isLoading: false,
          });
          return true;
        } catch (err: any) {
          set({ isLoading: false, authError: err.message });
          return false;
        }
      },

      changePassword: async (data) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Chưa đăng nhập');
        set({ isLoading: true, authError: null });
        try {
          const message = await apiChangePassword(currentUser.id, data);
          // Automatically logout on success so user logs in with new password
          set({
            currentUser: null,
            isAuthenticated: false,
            token: null,
            isLoading: false,
          });
          return message;
        } catch (err: any) {
          set({ isLoading: false, authError: err.message });
          throw err;
        }
      },

      fetchUsers: async () => {
        set({ isLoading: true });
        try {
          const invState = useInventoryStore.getState();
          if (invState.isSQLServerConnected) {
            await invState.fetchFromSQLServer();
            set({ isLoading: false });
            return;
          }

          const list = await apiFetchUsers();
          set({ usersList: list, isLoading: false });
        } catch (err: any) {
          set({ usersList: [], isLoading: false, authError: err?.message || 'Không thể tải danh sách người dùng từ CSDL' });
        }
      },

      createUser: async (data) => {
        set({ isLoading: true, authError: null });
        try {
          const createdUser = await apiCreateUser(data);
          const bcrypt = (await import('bcryptjs')).default;
          const passwordHash = bcrypt.hashSync(data.password, 10);
          syncUserToDB(createdUser, passwordHash);
          await get().fetchUsers();
          set({ isLoading: false });
          return true;
        } catch (err: any) {
          set({ isLoading: false, authError: err.message });
          return false;
        }
      },

      toggleUserStatus: async (userId, currentStatus) => {
        const nextStatus = currentStatus === 'active' ? 'locked' : 'active';
        try {
          await apiUpdateUserStatus(userId, nextStatus);
          await get().fetchUsers();
          const user = get().usersList.find((u) => u.id === userId);
          if (user) syncUserToDB(user);

          // If we locked the currently logged in user, log them out
          const { currentUser } = get();
          if (currentUser?.id === userId && nextStatus === 'locked') {
            get().logout();
          }
        } catch (err: any) {
          set({ authError: err.message });
        }
      },

      resetUserPasswordByAdmin: async (userId, newPass) => {
        try {
          const msg = await apiResetPassword(userId, newPass);
          await get().fetchUsers();
          const user = get().usersList.find((u) => u.id === userId);
          if (user) {
            const bcrypt = (await import('bcryptjs')).default;
            const passwordHash = bcrypt.hashSync(newPass, 10);
            syncUserToDB(user, passwordHash);
          }
          return msg;
        } catch (err: any) {
          throw err;
        }
      },

      updateUserByAdmin: async (userId, data) => {
        try {
          await apiUpdateUserInfo(userId, data);
          await get().fetchUsers();
          const user = get().usersList.find((u) => u.id === userId);
          if (user) syncUserToDB(user);

          // Sync if editing current logged in user
          const { currentUser } = get();
          if (currentUser?.id === userId) {
            set({ currentUser: { ...currentUser, ...data } });
          }
        } catch (err: any) {
          set({ authError: err.message });
        }
      },

      deleteUserByAdmin: async (userId) => {
        const { currentUser } = get();
        if (currentUser?.id === userId) {
          throw new Error('Bạn không thể xóa chính tài khoản đang đăng nhập!');
        }
        try {
          await apiDeleteUser(userId);
          syncDeleteUserFromDB(userId);
          await get().fetchUsers();
        } catch (err: any) {
          set({ authError: err.message });
        }
      },
    }),
    {
      name: 'tungyang_auth_storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        rememberMe: state.rememberMe,
      }),
    }
  )
);
