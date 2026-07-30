import React, { useState } from 'react';
import { BarChart3, Download, TrendingUp, AlertTriangle, PackageCheck, FileSpreadsheet } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { formatNumber } from '../../lib/formatters';
import { exportStockReportToExcel, exportHistoryToExcel } from '../../lib/excel';

export function ReportsView() {
  const { items, vouchers, logs, warehouses } = useInventoryStore();

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  const filteredItems = selectedWarehouse === 'ALL'
    ? items
    : items.filter((i) => i.warehouseId === selectedWarehouse);

  // Total Stock Quantity
  const totalStockQty = filteredItems.reduce((sum, i) => sum + i.stockQuantity, 0);

  const outOfStockItems = filteredItems.filter((i) => i.stockQuantity <= 0);
  const inStockItems = filteredItems.filter((i) => i.stockQuantity > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-500" />
            Báo Cáo Thống Kê & Phân Tích Kho
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tổng hợp chỉ số Nhập - Xuất - Tồn kho sản phẩm
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            aria-label="Chọn kho báo cáo"
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-semibold"
          >
            <option value="ALL">Tất cả Phòng Kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => exportStockReportToExcel(filteredItems)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Xuất Báo Cáo Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold">Tổng Mặt Hàng Báo Cáo</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatNumber(filteredItems.length)} mặt hàng
          </div>
          <p className="text-xs text-slate-500 mt-1">Lưu trữ trong hệ thống</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold">Tổng Số Lượng Tồn Kho</span>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
            {formatNumber(totalStockQty)} sản phẩm
          </div>
          <p className="text-xs text-slate-500 mt-1">Đơn vị quy đổi chuẩn</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <span className="text-xs text-slate-400 font-semibold">Hàng Đã Hết Kho</span>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
            {formatNumber(outOfStockItems.length)} mặt hàng
          </div>
          <p className="text-xs text-slate-500 mt-1">Số lượng tồn = 0</p>
        </div>

        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Tỷ Lệ Mặt Hàng Còn Tồn</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {((inStockItems.length / (filteredItems.length || 1)) * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-emerald-500 mt-1">{inStockItems.length} mặt hàng sẵn sàng</p>
        </div>
      </div>

      {/* Comprehensive Report Table */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-cyan-500" />
            Bảng Tổng Hợp Nhập - Xuất - Tồn Chi Tiết
          </h3>
          <span className="text-xs text-slate-400">Đơn vị: Sản phẩm</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase">
              <tr>
                <th className="p-3">Mã Hàng</th>
                <th className="p-3">Tên Sản Phẩm</th>
                <th className="p-3">Nhóm Hàng</th>
                <th className="p-3 text-center">ĐVT</th>
                <th className="p-3">Kho</th>
                <th className="p-3 text-right">Số Lượng Tồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item) => {
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-500">{item.code}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{item.name}</td>
                    <td className="p-3 text-slate-500">{item.categoryName}</td>
                    <td className="p-3 text-center text-slate-500">{item.unitName}</td>
                    <td className="p-3 text-slate-500">{item.warehouseName}</td>
                    <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatNumber(item.stockQuantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
