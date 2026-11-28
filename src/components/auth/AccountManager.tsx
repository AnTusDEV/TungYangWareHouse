import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Search,
  Lock,
  Unlock,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  Briefcase,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { User, UserRole, UserStatus } from '../../types/auth';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function AccountManager() {
  const {
    currentUser,
    usersList,
    fetchUsers,
    createUser,
    toggleUserStatus,
    resetUserPasswordByAdmin,
    updateUserByAdmin,
    deleteUserByAdmin,
    isLoading,
  } = useAuthStore();

  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('user');

  // Reset pass state
  const [resetPassInput, setResetPassInput] = useState('');

  // Toast / Alert messages
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  // Create User Handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) return showToast('error', 'Vui lòng nhập Tên đăng nhập!');
    if (!formPassword || formPassword.length < 8) return showToast('error', 'Mật khẩu phải từ 8 ký tự trở lên!');
    if (!formFullName.trim()) return showToast('error', 'Vui lòng nhập Họ và tên!');
    if (!formPosition.trim()) return showToast('error', 'Vui lòng nhập Chức vụ!');

    const ok = await createUser({
      username: formUsername.trim(),
      password: formPassword,
      fullName: formFullName.trim(),
      position: formPosition.trim(),
      notes: formNotes.trim(),
      role: formRole,
    });

    if (ok) {
      showToast('success', 'Tạo tài khoản thành công!');
      setIsCreateOpen(false);
      resetForm();
    } else {
      showToast('error', 'Không thể tạo tài khoản. Tên đăng nhập có thể đã trùng!');
    }
  };

  // Edit User Handler
  const handleEditOpen = (u: User) => {
    setSelectedUser(u);
    setFormFullName(u.fullName);
    setFormPosition(u.position);
    setFormNotes(u.notes || '');
    setFormRole(u.role);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!formFullName.trim()) return showToast('error', 'Vui lòng nhập Họ và tên!');
    if (!formPosition.trim()) return showToast('error', 'Vui lòng nhập Chức vụ!');

    await updateUserByAdmin(selectedUser.id, {
      fullName: formFullName.trim(),
      position: formPosition.trim(),
      notes: formNotes.trim(),
      role: formRole,
    });

    showToast('success', 'Cập nhật thông tin tài khoản thành công!');
    setIsEditOpen(false);
    setSelectedUser(null);
  };

  // Reset Password Handler
  const handleResetOpen = (u: User) => {
    setSelectedUser(u);
    setResetPassInput('');
    setIsResetOpen(true);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (resetPassInput.length < 8) return showToast('error', 'Mật khẩu mới phải tối thiểu 8 ký tự!');

    try {
      const resMsg = await resetUserPasswordByAdmin(selectedUser.id, resetPassInput);
      showToast('success', resMsg || 'Đặt lại mật khẩu thành công!');
      setIsResetOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      showToast('error', err.message || 'Đặt lại mật khẩu thất bại');
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deleteUserId) return;
    try {
      await deleteUserByAdmin(deleteUserId);
      showToast('success', 'Đã xóa tài khoản thành công');
    } catch (err: any) {
      showToast('error', err.message || 'Không thể xóa tài khoản');
    } finally {
      setDeleteUserId(null);
    }
  };

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormFullName('');
    setFormPosition('');
    setFormNotes('');
    setFormRole('user');
  };

  // Filtered Users
  const query = search.trim().toLowerCase();
  const filteredUsers = usersList.filter((u) => {
    return (
      u.username.toLowerCase().includes(query) ||
      u.fullName.toLowerCase().includes(query) ||
      u.position.toLowerCase().includes(query) ||
      (u.notes && u.notes.toLowerCase().includes(query))
    );
  });

  // Non-admin view restriction
  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Quyền Truy Cập Bị Hạn Chế</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Tính năng quản lý tài khoản chỉ dành riêng cho Quản trị viên hệ thống (Admin).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold animate-fadeIn ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Page Banner Header - Tung Yang Red & Gold Theme */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 border border-amber-500/30 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Phân Quyền & Tài Khoản
            </span>
            <span className="text-xs text-amber-200/70">| Quản trị hệ thống Tung Yang</span>
          </div>
          <h1 className="text-xl font-bold mt-1 text-amber-400 tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-400" />
            <span>Quản Lý Danh Sách Tài Khoản</span>
          </h1>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-red-700/20 flex items-center gap-2 transition-all border border-amber-400/30 self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4 text-amber-300" />
          <span>Thêm Tài Khoản Mới</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo username, họ tên, chức vụ..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Tổng số tài khoản: <span className="font-bold text-amber-500">{filteredUsers.length}</span>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Tài khoản (Username)</th>
                <th className="py-3.5 px-4">Họ và tên</th>
                <th className="py-3.5 px-4">Chức vụ</th>
                <th className="py-3.5 px-4">Vai trò</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Ghi chú</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Không tìm thấy tài khoản phù hợp
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const isLocked = u.status === 'locked';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Username */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                            {u.username}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600/10 text-red-600 dark:text-red-400 border border-red-500/30">
                              (Bạn)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Full Name */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {u.fullName}
                      </td>

                      {/* Position */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {u.position}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <Users className="h-3 w-3" />
                            User (Nhân viên)
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <UserX className="h-3 w-3" />
                            Đã khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <UserCheck className="h-3 w-3" />
                            Hoạt động
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                        {u.notes || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Lock / Unlock button */}
                          <button
                            onClick={() => toggleUserStatus(u.id, u.status)}
                            title={isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isLocked
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                            }`}
                          >
                            {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          </button>

                          {/* Reset Password Button */}
                          <button
                            onClick={() => handleResetOpen(u)}
                            title="Đặt lại mật khẩu"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-cyan-500" />
                          </button>

                          {/* Edit User Info */}
                          <button
                            onClick={() => handleEditOpen(u)}
                            title="Chỉnh sửa thông tin"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                          </button>

                          {/* Delete User */}
                          {!isCurrent && (
                            <button
                              onClick={() => setDeleteUserId(u.id)}
                              title="Xóa tài khoản"
                              className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500/20 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo Tài Khoản Người Dùng Mới"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên đăng nhập (Username) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="Chữ cái, số (vd: kho_haiphong)"
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">* Không chứa khoảng trắng hoặc ký tự đặc biệt</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu khởi tạo <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formFullName}
              onChange={(e) => setFormFullName(e.target.value)}
              placeholder="Nhập họ và tên người sử dụng"
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chức vụ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formPosition}
              onChange={(e) => setFormPosition(e.target.value)}
              placeholder="Nhập chức vụ (vd: Thủ kho, Quản lý vật tư)"
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phân quyền tài khoản <span className="text-rose-500">*</span>
            </label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as UserRole)}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="user">User - Nhân viên vận hành kho</option>
              <option value="admin">Admin - Quản trị viên hệ thống</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Ghi chú thêm về bộ phận hoặc tài khoản"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold shadow-md shadow-cyan-500/20"
            >
              Tạo Tài Khoản
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Chỉnh Sửa Tài Khoản (${selectedUser?.username})`}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Họ và tên
            </label>
            <input
              type="text"
              value={formFullName}
              onChange={(e) => setFormFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chức vụ
            </label>
            <input
              type="text"
              value={formPosition}
              onChange={(e) => setFormPosition(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phân quyền
            </label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as UserRole)}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="user">User - Nhân viên vận hành kho</option>
              <option value="admin">Admin - Quản trị viên hệ thống</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold"
            >
              Lưu Thay Đổi
            </button>
          </div>
        </form>
      </Modal>

      {/* Admin Reset Password Modal */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title={`Đặt Lại Mật Khẩu (${selectedUser?.username})`}
        maxWidth="md"
      >
        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={resetPassInput}
              onChange={(e) => setResetPassInput(e.target.value)}
              placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
              className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsResetOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold"
            >
              Đặt Mật Khẩu Mới
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={handleDeleteConfirm}
        title="Xác Nhận Xóa Tài Khoản"
        message="Bạn có chắc chắn muốn xóa tài khoản này khỏi hệ thống không? Hành động này không thể hoàn tác."
        confirmLabel="Xóa Tài Khoản"
        isDangerous={true}
      />
    </div>
  );
}
