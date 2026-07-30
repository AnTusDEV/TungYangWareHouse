import React from 'react';
import { Settings, RefreshCw, Download, Database, Shield, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { downloadImportTemplate } from '../../lib/excel';
import { supabaseUrl } from '../../lib/supabase';

export function SettingsView() {
  const {
    resetToMockData,
    items,
    warehouses,
    vouchers,
    isSupabaseConnected,
    isLoadingFromSupabase,
    fetchFromSupabase,
    supabaseError,
  } = useInventoryStore();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Settings className="h-5 w-5 text-cyan-500" />
          Cài Đặt Hệ Thống & Cấu Hình
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Quản lý dữ liệu mẫu, file import & thông tin hệ thống ERP Mini
        </p>
      </div>

      {/* Supabase Integration Card */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isSupabaseConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Cơ Sở Dữ Liệu Supabase Cloud
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSupabaseConnected
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {isSupabaseConnected ? 'Đã Kết Nối' : 'Chưa Kết Nối'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                URL: {supabaseUrl}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchFromSupabase()}
            disabled={isLoadingFromSupabase}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingFromSupabase ? 'animate-spin' : ''}`} />
            <span>Tải Lại Từ Supabase</span>
          </button>
        </div>

        {supabaseError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            Lỗi kết nối Supabase: {supabaseError}
          </div>
        )}
      </div>

      {/* Excel Sample Template Card */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                File Excel Mẫu Chuẩn Import
              </h3>
              <p className="text-xs text-slate-500">
                Tải file mẫu Excel (.xlsx) để nhập danh mục hàng hóa nhanh vào hệ thống
              </p>
            </div>
          </div>

          <button
            onClick={downloadImportTemplate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Tải File Mẫu Excel</span>
          </button>
        </div>
      </div>

      {/* Database & Data Management Card */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Lưu Trữ Dữ Liệu Bộ Nhớ Cục Bộ (LocalStorage Persistent)
              </h3>
              <p className="text-xs text-slate-500">
                Dữ liệu hiện đang lưu trữ tự động trên trình duyệt. Có thể nạp lại dữ liệu mẫu bất cứ lúc nào.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Bạn có chắc muốn khôi phục toàn bộ dữ liệu về trạng thái mẫu ban đầu?')) {
                resetToMockData();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Khôi Phục Dữ Liệu Mẫu</span>
          </button>
        </div>

        {/* Current Database Summary */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400">Số phòng kho:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
              {warehouses.length} Kho
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400">Số mặt hàng:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
              {items.length} Hàng hóa
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-slate-400">Số phiếu giao dịch:</span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
              {vouchers.length} Phiếu
            </div>
          </div>
        </div>
      </div>

      {/* System Version Footer */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-500" />
          <span>ERP Mini Inventory Management System v1.0.0</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-500 font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          <span>Sẵn sàng mở rộng Supabase / Multi-tenant</span>
        </div>
      </div>
    </div>
  );
}
