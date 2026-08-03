import React from 'react';
import {
  LayoutDashboard,
  Warehouse,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  History,
  BarChart3,
  Boxes,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TabType } from '../../types/inventory';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const { activeTab, setActiveTab, items } = useInventoryStore();
  const { currentUser } = useAuthStore();

  // Out of stock count
  const outOfStockCount = items.filter((item) => item.stockQuantity <= 0).length;

  const menuItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'warehouses', label: 'Kho', icon: <Warehouse className="h-4 w-4" /> },
    { id: 'items', label: 'Hàng hóa', icon: <Package className="h-4 w-4" />, badge: outOfStockCount > 0 ? outOfStockCount : undefined },
    { id: 'stock-in', label: 'Nhập kho', icon: <ArrowDownLeft className="h-4 w-4 text-emerald-500" /> },
    { id: 'stock-out', label: 'Xuất kho', icon: <ArrowUpRight className="h-4 w-4 text-rose-500" /> },
    { id: 'stock-lookup', label: 'Tồn kho', icon: <Search className="h-4 w-4" /> },
    { id: 'history', label: 'Lịch sử', icon: <History className="h-4 w-4" /> },
    { id: 'reports', label: 'Báo cáo', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'categories', label: 'Danh mục', icon: <Boxes className="h-4 w-4" /> },
    ...(currentUser?.role === 'admin'
      ? [{ id: 'accounts' as TabType, label: 'Tài khoản', icon: <Users className="h-4 w-4 text-purple-400" /> }]
      : []),
    { id: 'settings', label: 'Cài đặt', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <aside
      className={`shrink-0 flex flex-col h-full border-r border-amber-950/40 dark:border-slate-800 bg-slate-950 text-slate-300 transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* App Brand Header - Tung Yang Red Gold Identity */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-amber-500/20 bg-gradient-to-r from-slate-950 via-red-950/40 to-slate-950">
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Round Gold & Crimson Logo Emblem */}
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-red-900 font-extrabold text-xs shadow-lg shadow-amber-500/30 border-2 border-yellow-200 shrink-0 tracking-tighter">
              <span className="text-red-900 font-black tracking-tighter">TY</span>
            </div>
            <div className="truncate">
              <h1 className="text-sm font-black text-amber-400 tracking-wider truncate leading-tight uppercase">
                TUNG YANG
              </h1>
              <p className="text-[10px] text-red-400 font-bold tracking-widest uppercase">
                Nhà Máy Nhôm - Quản Lý Kho
              </p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="flex items-center justify-center w-full">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-red-900 font-black text-xs shadow-lg shadow-amber-500/30 border-2 border-yellow-200 shrink-0">
              <span className="text-red-900 font-black tracking-tighter">TY</span>
            </div>
          </div>
        )}

        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden md:flex items-center justify-center h-7 w-7 rounded-lg border border-amber-500/30 bg-slate-900 text-amber-400 hover:text-white hover:bg-red-900/60 transition-colors ${
            isCollapsed ? 'mx-auto mt-2' : ''
          }`}
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative group ${
                isActive
                  ? 'bg-gradient-to-r from-red-700 via-red-600 to-amber-600 text-white shadow-lg shadow-red-700/25 border border-amber-400/30'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-red-950/40'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div
                className={`flex items-center justify-center shrink-0 ${
                  isActive ? 'text-amber-300' : 'text-slate-400 group-hover:text-amber-400'
                }`}
              >
                {item.icon}
              </div>

              {!isCollapsed && <span className="truncate">{item.label}</span>}

              {/* Badge for Alert Counter */}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`ml-auto flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-amber-300 text-red-950'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  } ${isCollapsed ? 'absolute top-1 right-1' : ''}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Status Box */}
      {!isCollapsed && (
        <div className="p-3 m-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span>Trạng thái Kho</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sẵn sàng
            </span>
          </div>
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium pt-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{outOfStockCount} hàng đã hết kho!</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
