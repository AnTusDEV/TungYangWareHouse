import React, { useState } from 'react';
import { ShieldCheck, Lock, User as UserIcon, AlertCircle, ArrowRight, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export function LoginView() {
  const { login, isLoading, authError, clearError } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!username.trim()) {
      setLocalError('Vui lòng nhập tên đăng nhập!');
      return;
    }
    if (!password) {
      setLocalError('Vui lòng nhập mật khẩu!');
      return;
    }

    const success = await login({
      username: username.trim(),
      password,
      rememberMe,
    });

    if (!success) {
      // Error handled by store authError
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 relative overflow-hidden font-sans transition-colors">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/10 dark:bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Card */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl dark:shadow-slate-950 backdrop-blur-xl">
          {/* Header & Logo - Tung Yang Red Gold Identity */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-red-900 flex items-center justify-center font-black text-2xl shadow-xl shadow-amber-500/30 border-2 border-yellow-200 mb-4 tracking-tighter">
              TY
            </div>
            <h1 className="text-2xl font-black text-red-700 dark:text-amber-400 tracking-wider uppercase">
              TUNG YANG - RICCO
            </h1>
            <p className="text-xs font-bold text-amber-600 dark:text-red-400 mt-1 uppercase tracking-widest">
              Nhà Máy Nhôm &bull; Quản Lý Kho Doanh Nghiệp
            </p>
          </div>

          {/* Error Message Alert */}
          {activeError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-600 dark:text-rose-400 text-xs animate-fadeIn">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Đăng nhập thất bại</span>
                <span>{activeError}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-600 dark:text-amber-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập username (vd: admin, nhanvien)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-amber-500/30 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-600 dark:text-amber-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-amber-500/30 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer select-none hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
              >
                {rememberMe ? (
                  <CheckSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400 dark:text-slate-600" />
                )}
                <span>Ghi nhớ đăng nhập (Remember Me)</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-red-700/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 border border-amber-400/30"
            >
              {isLoading ? (
                <span>Đang kết nối...</span>
              ) : (
                <>
                  <span>Đăng Nhập Hệ Thống</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          &copy; 2026 TungYang WareHouse &bull; Bảo mật mạng nội bộ LAN
        </p>
      </div>
    </div>
  );
}
