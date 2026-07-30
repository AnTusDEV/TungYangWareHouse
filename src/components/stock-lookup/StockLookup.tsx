import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, AlertTriangle, ShieldCheck, Box, Boxes } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Item } from '../../types/inventory';
import { DataTable, Column } from '../common/DataTable';
import { formatNumber, getStockStatus } from '../../lib/formatters';
import { exportStockReportToExcel } from '../../lib/excel';

export function StockLookup() {
  const { items, categories, warehouses } = useInventoryStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('ALL');

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'ALL' && item.categoryId !== selectedCategory) return false;
      if (selectedWarehouse !== 'ALL' && item.warehouseId !== selectedWarehouse) return false;

      if (selectedStockStatus === 'OUT') return item.stockQuantity <= 0;
      if (selectedStockStatus === 'HIGH') return item.maxStockLevel && item.stockQuantity >= item.maxStockLevel;
      if (selectedStockStatus === 'NORMAL')
        return item.stockQuantity > 0 && (!item.maxStockLevel || item.stockQuantity < item.maxStockLevel);

      return true;
    });
  }, [items, selectedCategory, selectedWarehouse, selectedStockStatus]);

  // Table Columns
  const columns: Column<Item>[] = [
    {
      key: 'code',
      header: 'Mã Hàng',
      sortable: true,
      render: (item) => (
        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên Sản Phẩm / Vật Tư',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
          <div className="text-[11px] text-slate-500">{item.categoryName}</div>
        </div>
      ),
    },
    {
      key: 'warehouseName',
      header: 'Kho Lưu Trữ',
      sortable: true,
      render: (item) => (
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {item.warehouseName}
        </span>
      ),
    },
    {
      key: 'unitName',
      header: 'ĐVT',
      align: 'center',
      render: (item) => <span className="text-slate-500">{item.unitName}</span>,
    },
    {
      key: 'stockQuantity',
      header: 'Tồn Kho Hiện Tại',
      align: 'right',
      sortable: true,
      render: (item) => {
        const st = getStockStatus(item.stockQuantity, 0, item.maxStockLevel);
        return (
          <span className={`font-bold text-sm ${st.textClass}`}>
            {formatNumber(item.stockQuantity)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng Thái Tồn',
      align: 'center',
      render: (item) => {
        const st = getStockStatus(item.stockQuantity, 0, item.maxStockLevel);
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${st.badgeClass}`}>
            {st.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Search className="h-5 w-5 text-cyan-500" />
            Tra Cứu Tồn Kho Chi Tiết ({filteredItems.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tra cứu nhanh theo mã, tên, lọc theo kho, nhóm hàng & đánh giá cảnh báo tồn kho
          </p>
        </div>

        <button
          onClick={() => exportStockReportToExcel(filteredItems)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          <span>Export Báo Cáo Tồn Kho</span>
        </button>
      </div>

      {/* Table & Custom Filters */}
      <DataTable
        data={filteredItems}
        columns={columns}
        rowKey={(item) => item.id}
        searchKey={(item) => `${item.code} ${item.name} ${item.categoryName} ${item.warehouseName}`}
        searchPlaceholder="Tìm kiếm theo mã, tên sản phẩm..."
        filters={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Lọc theo nhóm hàng"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Tất cả Nhóm hàng</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Warehouse Filter */}
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              aria-label="Lọc theo kho lưu trữ"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Tất cả Phòng Kho</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Stock Level Filter */}
            <select
              value={selectedStockStatus}
              onChange={(e) => setSelectedStockStatus(e.target.value)}
              aria-label="Lọc theo tình trạng tồn kho"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="ALL">Tất cả Tình Trạng Tồn</option>
              <option value="NORMAL">✅ Còn hàng</option>
              <option value="OUT">❌ Hết hàng (= 0)</option>
              <option value="HIGH">📦 Tồn nhiều (&gt; Tối đa)</option>
            </select>
          </div>
        }
      />
    </div>
  );
}
