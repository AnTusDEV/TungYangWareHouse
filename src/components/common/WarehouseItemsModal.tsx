import React, { useState } from 'react';
import {
  Warehouse as WarehouseIcon,
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  User,
  ExternalLink,
  Info,
  Layers,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Warehouse } from '../../types/inventory';
import { Modal } from './Modal';
import { formatNumber, getStockStatus } from '../../lib/formatters';

interface WarehouseItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouse: Warehouse | null;
}

export function WarehouseItemsModal({ isOpen, onClose, warehouse }: WarehouseItemsModalProps) {
  const { items, setActiveTab } = useInventoryStore();
  const [searchTerm, setSearchTerm] = useState('');

  if (!warehouse) return null;

  // Filter items for this warehouse (matching by ID or Name)
  const warehouseItems = items.filter(
    (item) =>
      item.warehouseId === warehouse.id ||
      (warehouse.name && item.warehouseName?.trim().toLowerCase() === warehouse.name.trim().toLowerCase())
  );

  // Search filter
  const filteredItems = warehouseItems.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Summary metrics
  const totalStockQty = warehouseItems.reduce((sum, item) => sum + item.stockQuantity, 0);
  const outOfStockCount = warehouseItems.filter((item) => item.stockQuantity <= 0).length;
  const lowStockCount = warehouseItems.filter(
    (item) => item.stockQuantity > 0 && item.stockQuantity <= (item.minStockLevel || 5)
  ).length;

  const handleNavigateToWarehouses = () => {
    onClose();
    setActiveTab('warehouses');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi Tiết Tồn Kho: ${warehouse.name}`}
      description={`Mã kho: ${warehouse.code} • Vị trí: ${warehouse.location || 'Chưa cập nhật'} • Quản kho: ${warehouse.manager || 'Chưa phân công'}`}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Info className="h-4 w-4 text-cyan-500" />
            <span>Hiển thị {filteredItems.length} / {warehouseItems.length} mặt hàng trong kho</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNavigateToWarehouses}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span>Sơ Đồ Kho</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow"
            >
              Đóng
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Metric Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div>
              <span className="text-slate-400">Số Mặt Hàng Lưu Trữ</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base mt-0.5">
                {formatNumber(warehouseItems.length)} Sản phẩm
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500">
              <Package className="h-5 w-5" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div>
              <span className="text-slate-400">Tổng Số Lượng Tồn Trong Kho</span>
              <div className="font-bold text-cyan-600 dark:text-cyan-400 text-base mt-0.5">
                {formatNumber(totalStockQty)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <WarehouseIcon className="h-5 w-5" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div>
              <span className="text-slate-400">Cảnh Báo Hết Kho</span>
              <div className="font-bold text-rose-600 dark:text-rose-400 text-base mt-0.5 flex items-center gap-1.5">
                <span>{outOfStockCount} hết kho</span>
                {lowStockCount > 0 && (
                  <span className="text-amber-500 text-xs font-normal">({lowStockCount} sắp hết)</span>
                )}
              </div>
            </div>
            <div className={`p-2.5 rounded-xl ${outOfStockCount > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              {outOfStockCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
          </div>
        </div>

        {/* Warehouse Detail Strip */}
        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2 border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-cyan-500" />
            <span>Địa điểm: <strong className="text-slate-800 dark:text-slate-200">{warehouse.location || 'Chưa có thông tin'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-cyan-500" />
            <span>Quản kho: <strong className="text-slate-800 dark:text-slate-200">{warehouse.manager || 'Chưa phân công'}</strong></span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm sản phẩm theo Mã SP, Tên sản phẩm, Nhóm hàng..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Products Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[50vh]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 font-semibold sticky top-0 backdrop-blur-md z-10">
              <tr>
                <th className="p-3">Mã SP</th>
                <th className="p-3">Tên Sản Phẩm</th>
                <th className="p-3">Nhóm Hàng Hóa</th>
                <th className="p-3 text-center">ĐVT</th>
                <th className="p-3 text-center">Định Mức (Min-Max)</th>
                <th className="p-3 text-right">Số Lượng Tồn Tại Kho</th>
                <th className="p-3 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const status = getStockStatus(item.stockQuantity, item.minStockLevel);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.code}
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100 min-w-[160px]">
                        <div>{item.name}</div>
                        {item.note && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {item.note}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Layers className="h-3 w-3 text-cyan-500" />
                          <span>{item.categoryName || 'Khác'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center text-slate-500 font-medium">
                        {item.unitName || '—'}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                        {item.minStockLevel || 0} - {item.maxStockLevel || '∞'}
                      </td>
                      <td className={`p-3 text-right font-bold font-mono text-sm ${status.textClass}`}>
                        {formatNumber(item.stockQuantity)}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.badgeClass}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <WarehouseIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <span>
                        {warehouseItems.length === 0
                          ? 'Phòng kho này hiện chưa có mặt hàng nào lưu trữ.'
                          : 'Không tìm thấy sản phẩm phù hợp với từ khóa.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
