import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Package,
  Warehouse,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { formatNumber } from '../../lib/formatters';

interface HeaderProps {
  onOpenQuickStockIn: () => void;
  onOpenQuickStockOut: () => void;
}

function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function Header({ onOpenQuickStockIn, onOpenQuickStockOut }: HeaderProps) {
  const {
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    items,
    isSupabaseConnected,
    isLoadingFromSupabase,
    fetchFromSupabase,
  } = useInventoryStore();

  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items based on query
  const trimmedQuery = searchTerm.trim().toLowerCase();
  const normalizedQuery = removeAccents(trimmedQuery);

  const matchedItems = trimmedQuery
    ? items.filter((item) => {
        const nameNorm = removeAccents(item.name.toLowerCase());
        const codeNorm = removeAccents(item.code.toLowerCase());
        const catNorm = removeAccents((item.categoryName || '').toLowerCase());
        const whNorm = removeAccents((item.warehouseName || '').toLowerCase());
        const noteNorm = removeAccents((item.note || '').toLowerCase());

        return (
          codeNorm.includes(normalizedQuery) ||
          nameNorm.includes(normalizedQuery) ||
          catNorm.includes(normalizedQuery) ||
          whNorm.includes(normalizedQuery) ||
          noteNorm.includes(normalizedQuery)
        );
      })
    : [];

  // Tab Titles mapping
  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Sales Activity Dashboard', subtitle: 'Tổng quan chỉ số kho & hiệu suất vận hành' },
    warehouses: { title: 'Quản Lý Kho', subtitle: 'Danh sách các phòng kho & địa điểm lưu trữ vật tư' },
    items: { title: 'Danh Mục Hàng Hóa', subtitle: 'Quản lý thông tin, mã hàng, đơn vị tính & định mức tồn' },
    'stock-in': { title: 'Phiếu Nhập Kho', subtitle: 'Tạo phiếu nhập vật tư & tự động cộng tồn kho' },
    'stock-out': { title: 'Phiếu Xuất Kho', subtitle: 'Tạo phiếu xuất cấp phát & tự động trừ tồn kho' },
    'stock-lookup': { title: 'Tra Cứu Tồn Kho', subtitle: 'Kiểm tra nhanh số lượng tồn, lọc vị trí kho & cảnh báo' },
    history: { title: 'Lịch Sử Nhập Xuất', subtitle: 'Theo dõi toàn bộ biến động kho chi tiết theo thời gian' },
    reports: { title: 'Báo Cáo Thống Kê', subtitle: 'Thống kê tổng hợp Nhập - Xuất - Tồn & phân tích mặt hàng' },
    categories: { title: 'Quản Lý Danh Mục', subtitle: 'Phân loại nhóm hàng & danh mục đơn vị tính linh hoạt' },
    settings: { title: 'Cài Đặt & Thiết Lập', subtitle: 'Cấu hình hệ thống, dữ liệu mẫu & giao diện' },
  };

  const currentTabInfo = tabTitles[activeTab] || { title: 'Quản Lý Kho', subtitle: '' };

  const handleSelectItem = (itemCode: string) => {
    setSearchTerm(itemCode);
    setActiveTab('stock-lookup');
    setIsOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/90 px-4 md:px-6 backdrop-blur-md transition-colors">
      {/* Title & Subtitle */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {currentTabInfo.title}
          </h2>
          <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
            {currentTabInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Center Search bar with live autocomplete */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-6" ref={searchRef}>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm mã, tên hàng, kho..."
            value={searchTerm}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-1.5 pl-9 pr-8 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setIsOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Autocomplete Dropdown Popup */}
          {isOpen && trimmedQuery && (
            <div className="absolute left-0 right-0 top-full mt-2 w-[420px] max-w-[90vw] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Kết quả tìm kiếm ({matchedItems.length})
                </span>
                <span className="text-[10px] text-slate-400">Bấm sản phẩm để tra cứu</span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {matchedItems.length > 0 ? (
                  matchedItems.map((item) => {
                    const isOutOfStock = item.stockQuantity <= 0;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item.code)}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group flex items-start justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                              {item.code}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                              {item.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate">{item.categoryName}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                              <Warehouse className="h-3 w-3 text-slate-400" />
                              {item.warehouseName}
                            </span>
                          </div>
                        </div>

                        {/* Stock Quantity Badge */}
                        <div className="text-right shrink-0">
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                              isOutOfStock
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isOutOfStock ? (
                              <XCircle className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            <span>
                              {formatNumber(item.stockQuantity)} {item.unitName}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {isOutOfStock ? 'Hết hàng' : 'Còn hàng'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p>Không tìm thấy sản phẩm nào phù hợp với từ khóa "{searchTerm}"</p>
                  </div>
                )}
              </div>

              {matchedItems.length > 0 && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setActiveTab('stock-lookup');
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    <span>Xem tất cả trong trang Tra Cứu Tồn Kho</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Supabase Status & Refresh */}
        <button
          onClick={() => fetchFromSupabase()}
          disabled={isLoadingFromSupabase}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            isSupabaseConnected
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          }`}
          title="Đồng bộ dữ liệu từ Supabase"
        >
          <Database className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {isSupabaseConnected ? 'Supabase' : 'Chưa kết nối DB'}
          </span>
          <RefreshCw className={`h-3 w-3 ${isLoadingFromSupabase ? 'animate-spin' : ''}`} />
        </button>

        {/* Quick Action (+ Nhập / + Xuất) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenQuickStockIn}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
            title="Tạo phiếu nhập kho mới"
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>+ Nhập kho</span>
          </button>
          <button
            onClick={onOpenQuickStockOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
            title="Tạo phiếu xuất kho mới"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>+ Xuất kho</span>
          </button>
        </div>
      </div>
    </header>
  );
}

