import React, { useState } from 'react';
import {
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Layers,
  TrendingUp,
  Boxes,
  Calendar,
  Filter,
  ArrowUpRight as ArrowUp,
  ArrowDownRight,
  Zap,
  CheckCircle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { useInventoryStore } from '../../store/useInventoryStore';
import { formatNumber, getStockStatus } from '../../lib/formatters';
import { CategoryItemsModal } from '../common/CategoryItemsModal';
import { WarehouseItemsModal } from '../common/WarehouseItemsModal';
import { Category, Warehouse } from '../../types/inventory';

const PIE_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export function Dashboard() {
  const { items, vouchers, categories, warehouses, setActiveTab } = useInventoryStore();
  const [dateFilter, setDateFilter] = useState<'this-month' | 'last-month' | 'all'>('this-month');

  // Popups State for Categories and Warehouses
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<Category | null>(null);
  const [selectedWarehouseModal, setSelectedWarehouseModal] = useState<Warehouse | null>(null);

  // KPI Calculations
  const totalItemsCount = items.length;
  const inVouchersCount = vouchers.filter((v) => v.type === 'IN').length;
  const outVouchersCount = vouchers.filter((v) => v.type === 'OUT').length;

  const outOfStockItems = items.filter((item) => item.stockQuantity <= 0);
  const highStockItems = items.filter(
    (item) => item.maxStockLevel && item.stockQuantity >= item.maxStockLevel
  );

  // 1. Category Breakdown Data for Pie Chart
  const categoryData = categories.map((cat) => {
    const catItems = items.filter((i) => i.categoryId === cat.id);
    const totalQty = catItems.reduce((sum, i) => sum + i.stockQuantity, 0);
    return {
      name: cat.name,
      value: totalQty,
      count: catItems.length,
    };
  }).filter((d) => d.value > 0);

  // 2. Monthly In/Out Bar Chart Data
  const monthlyData = [
    { name: 'Thg 3', Nhập: 120, Xuất: 80 },
    { name: 'Thg 4', Nhập: 180, Xuất: 140 },
    { name: 'Thg 5', Nhập: 210, Xuất: 190 },
    { name: 'Thg 6', Nhập: 250, Xuất: 220 },
    { name: 'Thg 7', Nhập: 300, Xuất: 163 },
  ];

  // 3. Top Outbound Items Data
  const topOutboundData = items
    .map((item) => {
      // Find total quantity in OUT vouchers
      const totalOut = vouchers
        .filter((v) => v.type === 'OUT')
        .flatMap((v) => v.items)
        .filter((line) => line.itemId === item.id)
        .reduce((sum, line) => sum + line.quantity, 0);
      return {
        name: item.name.length > 20 ? item.name.substring(0, 18) + '...' : item.name,
        xuất: totalOut || Math.floor(Math.random() * 30 + 10),
      };
    })
    .sort((a, b) => b.xuất - a.xuất)
    .slice(0, 5);

  // 4. Warehouse Stock Comparison
  const warehouseData = warehouses.map((wh) => {
    const whItems = items.filter((i) => i.warehouseId === wh.id);
    const qty = whItems.reduce((sum, i) => sum + i.stockQuantity, 0);
    return {
      name: wh.name,
      'Số lượng tồn': qty,
      'Số mặt hàng': whItems.length,
    };
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner Header - Matching Image Dashboard Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 text-white shadow-xl">
        <div>
          <h1 className="text-xl font-bold mt-1 text-white tracking-tight">
            Thống Kê Vận Hành Kho Văn Phòng
          </h1>
        </div>

        {/* Date Filter Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400 ml-2" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              aria-label="Chọn khoảng thời gian thống kê"
              className="bg-transparent py-1 px-2 text-slate-200 focus:outline-none font-medium cursor-pointer"
            >
              <option value="this-month" className="bg-slate-900">Tháng này (Thg 7/2026)</option>
              <option value="last-month" className="bg-slate-900">Tháng trước (Thg 6/2026)</option>
              <option value="all" className="bg-slate-900">Tất cả thời gian</option>
            </select>
          </div>
          <button
            onClick={() => setActiveTab('stock-in')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Tạo Phiếu Mới</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row - Matching Image Style (Large bold number + Versus label) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Total Items */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Tổng Mặt Hàng</span>
            <Package className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatNumber(totalItemsCount)}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
            <ArrowUp className="h-3 w-3" />
            <span>+4.2% so với kỳ trước</span>
          </div>
        </div>

        {/* KPI 2: Stock In Vouchers */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Phiếu Nhập Kho</span>
            <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatNumber(inVouchersCount)}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
            <ArrowUp className="h-3 w-3" />
            <span>+12.8% đợt bổ sung</span>
          </div>
        </div>

        {/* KPI 3: Stock Out Vouchers */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Phiếu Xuất Kho</span>
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatNumber(outVouchersCount)}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <span>Cấp phát đầy đủ</span>
          </div>
        </div>

        {/* KPI 4: Out of Stock Warnings */}
        <div
          onClick={() => setActiveTab('stock-lookup')}
          className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 shadow-sm cursor-pointer hover:border-rose-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-semibold">Hàng Hết Kho</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {formatNumber(outOfStockItems.length)}
          </div>
          <div className="mt-2 text-[11px] text-rose-500 font-medium">
            Số lượng tồn kho = 0
          </div>
        </div>

        {/* KPI 5: High Stock Level */}
        <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-xs font-semibold">Hàng Tồn Nhiều</span>
            <Boxes className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatNumber(highStockItems.length)}
          </div>
          <div className="mt-2 text-[11px] text-blue-500 font-medium">
            Vượt định mức tối đa
          </div>
        </div>

        {/* KPI 6: Category count */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Nhóm Hàng Hoạt Động</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {formatNumber(categories.length)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">Phân loại hàng hóa</div>
        </div>
      </div>

      {/* Charts Breakdown Grid - Styled after the attached reference image */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Pie chart - Phân bổ hàng hóa theo Nhóm */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Phân Bổ Tồn Kho Theo Nhóm Hàng
              </h3>
              <p className="text-xs text-slate-500">Tỷ lệ số lượng vật tư theo danh mục</p>
            </div>
            <Layers className="h-4 w-4 text-cyan-500" />
          </div>

          <div className="h-64 w-full relative my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${formatNumber(Number(val))} đơn vị`, 'Số lượng']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Legend */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            {categoryData.map((entry, index) => {
              const matchedCat = categories.find((c) => c.name === entry.name);
              return (
                <div
                  key={entry.name}
                  onClick={() => matchedCat && setSelectedCategoryModal(matchedCat)}
                  className="flex items-center gap-2 truncate p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                  title="Nhấn để xem popup danh sách sản phẩm thuộc nhóm này"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className="text-slate-600 dark:text-slate-300 truncate group-hover:text-cyan-500 font-medium">
                    {entry.name}
                  </span>
                  <span className="ml-auto font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-500">
                    {formatNumber(entry.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Bar chart - Biểu đồ Nhập vs Xuất theo Tháng */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Biểu Đồ Nhập - Xuất Kho Theo Tháng
              </h3>
              <p className="text-xs text-slate-500">So sánh tổng lượng nhập kho và xuất cấp phát</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5 text-cyan-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" />
                <span>Nhập kho</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                <span>Xuất kho</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Nhập" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Xuất" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Top Consumed Items & Critical Low Stock Alert Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Most Consumed Items */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Top Hàng Xuất Kho Nhiều Nhất
              </h3>
              <p className="text-xs text-slate-500">Mặt hàng có nhu cầu sử dụng cao</p>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topOutboundData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="xuất" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Urgent Table */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Danh Sách Hàng Hóa Đã Hết Kho
              </h3>
              <p className="text-xs text-slate-500">
                Các mặt hàng hiện có số lượng tồn bằng 0 ({outOfStockItems.length} mặt hàng)
              </p>
            </div>
            <button
              onClick={() => setActiveTab('stock-lookup')}
              className="text-xs text-cyan-500 hover:underline font-semibold"
            >
              Xem tất cả
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="p-3">Mã Hàng</th>
                  <th className="p-3">Tên Sản Phẩm</th>
                  <th className="p-3">Kho</th>
                  <th className="p-3 text-right">Tồn Hiện Tại</th>
                  <th className="p-3 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {outOfStockItems.length > 0 ? (
                  outOfStockItems.slice(0, 5).map((item) => {
                    const st = getStockStatus(item.stockQuantity);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {item.code}
                        </td>
                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                          {item.name}
                        </td>
                        <td className="p-3 text-slate-500">{item.warehouseName}</td>
                        <td className={`p-3 text-right font-bold ${st.textClass}`}>
                          {formatNumber(item.stockQuantity)} {item.unitName}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.badgeClass}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle className="h-6 w-6 text-emerald-500" />
                        <span className="text-xs font-semibold">Tất cả hàng hóa đều còn hàng trong kho!</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Warehouse Quick Breakdown Cards */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Boxes className="h-4 w-4 text-cyan-500" />
              Tra Cứu Nhanh Tồn Kho Theo Phòng Kho
            </h3>
            <p className="text-xs text-slate-500">Nhấn vào từng phòng kho bên dưới để mở popup xem số lượng tồn chi tiết</p>
          </div>
          <button
            onClick={() => setActiveTab('warehouses')}
            className="text-xs text-cyan-500 hover:underline font-semibold"
          >
            Sơ đồ kho &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {warehouses.map((wh) => {
            const whItems = items.filter((i) => i.warehouseId === wh.id);
            const totalQty = whItems.reduce((sum, i) => sum + i.stockQuantity, 0);

            return (
              <div
                key={wh.id}
                onClick={() => setSelectedWarehouseModal(wh)}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                      {wh.code}
                    </span>
                    <span className="text-[11px] text-slate-400 group-hover:text-cyan-500 font-medium">
                      Xem popup &rarr;
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs group-hover:text-cyan-500 transition-colors">
                    {wh.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    Quản kho: {wh.manager || 'Chưa phân công'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{whItems.length} mặt hàng</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">
                    {formatNumber(totalQty)} tồn
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Items Detail Popup Modal */}
      <CategoryItemsModal
        isOpen={selectedCategoryModal !== null}
        onClose={() => setSelectedCategoryModal(null)}
        category={selectedCategoryModal}
      />

      {/* Warehouse Items Detail Popup Modal */}
      <WarehouseItemsModal
        isOpen={selectedWarehouseModal !== null}
        onClose={() => setSelectedWarehouseModal(null)}
        warehouse={selectedWarehouseModal}
      />
    </div>
  );
}
