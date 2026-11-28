import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Package,
  Search,
  ArrowUpRight,
  ArrowUpDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useInventoryStore } from '../../store/useInventoryStore';
import { formatNumber } from '../../lib/formatters';
import { exportStatisticsToExcel } from '../../lib/excel';

type PeriodType = 'month' | 'quarter' | 'year';
type StatTab = 'by-department' | 'by-product';

interface ParsedDateParts {
  year: number;
  month: number; // 1..12
  quarter: number; // 1..4
}

function parseDateParts(dateStr: string): ParsedDateParts | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Match YYYY-MM-DD or YYYY-MM-DDTHH:mm...
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return { year, month, quarter: Math.ceil(month / 3) };
    }
  }

  // Match DD/MM/YYYY
  const vnMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vnMatch) {
    const month = Number(vnMatch[2]);
    const year = Number(vnMatch[3]);
    if (year >= 1900 && month >= 1 && month <= 12) {
      return { year, month, quarter: Math.ceil(month / 3) };
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    return { year, month, quarter: Math.ceil(month / 3) };
  }

  return null;
}

interface OutboundLineRecord {
  voucherId: string;
  voucherCode: string;
  date: string;
  department: string;
  warehouseId: string;
  warehouseName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  unitName: string;
  quantity: number;
}

interface DepartmentProductDetail {
  itemKey: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  unitName: string;
  quantity: number;
  voucherCount: number;
}

interface DepartmentStat {
  department: string;
  totalQuantity: number;
  voucherCount: number;
  distinctProductsCount: number;
  sharePercent: number;
  products: DepartmentProductDetail[];
}

interface ProductDepartmentDetail {
  department: string;
  quantity: number;
  voucherCount: number;
}

interface ProductStat {
  itemKey: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  unitName: string;
  totalQuantity: number;
  voucherCount: number;
  departmentCount: number;
  currentStock: number | null;
  sharePercent: number;
  departments: ProductDepartmentDetail[];
}

const CHART_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6'];

export function StatisticsView() {
  const { items, vouchers, logs, warehouses, setActiveTab } = useInventoryStore();

  const itemMetaById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const itemMetaByCode = useMemo(() => new Map(items.map((it) => [it.code, it])), [items]);

  // Build normalized outbound line items from vouchers + fallback logs
  const allOutboundRecords = useMemo<OutboundLineRecord[]>(() => {
    const records: OutboundLineRecord[] = [];
    const seenVoucherIds = new Set<string>();

    vouchers
      .filter((v) => v.type === 'OUT')
      .forEach((v) => {
        seenVoucherIds.add(v.id);
        const dept = (v.department || '').trim() || 'Chưa phân bộ phận';

        let lineItems = v.items || [];
        if (lineItems.length === 0) {
          const matchingLogs = logs.filter(
            (l) =>
              l.type === 'OUT' &&
              ((l.voucherId && l.voucherId === v.id) || (l.voucherCode && v.code && l.voucherCode === v.code))
          );
          lineItems = matchingLogs.map((l) => {
            const meta = itemMetaById.get(l.itemId) || itemMetaByCode.get(l.itemCode);
            return {
              itemId: l.itemId,
              itemCode: l.itemCode,
              itemName: l.itemName,
              unitName: meta?.unitName || '',
              quantity: l.quantity,
            };
          });
        }

        lineItems.forEach((li) => {
          const qty = Number(li.quantity) || 0;
          if (qty <= 0) return;
          const meta = itemMetaById.get(li.itemId) || itemMetaByCode.get(li.itemCode);
          records.push({
            voucherId: v.id,
            voucherCode: v.code,
            date: v.date,
            department: dept,
            warehouseId: v.warehouseId,
            warehouseName: v.warehouseName,
            itemId: li.itemId || meta?.id || li.itemCode,
            itemCode: li.itemCode || meta?.code || '-',
            itemName: li.itemName || meta?.name || 'Sản phẩm không xác định',
            categoryName: meta?.categoryName || '',
            unitName: li.unitName || meta?.unitName || '',
            quantity: qty,
          });
        });
      });

    // Include any orphan OUT logs that don't have a voucher entry
    logs
      .filter((l) => l.type === 'OUT' && !seenVoucherIds.has(l.voucherId))
      .forEach((l) => {
        const qty = Number(l.quantity) || 0;
        if (qty <= 0) return;
        const meta = itemMetaById.get(l.itemId) || itemMetaByCode.get(l.itemCode);
        records.push({
          voucherId: l.voucherId || l.id,
          voucherCode: l.voucherCode || '-',
          date: l.date,
          department: (l.department || '').trim() || 'Chưa phân bộ phận',
          warehouseId: l.warehouseId,
          warehouseName: l.warehouseName,
          itemId: l.itemId || meta?.id || l.itemCode,
          itemCode: l.itemCode || meta?.code || '-',
          itemName: l.itemName || meta?.name || 'Sản phẩm không xác định',
          categoryName: l.categoryName || meta?.categoryName || '',
          unitName: meta?.unitName || '',
          quantity: qty,
        });
      });

    return records;
  }, [vouchers, logs, itemMetaById, itemMetaByCode]);

  // Available years & smart default period from data
  const { availableYears, defaultYear, defaultMonth } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const yearSet = new Set<number>([currentYear]);
    let latestScore = 0;
    let latestYear = currentYear;
    let latestMonth = currentMonth;

    allOutboundRecords.forEach((r) => {
      const parts = parseDateParts(r.date);
      if (parts) {
        yearSet.add(parts.year);
        const score = parts.year * 100 + parts.month;
        if (score > latestScore) {
          latestScore = score;
          latestYear = parts.year;
          latestMonth = parts.month;
        }
      }
    });

    const years = Array.from(yearSet).sort((a, b) => b - a);
    return {
      availableYears: years,
      defaultYear: latestScore > 0 ? latestYear : currentYear,
      defaultMonth: latestScore > 0 ? latestMonth : currentMonth,
    };
  }, [allOutboundRecords]);

  // Filter States
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil(defaultMonth / 3));
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeStatTab, setActiveStatTab] = useState<StatTab>('by-department');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Expanded row keys
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Distinct departments list across outbound records for filter dropdown
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    allOutboundRecords.forEach((r) => set.add(r.department));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allOutboundRecords]);

  // Filtered outbound records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allOutboundRecords.filter((r) => {
      const parts = parseDateParts(r.date);
      if (!parts) return false;

      if (parts.year !== selectedYear) return false;
      if (periodType === 'month' && parts.month !== selectedMonth) return false;
      if (periodType === 'quarter' && parts.quarter !== selectedQuarter) return false;

      if (selectedWarehouse !== 'ALL' && r.warehouseId !== selectedWarehouse) return false;
      if (selectedDepartmentFilter !== 'ALL' && r.department !== selectedDepartmentFilter) return false;

      if (q) {
        const matchesDept = r.department.toLowerCase().includes(q);
        const matchesCode = r.itemCode.toLowerCase().includes(q);
        const matchesName = r.itemName.toLowerCase().includes(q);
        const matchesCat = r.categoryName.toLowerCase().includes(q);
        if (!matchesDept && !matchesCode && !matchesName && !matchesCat) return false;
      }

      return true;
    });
  }, [
    allOutboundRecords,
    periodType,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    selectedWarehouse,
    selectedDepartmentFilter,
    searchQuery,
  ]);

  // Period label for display & Excel export
  const periodLabel = useMemo(() => {
    if (periodType === 'month') return `Tháng ${selectedMonth}/${selectedYear}`;
    if (periodType === 'quarter') return `Quý ${selectedQuarter}/${selectedYear}`;
    return `Năm ${selectedYear}`;
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  // Aggregations: KPIs, Department Stats, Product Stats
  const { totalIssuedQty, totalVouchersCount, departmentStats, productStats } = useMemo(() => {
    let totalQty = 0;
    const voucherSet = new Set<string>();

    const deptMap = new Map<
      string,
      {
        department: string;
        totalQuantity: number;
        vouchers: Set<string>;
        productsMap: Map<string, DepartmentProductDetail & { vouchers: Set<string> }>;
      }
    >();

    const prodMap = new Map<
      string,
      {
        itemKey: string;
        itemId: string;
        itemCode: string;
        itemName: string;
        categoryName: string;
        unitName: string;
        totalQuantity: number;
        vouchers: Set<string>;
        departmentsMap: Map<string, ProductDepartmentDetail & { vouchers: Set<string> }>;
      }
    >();

    filteredRecords.forEach((r) => {
      totalQty += r.quantity;
      voucherSet.add(r.voucherId);

      // 1. Department aggregation
      let deptEntry = deptMap.get(r.department);
      if (!deptEntry) {
        deptEntry = {
          department: r.department,
          totalQuantity: 0,
          vouchers: new Set<string>(),
          productsMap: new Map(),
        };
        deptMap.set(r.department, deptEntry);
      }
      deptEntry.totalQuantity += r.quantity;
      deptEntry.vouchers.add(r.voucherId);

      const itemKey = r.itemId || r.itemCode;
      let deptProd = deptEntry.productsMap.get(itemKey);
      if (!deptProd) {
        deptProd = {
          itemKey,
          itemId: r.itemId,
          itemCode: r.itemCode,
          itemName: r.itemName,
          categoryName: r.categoryName,
          unitName: r.unitName,
          quantity: 0,
          voucherCount: 0,
          vouchers: new Set<string>(),
        };
        deptEntry.productsMap.set(itemKey, deptProd);
      }
      deptProd.quantity += r.quantity;
      deptProd.vouchers.add(r.voucherId);
      deptProd.voucherCount = deptProd.vouchers.size;

      // 2. Product aggregation
      let prodEntry = prodMap.get(itemKey);
      if (!prodEntry) {
        prodEntry = {
          itemKey,
          itemId: r.itemId,
          itemCode: r.itemCode,
          itemName: r.itemName,
          categoryName: r.categoryName,
          unitName: r.unitName,
          totalQuantity: 0,
          vouchers: new Set<string>(),
          departmentsMap: new Map(),
        };
        prodMap.set(itemKey, prodEntry);
      }
      prodEntry.totalQuantity += r.quantity;
      prodEntry.vouchers.add(r.voucherId);

      let prodDept = prodEntry.departmentsMap.get(r.department);
      if (!prodDept) {
        prodDept = {
          department: r.department,
          quantity: 0,
          voucherCount: 0,
          vouchers: new Set<string>(),
        };
        prodEntry.departmentsMap.set(r.department, prodDept);
      }
      prodDept.quantity += r.quantity;
      prodDept.vouchers.add(r.voucherId);
      prodDept.voucherCount = prodDept.vouchers.size;
    });

    const deptList: DepartmentStat[] = Array.from(deptMap.values()).map((d) => {
      const products = Array.from(d.productsMap.values())
        .map(({ vouchers: _v, ...rest }) => rest)
        .sort((a, b) => b.quantity - a.quantity);
      return {
        department: d.department,
        totalQuantity: d.totalQuantity,
        voucherCount: d.vouchers.size,
        distinctProductsCount: products.length,
        sharePercent: totalQty > 0 ? (d.totalQuantity / totalQty) * 100 : 0,
        products,
      };
    });

    deptList.sort((a, b) =>
      sortDirection === 'desc' ? b.totalQuantity - a.totalQuantity : a.totalQuantity - b.totalQuantity
    );

    const prodList: ProductStat[] = Array.from(prodMap.values()).map((p) => {
      const meta = itemMetaById.get(p.itemId) || itemMetaByCode.get(p.itemCode);
      const departments = Array.from(p.departmentsMap.values())
        .map(({ vouchers: _v, ...rest }) => rest)
        .sort((a, b) => b.quantity - a.quantity);
      return {
        itemKey: p.itemKey,
        itemId: p.itemId,
        itemCode: p.itemCode,
        itemName: p.itemName,
        categoryName: p.categoryName,
        unitName: p.unitName,
        totalQuantity: p.totalQuantity,
        voucherCount: p.vouchers.size,
        departmentCount: departments.length,
        currentStock: meta ? meta.stockQuantity : null,
        sharePercent: totalQty > 0 ? (p.totalQuantity / totalQty) * 100 : 0,
        departments,
      };
    });

    prodList.sort((a, b) =>
      sortDirection === 'desc' ? b.totalQuantity - a.totalQuantity : a.totalQuantity - b.totalQuantity
    );

    return {
      totalIssuedQty: totalQty,
      totalVouchersCount: voucherSet.size,
      departmentStats: deptList,
      productStats: prodList,
    };
  }, [filteredRecords, sortDirection, itemMetaById, itemMetaByCode]);

  // Chart data (always top 10 descending regardless of table sort)
  const deptChartData = useMemo(
    () =>
      [...departmentStats]
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10)
        .map((d) => ({
          name: d.department.length > 16 ? d.department.slice(0, 15) + '…' : d.department,
          fullName: d.department,
          'Số lượng': d.totalQuantity,
          vouchers: d.voucherCount,
        })),
    [departmentStats]
  );

  const productChartData = useMemo(
    () =>
      [...productStats]
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10)
        .map((p) => ({
          name: p.itemName.length > 22 ? p.itemName.slice(0, 20) + '…' : p.itemName,
          fullName: `${p.itemCode} - ${p.itemName}`,
          unitName: p.unitName,
          'Số lượng': p.totalQuantity,
        })),
    [productStats]
  );

  const toggleDepartmentExpand = (dept: string) => {
    setExpandedDepartments((prev) => ({ ...prev, [dept]: !prev[dept] }));
  };

  const toggleProductExpand = (key: string) => {
    setExpandedProducts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportExcel = () => {
    const safePeriod = periodLabel.replace(/[\s/]+/g, '_');
    exportStatisticsToExcel(
      periodLabel,
      departmentStats,
      productStats,
      `Thong_ke_cap_phat_${safePeriod}.xlsx`
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Filter & Period Bar */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-500 shrink-0" />
              <span>Thống Kê Cấp Phát Sản Phẩm</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kỳ đang xem: <span className="font-semibold text-slate-700 dark:text-slate-200">{periodLabel}</span>
              {' · '}
              Dữ liệu tổng hợp từ các phiếu xuất kho
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Type Segmented Control */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {(
                [
                  { id: 'month', label: 'Theo Tháng' },
                  { id: 'quarter', label: 'Theo Quý' },
                  { id: 'year', label: 'Theo Năm' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriodType(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    periodType === opt.id
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Sub-filters: Year, Month/Quarter, Warehouse, Department, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Year Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-3 py-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <label htmlFor="stat-year" className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Năm:
            </label>
            <select
              id="stat-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr} className="bg-white dark:bg-slate-900">
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Month or Quarter Selector */}
          {periodType === 'month' && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-3 py-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <label htmlFor="stat-month" className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Tháng:
              </label>
              <select
                id="stat-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m} className="bg-white dark:bg-slate-900">
                    Tháng {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'quarter' && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-3 py-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <label htmlFor="stat-quarter" className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Quý:
              </label>
              <select
                id="stat-quarter"
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value={1} className="bg-white dark:bg-slate-900">Quý 1 (Tháng 1 – 3)</option>
                <option value={2} className="bg-white dark:bg-slate-900">Quý 2 (Tháng 4 – 6)</option>
                <option value={3} className="bg-white dark:bg-slate-900">Quý 3 (Tháng 7 – 9)</option>
                <option value={4} className="bg-white dark:bg-slate-900">Quý 4 (Tháng 10 – 12)</option>
              </select>
            </div>
          )}

          {/* Warehouse Filter */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-3 py-2">
            <select
              aria-label="Lọc theo phòng kho"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">Tất cả Phòng Kho</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id} className="bg-white dark:bg-slate-900">
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-3 py-2">
            <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              aria-label="Lọc theo bộ phận"
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">Tất cả Bộ Phận</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept} className="bg-white dark:bg-slate-900">
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div
            className={`relative flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-3 py-2 ${
              periodType === 'year' ? 'lg:col-span-2' : ''
            }`}
          >
            <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm bộ phận, mã hàng, tên sản phẩm..."
              className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Tổng SL Sản Phẩm Đã Cấp</span>
            <ArrowUpRight className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {formatNumber(totalIssuedQty)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tổng đơn vị xuất trong {periodLabel.toLowerCase()}
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Bộ Phận Đã Nhận</span>
            <Building2 className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatNumber(departmentStats.length)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {departmentStats[0]
              ? `Nhiều nhất: ${departmentStats[0].department}`
              : 'Chưa có bộ phận nhận'}
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Sản Phẩm Được Cấp</span>
            <Package className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatNumber(productStats.length)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {productStats[0]
              ? `Top: ${productStats[0].itemName}`
              : 'Chưa có sản phẩm xuất'}
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Phiếu Xuất Kho</span>
            <FileSpreadsheet className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatNumber(totalVouchersCount)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tổng phiếu xuất phát sinh trong kỳ
          </p>
        </div>
      </div>

      {/* Empty State or Data Visualizations + Tables */}
      {filteredRecords.length === 0 ? (
        <div className="p-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Chưa có dữ liệu xuất kho trong {periodLabel}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Không tìm thấy phiếu xuất kho nào phù hợp với bộ lọc thời gian và điều kiện hiện tại. Hãy chọn kỳ khác hoặc tạo phiếu xuất kho mới.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {periodType !== 'year' && (
              <button
                type="button"
                onClick={() => setPeriodType('year')}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Xem cả năm {selectedYear}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('stock-out')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            >
              Đi tới Xuất kho
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: By Department */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Số Lượng Sản Phẩm Theo Bộ Phận Nhận
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Top bộ phận tiếp nhận nhiều nhất · {periodLabel}
                  </p>
                </div>
                <Building2 className="h-4 w-4 text-amber-500 shrink-0" />
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptChartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={deptChartData.length > 5 ? -20 : 0}
                      textAnchor={deptChartData.length > 5 ? 'end' : 'middle'}
                      height={deptChartData.length > 5 ? 52 : 30}
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                      formatter={(value: any) => [`${formatNumber(Number(value))} sản phẩm`, 'Đã nhận']}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || _label}
                    />
                    <Bar dataKey="Số lượng" radius={[6, 6, 0, 0]}>
                      {deptChartData.map((_, idx) => (
                        <Cell key={`dept-bar-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: By Issued Product */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Số Lượng Theo Sản Phẩm Đã Được Cấp
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Top sản phẩm cấp phát nhiều nhất · {periodLabel}
                  </p>
                </div>
                <Package className="h-4 w-4 text-cyan-500 shrink-0" />
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={productChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      width={130}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                      formatter={(value: any, _name: any, props: any) => [
                        `${formatNumber(Number(value))} ${props?.payload?.unitName || 'đơn vị'}`,
                        'Đã cấp',
                      ]}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || _label}
                    />
                    <Bar dataKey="Số lượng" fill="#06b6d4" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detail Tables Section */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Switcher between Department view & Product view */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start">
                <button
                  type="button"
                  onClick={() => setActiveStatTab('by-department')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeStatTab === 'by-department'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                  <span>Theo Bộ Phận Nhận ({departmentStats.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStatTab('by-product')}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeStatTab === 'by-product'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Package className="h-3.5 w-3.5 text-cyan-500" />
                  <span>Theo Sản Phẩm Đã Cấp ({productStats.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Nhấn vào dòng để xem chi tiết phân bổ</span>
                <button
                  type="button"
                  onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span>{sortDirection === 'desc' ? 'SL Giảm dần' : 'SL Tăng dần'}</span>
                </button>
              </div>
            </div>

            {/* Table 1: By Department */}
            {activeStatTab === 'by-department' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">Bộ Phận Nhận</th>
                      <th className="p-3 text-right">Số Phiếu Xuất</th>
                      <th className="p-3 text-right">Số Mặt Hàng</th>
                      <th className="p-3 text-right">Tổng SL Đã Nhận</th>
                      <th className="p-3 w-48 text-right">Tỷ Trọng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {departmentStats.map((dept, index) => {
                      const isExpanded = !!expandedDepartments[dept.department];
                      return (
                        <React.Fragment key={dept.department}>
                          <tr
                            onClick={() => toggleDepartmentExpand(dept.department)}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="p-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 inline text-cyan-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 inline" />
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                              <span>{index + 1}. {dept.department}</span>
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {formatNumber(dept.voucherCount)}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {formatNumber(dept.distinctProductsCount)}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums font-bold text-cyan-600 dark:text-cyan-400">
                              {formatNumber(dept.totalQuantity)}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-cyan-500 rounded-full"
                                    style={{ width: `${Math.min(100, dept.sharePercent)}%` }}
                                  />
                                </div>
                                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 w-12 text-right">
                                  {dept.sharePercent.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-950/50">
                              <td colSpan={6} className="px-6 py-3">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                  Chi tiết sản phẩm bộ phận {dept.department} đã nhận trong {periodLabel}
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                                      <th className="py-2 pr-3 font-medium">Mã Hàng</th>
                                      <th className="py-2 pr-3 font-medium">Tên Sản Phẩm</th>
                                      <th className="py-2 pr-3 font-medium">Nhóm Hàng</th>
                                      <th className="py-2 pr-3 text-center font-medium">ĐVT</th>
                                      <th className="py-2 pr-3 text-right font-medium">Số Lần Nhận</th>
                                      <th className="py-2 text-right font-medium">SL Đã Nhận</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                    {dept.products.map((prod) => (
                                      <tr key={prod.itemKey}>
                                        <td className="py-2 pr-3 font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                                          {prod.itemCode}
                                        </td>
                                        <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">
                                          {prod.itemName}
                                        </td>
                                        <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">
                                          {prod.categoryName || '-'}
                                        </td>
                                        <td className="py-2 pr-3 text-center text-slate-500 dark:text-slate-400">
                                          {prod.unitName || '-'}
                                        </td>
                                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                          {formatNumber(prod.voucherCount)}
                                        </td>
                                        <td className="py-2 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                                          {formatNumber(prod.quantity)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 2: By Issued Product */}
            {activeStatTab === 'by-product' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">Mã Hàng</th>
                      <th className="p-3">Sản Phẩm</th>
                      <th className="p-3 text-center">ĐVT</th>
                      <th className="p-3 text-right">Bộ Phận Nhận</th>
                      <th className="p-3 text-right">Số Lần Cấp</th>
                      <th className="p-3 text-right">Tồn Hiện Tại</th>
                      <th className="p-3 text-right">Tổng SL Đã Cấp</th>
                      <th className="p-3 w-40 text-right">Tỷ Trọng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {productStats.map((prod) => {
                      const isExpanded = !!expandedProducts[prod.itemKey];
                      return (
                        <React.Fragment key={prod.itemKey}>
                          <tr
                            onClick={() => toggleProductExpand(prod.itemKey)}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="p-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 inline text-cyan-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 inline" />
                              )}
                            </td>
                            <td className="p-3 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                              {prod.itemCode}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {prod.itemName}
                              </div>
                              {prod.categoryName && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {prod.categoryName}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center text-slate-500 dark:text-slate-400">
                              {prod.unitName || '-'}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {formatNumber(prod.departmentCount)}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {formatNumber(prod.voucherCount)}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              {prod.currentStock !== null ? formatNumber(prod.currentStock) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                              {formatNumber(prod.totalQuantity)}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{ width: `${Math.min(100, prod.sharePercent)}%` }}
                                  />
                                </div>
                                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 w-12 text-right">
                                  {prod.sharePercent.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-950/50">
                              <td colSpan={9} className="px-6 py-3">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                  Phân bổ sản phẩm {prod.itemName} theo bộ phận nhận · {periodLabel}
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                                      <th className="py-2 pr-3 font-medium">Bộ Phận Nhận</th>
                                      <th className="py-2 pr-3 text-right font-medium">Số Lần Nhận</th>
                                      <th className="py-2 pr-3 text-right font-medium">Số Lượng Đã Cấp</th>
                                      <th className="py-2 text-right font-medium">Tỷ Lệ Trong Sản Phẩm</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                                    {prod.departments.map((d) => {
                                      const pct = prod.totalQuantity > 0 ? (d.quantity / prod.totalQuantity) * 100 : 0;
                                      return (
                                        <tr key={d.department}>
                                          <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">
                                            {d.department}
                                          </td>
                                          <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                            {formatNumber(d.voucherCount)}
                                          </td>
                                          <td className="py-2 pr-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                                            {formatNumber(d.quantity)} {prod.unitName}
                                          </td>
                                          <td className="py-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                            {pct.toFixed(1)}%
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
