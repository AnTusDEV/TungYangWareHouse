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
  User,
  Shield,
  KeyRound,
  LogOut,
  ChevronDown,
  Users,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatNumber } from '../../lib/formatters';
import { ProfileModal } from '../auth/ProfileModal';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

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
  } = useInventoryStore();

  const { currentUser, logout } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
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
    accounts: { title: 'Quản Lý Tài Khoản', subtitle: 'Quản lý người dùng, phân quyền & bảo mật hệ thống' },
    settings: { title: 'Cài Đặt & Thiết Lập', subtitle: 'Cấu hình hệ thống, kết nối CSDL & giao diện' },
  };

  const currentTabInfo = tabTitles[activeTab] || { title: 'Quản Lý Kho', subtitle: '' };

  const handleSelectItem = (itemCode: string) => {
    setSearchTerm(itemCode);
    setActiveTab('stock-lookup');
    setIsOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b-2 border-amber-500 bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 dark:bg-slate-900 px-4 md:px-6 shadow-md transition-colors">
        {/* Title & Subtitle with Gold accent line */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-amber-400 to-red-600 shrink-0" />
          <div>
            <h2 className="text-base font-extrabold text-amber-400 dark:text-amber-300 tracking-tight flex items-center gap-2">
              <span>{currentTabInfo.title}</span>
            </h2>
            <p className="hidden sm:block text-xs text-slate-300 dark:text-slate-400">
              {currentTabInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Center Search bar with live autocomplete */}
        <div className="hidden lg:flex items-center flex-1 max-w-md mx-6" ref={searchRef}>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Tìm theo mã hàng, tên vật tư, loại kho..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-amber-500/40 bg-slate-950/80 dark:bg-slate-800/80 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Dropdown Results */}
            {isOpen && searchTerm.trim() !== '' && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-amber-500/30 bg-slate-900 shadow-2xl overflow-hidden z-50 animate-fadeIn">
                <div className="p-2 border-b border-slate-800 text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Kết quả tìm kiếm ({matchedItems.length})
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                  {matchedItems.length > 0 ? (
                    matchedItems.slice(0, 8).map((item) => {
                      const isLowStock =
                        item.minStockLevel !== undefined && item.stockQuantity <= item.minStockLevel;
                      const isOutOfStock = item.stockQuantity <= 0;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item.code)}
                          className="p-3 hover:bg-slate-800/80 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                              <Package className="h-4 w-4" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-amber-400">
                                  {item.code}
                                </span>
                                <span className="text-xs font-medium text-slate-100 truncate">
                                  {item.name}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">
                                {item.warehouseName} &bull; {item.categoryName}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-white font-mono">
                              {formatNumber(item.stockQuantity)} {item.unitName}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {isOutOfStock ? 'Hết hàng' : 'Còn hàng'}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-slate-600" />
                      <p>Không tìm thấy sản phẩm nào phù hợp với từ khóa "{searchTerm}"</p>
                    </div>
                  )}
                </div>

                {matchedItems.length > 0 && (
                  <div className="p-2 bg-slate-950 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setActiveTab('stock-lookup');
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-amber-400 hover:underline"
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

        {/* Right Actions & User Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Actions (+ Nhập / + Xuất) */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={onOpenQuickStockIn}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all border border-yellow-200/40"
              title="Tạo phiếu nhập kho mới"
            >
              <ArrowDownLeft className="h-3.5 w-3.5 text-slate-950" />
              <span>+ Nhập kho</span>
            </button>
            <button
              onClick={onOpenQuickStockOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-md shadow-red-700/20 transition-all border border-red-500/40"
              title="Tạo phiếu xuất kho mới"
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-white" />
              <span>+ Xuất kho</span>
            </button>
          </div>

          {/* User Account Menu Dropdown */}
          {currentUser && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border border-amber-500/30 bg-slate-950/60 hover:bg-slate-800 transition-all select-none"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-red-950 flex items-center justify-center font-extrabold text-xs shadow-md shadow-amber-500/20 border border-yellow-200">
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                    <span>{currentUser.fullName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {currentUser.role === 'admin' ? 'Admin' : 'Thủ kho'}
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-200/70 font-mono">
                    @{currentUser.username} &bull; {currentUser.position}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-1.5 z-50 animate-fadeIn space-y-0.5">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.fullName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Chức vụ: {currentUser.position}</p>
                  </div>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsProfileOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <User className="h-4 w-4 text-cyan-500" />
                    <span>Thông tin cá nhân</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsPasswordOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <KeyRound className="h-4 w-4 text-blue-500" />
                    <span>Đổi mật khẩu</span>
                  </button>

                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setActiveTab('accounts');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Users className="h-4 w-4 text-purple-500" />
                      <span>Quản lý tài khoản</span>
                    </button>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* User Profile & Change Password Modals */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <ChangePasswordModal isOpen={isPasswordOpen} onClose={() => setIsPasswordOpen(false)} />
    </>
  );
}

