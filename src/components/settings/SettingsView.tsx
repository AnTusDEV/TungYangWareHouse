import React, { useState } from 'react';
import {
  Settings,
  RefreshCw,
  Download,
  Database,
  Shield,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Server,
  AlertCircle,
  Save,
  HardDrive,
  LogOut,
  Sliders,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { downloadImportTemplate } from '../../lib/excel';
import { SQLServerConfig } from '../../lib/sqlServerSync';

export function SettingsView() {
  const {
    // Password lock
    isSettingsUnlocked,
    verifySettingsPassword,
    changeAdminPassword,
    lockSettings,

    // SQL Server Store State & Actions
    sqlServerConfig,
    setSqlServerConfig,
    isSQLServerConnected,
    isLoadingFromSQLServer,
    sqlServerError,
    fetchFromSQLServer,
    testSQLServerConfig,
    initSQLServerDb,

    // General store actions
    clearLocalData,
    items,
    warehouses,
    vouchers,
  } = useInventoryStore();

  // Unlock Password State
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // SQL Server Form State
  const [formConfig, setFormConfig] = useState<SQLServerConfig>({ ...sqlServerConfig });
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Change Password State
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changePassFeedback, setChangePassFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // Handle Unlock
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    if (!passwordInput) {
      setUnlockError('Vui lòng nhập mật khẩu truy cập!');
      return;
    }

    const success = verifySettingsPassword(passwordInput);
    if (!success) {
      setUnlockError('Mật khẩu không đúng, vui lòng thử lại!');
    } else {
      setPasswordInput('');
    }
  };

  // Handle SQL Server Config Save & Fetch
  const handleSaveAndSync = async () => {
    setSqlServerConfig({ ...formConfig, isCustom: true });
    setTestResult({ success: true, message: 'Đã lưu cấu hình SQL Server! Đang tải dữ liệu...' });
    await fetchFromSQLServer();
  };

  // Handle SQL Server Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testSQLServerConfig({ ...formConfig, isCustom: true });
    setIsTesting(false);
    setTestResult(result);
  };

  // Handle Init Tables
  const handleInitTables = async () => {
    setIsInitializing(true);
    setTestResult(null);
    const result = await initSQLServerDb({ ...formConfig, isCustom: true });
    setIsInitializing(false);
    setTestResult(result);
  };

  // Handle Change Admin Password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassFeedback(null);

    if (newPass !== confirmPass) {
      setChangePassFeedback({ success: false, message: 'Mật khẩu mới và xác nhận mật khẩu không khớp!' });
      return;
    }

    const res = changeAdminPassword(currentPass, newPass);
    setChangePassFeedback(res);

    if (res.success) {
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    }
  };

  // 1. LOCK SCREEN IF NOT UNLOCKED
  if (!isSettingsUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <div className="w-full max-w-md p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 text-cyan-500 ring-8 ring-cyan-500/5">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Yêu Cầu Mật Khẩu Cài Đặt
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Màn hình cài đặt hệ thống được bảo vệ. Vui lòng nhập mật khẩu quản trị để tiếp tục.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mật khẩu Quản trị
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  data-lpignore="true"
                  className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {unlockError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="h-4 w-4" />
              <span>Xác Nhận Mở Khóa Cài Đặt</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. UNLOCKED SETTINGS VIEW
  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Header with Lock Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-cyan-500" />
            Cài Đặt Hệ Thống & Kết Nối SQL Server
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cấu hình tham số Microsoft SQL Server, bảo mật tài khoản & quản lý dữ liệu kho
          </p>
        </div>

        <button
          onClick={() => lockSettings()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          <LogOut className="h-3.5 w-3.5 text-rose-500" />
          <span>Khóa Cài Đặt</span>
        </button>
      </div>

      {/* SECTION 1: SQL Server Connection Setup */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isSQLServerConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Cấu Hình Kết Nối Microsoft SQL Server Database
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isSQLServerConnected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                  {isSQLServerConnected ? 'SQL Server Đã Kết Nối' : 'Chưa Kết Nối SQL Server'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Điền tham số máy chủ Microsoft SQL Server (SERVER_LAN) để lưu trữ và đồng bộ dữ liệu
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {testResult && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${testResult.success
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
            }`}>
            <div className="flex items-center gap-2">
              {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />}
              <span>{testResult.message}</span>
            </div>
          </div>
        )}

        {sqlServerError && !testResult && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>Lỗi kết nối SQL Server: {sqlServerError}</span>
          </div>
        )}

        {/* SQL Server Form Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Server Name / Host
            </label>
            <input
              type="text"
              value={formConfig.host}
              onChange={(e) => setFormConfig({ ...formConfig, host: e.target.value })}
              placeholder="SERVER_LAN"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cổng Kết Nối (Port)
            </label>
            <input
              type="number"
              value={formConfig.port}
              onChange={(e) => setFormConfig({ ...formConfig, port: Number(e.target.value) || 1433 })}
              placeholder="1433"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              User Name (SQL Authentication)
            </label>
            <input
              type="text"
              value={formConfig.user}
              onChange={(e) => setFormConfig({ ...formConfig, user: e.target.value })}
              placeholder="antu"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showDbPassword ? 'text' : 'password'}
                value={formConfig.password || ''}
                onChange={(e) => setFormConfig({ ...formConfig, password: e.target.value })}
                placeholder="Mật khẩu SQL Server"
                autoComplete="off"
                data-lpignore="true"
                className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowDbPassword(!showDbPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showDbPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Database Name
            </label>
            <input
              type="text"
              value={formConfig.database}
              onChange={(e) => setFormConfig({ ...formConfig, database: e.target.value })}
              placeholder="inventory_db_test"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formConfig.encrypt || false}
                onChange={(e) => setFormConfig({ ...formConfig, encrypt: e.target.checked })}
                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
              />
              <span>Encrypt Connection (Mã hóa SSL/TLS - Optional)</span>
            </label>
          </div>
        </div>

        {/* Action Buttons for SQL Server */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white shadow transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Đang Thử Kết Nối...' : 'Kiểm Tra Kết Nối SQL Server'}</span>
          </button>

          <button
            type="button"
            onClick={handleInitTables}
            disabled={isInitializing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors"
          >
            <HardDrive className={`h-3.5 w-3.5 ${isInitializing ? 'animate-spin' : ''}`} />
            <span>Khởi Tạo Bảng CSDL SQL Server</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndSync}
            disabled={isLoadingFromSQLServer}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-colors ml-auto"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Lưu & Tải Dữ Liệu SQL Server</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: Change Admin Password */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Đổi Mật Khẩu Truy Cập Cài Đặt
            </h3>
            <p className="text-xs text-slate-500">
              Thay đổi mật khẩu quản trị bảo vệ màn hình Cài đặt này
            </p>
          </div>
        </div>

        {changePassFeedback && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${changePassFeedback.success
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}>
            {changePassFeedback.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{changePassFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              autoComplete="current-password"
              data-lpignore="true"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mật khẩu mới"
              autoComplete="new-password"
              data-lpignore="true"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Xác nhận mật khẩu mới
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                data-lpignore="true"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow shrink-0 transition-colors"
              >
                Cập Nhật
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* SECTION 3: Excel Sample Template & Local Storage Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Excel Template */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                File Excel Mẫu Import
              </h3>
              <p className="text-xs text-slate-500">
                Tải file mẫu Excel (.xlsx) chuẩn định dạng
              </p>
            </div>
          </div>
          <button
            onClick={downloadImportTemplate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Tải File Mẫu Excel (.xlsx)</span>
          </button>
        </div>

        {/* Clear Local Cache / Sync DB */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Làm Sạch Bộ Nhớ Đệm Cục Bộ
              </h3>
              <p className="text-xs text-slate-500">
                Xóa dữ liệu tạm trên trình duyệt và tải lại dữ liệu thực từ SQL Server
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ đệm cục bộ? Hệ thống sẽ tải lại dữ liệu thực từ SQL Server.')) {
                  clearLocalData();
                  fetchFromSQLServer();
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Xóa Cache & Tải Dữ Liệu DB</span>
            </button>
          </div>
        </div>
      </div>

      {/* Current Data Summary */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Thống Kê Tổng Quan Dữ Liệu Hệ Thống Hiện Tại:
        </h4>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400">Số kho lưu trữ:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
              {warehouses.length} Kho
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400">Mặt hàng tồn kho:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
              {items.length} Hàng hóa
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400">Phiếu nhập/xuất:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
              {vouchers.length} Phiếu
            </div>
          </div>
        </div>
      </div>

      {/* System Footer */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-500" />
          <span>ERP Mini Inventory Management System - Microsoft SQL Server Edition</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-500 font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          <span>Bảo vệ bằng Mật khẩu Admin</span>
        </div>
      </div>
    </div>
  );
}
