import React, { useState } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Calendar,
  User,
  Warehouse,
  CheckCircle,
  AlertCircle,
  Eye,
  Check,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { StockVoucher } from '../../types/inventory';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { DataTable, Column } from '../common/DataTable';
import { ProductSelect } from '../common/ProductSelect';
import {
  formatNumber,
  formatDate,
  generateVoucherCode,
} from '../../lib/formatters';

// Helper to check 24-hour limit
function get24hStatus(voucher: StockVoucher): {
  isEditable: boolean;
  text: string;
} {
  const createdAtMs = new Date(voucher.createdAt || voucher.date).getTime();
  const nowMs = Date.now();
  const diffMs = nowMs - createdAtMs;
  const maxMs = 24 * 60 * 60 * 1000;

  if (diffMs < 0 || diffMs <= maxMs) {
    const remainingMs = maxMs - (diffMs < 0 ? 0 : diffMs);
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isEditable: true,
      text: `Còn ${hours}h ${mins}m`,
    };
  }
  return {
    isEditable: false,
    text: 'Đã quá 24h',
  };
}

export function StockInManager() {
  const { currentUser } = useAuthStore();
  const currentUserName = currentUser?.fullName || currentUser?.username || 'Admin';

  const {
    items,
    warehouses,
    vouchers,
    logs,
    createStockInVoucher,
    updateStockInVoucher,
    deleteStockInVoucher,
  } = useInventoryStore();

  const inboundVouchers = vouchers.filter((v) => v.type === 'IN');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<StockVoucher | null>(null);
  const [deletingVoucher, setDeletingVoucher] = useState<StockVoucher | null>(null);
  const [viewingVoucher, setViewingVoucher] = useState<StockVoucher | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [person, setPerson] = useState<string>(currentUserName);
  const [department, setDepartment] = useState<string>('');
  const [showDepartmentList, setShowDepartmentList] = useState<boolean>(false);
  const departments = [
    'Sếp + Trợ lý',
    'Bảo vệ',
    'REICH',
    'HCNS',
    'Kế toán',
    'Kinh doanh',
    'Kế hoạch',
    'Tạp vụ',
    'Tạp vụ văn phòng',
    'Nấu ăn',
    'Lò luyện',
    'Định hình',
    'Khuôn',
    'MARK',
    'Xi mạ',
    'Sơn TĐ',
    'KCS',
    'Kho TP 1',
    'Kho TP 2',
    'Kho thô',
    'Gia công',
    'Bảo dưỡng',
  ];
  const filteredDepartments = departments.filter((item) =>
    item.toLowerCase().includes(department.trim().toLowerCase())
  );
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [note, setNote] = useState<string>('');

  // Line Items State
  const [lineItems, setLineItems] = useState<
    { itemId: string; quantity: number }[]
  >([{ itemId: items[0]?.id || '', quantity: 10 }]);

  const handleOpenCreate = () => {
    setEditingVoucher(null);
    setAlertInfo(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPerson(currentUserName);
    setDepartment('');
    setWarehouseId(warehouses[0]?.id || '');
    setNote('');
    if (items.length > 0) {
      setLineItems([{ itemId: items[0].id, quantity: 10 }]);
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: StockVoucher) => {
    const status = get24hStatus(v);
    if (!status.isEditable) {
      alert(`Phiếu nhập kho ${v.code} đã tạo quá 24 giờ (${status.text}). Không thể chỉnh sửa!`);
      return;
    }

    setEditingVoucher(v);
    setAlertInfo(null);
    setDate(v.date || new Date().toISOString().split('T')[0]);
    setPerson(v.person || currentUserName);
    setDepartment(v.department || '');
    setWarehouseId(v.warehouseId || warehouses[0]?.id || '');
    setNote(v.note || '');
    setLineItems(
      v.items.map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity,
      }))
    );
    if (viewingVoucher?.id === v.id) {
      setViewingVoucher(null);
    }
    setIsModalOpen(true);
  };

  const handleOpenDelete = (v: StockVoucher) => {
    const status = get24hStatus(v);
    if (!status.isEditable) {
      alert(`Phiếu nhập kho ${v.code} đã tạo quá 24 giờ (${status.text}). Không thể xóa!`);
      return;
    }
    setDeletingVoucher(v);
  };

  const handleConfirmDelete = () => {
    if (!deletingVoucher) return;
    const res = deleteStockInVoucher(deletingVoucher.id);
    if (res.success) {
      setAlertInfo({ type: 'success', message: res.message });
      if (viewingVoucher?.id === deletingVoucher.id) {
        setViewingVoucher(null);
      }
    } else {
      setAlertInfo({ type: 'error', message: res.message });
    }
    setDeletingVoucher(null);
  };

  const handleAddLine = () => {
    const availableItem = items.find((i) => !lineItems.some((l) => l.itemId === i.id)) || items[0];
    if (availableItem) {
      setLineItems([
        ...lineItems,
        { itemId: availableItem.id, quantity: 10 },
      ]);
    }
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, itemId: string) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      itemId,
    };
    setLineItems(updated);
  };

  const handleQtyChange = (index: number, quantity: number) => {
    const updated = [...lineItems];
    updated[index].quantity = Math.max(1, quantity);
    setLineItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertInfo(null);

    let res: { success: boolean; message: string };

    if (editingVoucher) {
      res = updateStockInVoucher(editingVoucher.id, {
        date,
        person,
        department: department.trim() || undefined,
        warehouseId,
        note,
        items: lineItems,
      });
    } else {
      res = createStockInVoucher({
        date,
        person,
        department: department.trim() || undefined,
        warehouseId,
        note,
        items: lineItems,
      });
    }

    if (res.success) {
      setAlertInfo({ type: 'success', message: res.message });
      setTimeout(() => {
        setIsModalOpen(false);
        setEditingVoucher(null);
        setAlertInfo(null);
      }, 1000);
    } else {
      setAlertInfo({ type: 'error', message: res.message });
    }
  };

  // Voucher DataTable Columns
  const columns: Column<StockVoucher>[] = [
    {
      key: 'code',
      header: 'Số Phiếu',
      sortable: true,
      render: (v) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {v.code}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Ngày Nhập',
      sortable: true,
      render: (v) => <span>{formatDate(v.date)}</span>,
    },
    {
      key: 'person',
      header: 'Người Nhập & Bộ Phận',
      sortable: true,
      render: (v) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{v.person}</span>
          {v.department && <div className="text-[11px] text-emerald-600 dark:text-emerald-400">{v.department}</div>}
        </div>
      ),
    },
    {
      key: 'warehouseName',
      header: 'Kho Nhập',
      sortable: true,
      render: (v) => <span>{v.warehouseName}</span>,
    },
    {
      key: 'totalQuantity',
      header: 'Tổng Số Lượng',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {formatNumber(v.totalQuantity)}
        </span>
      ),
    },
    {
      key: '24hStatus',
      header: 'Hạn Sửa/Xóa (24h)',
      align: 'center',
      render: (v) => {
        const status = get24hStatus(v);
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${status.isEditable
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
          >
            <Clock className="h-3 w-3" />
            {status.text}
          </span>
        );
      },
    },
    {
      key: 'note',
      header: 'Ghi Chú',
      render: (v) => <span className="text-slate-500 truncate max-w-xs">{v.note || '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'center',
      render: (v) => {
        const status = get24hStatus(v);
        return (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewingVoucher(v);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Xem chi tiết phiếu nhập"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit(v);
              }}
              disabled={!status.isEditable}
              className={`p-1.5 rounded-lg transition-colors ${status.isEditable
                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40'
                }`}
              title={
                status.isEditable
                  ? 'Chỉnh sửa phiếu (trong vòng 24h)'
                  : 'Đã quá 24h - Không thể sửa'
              }
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDelete(v);
              }}
              disabled={!status.isEditable}
              className={`p-1.5 rounded-lg transition-colors ${status.isEditable
                ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-500/10'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40'
                }`}
              title={
                status.isEditable
                  ? 'Xóa phiếu nhập (trong vòng 24h)'
                  : 'Đã quá 24h - Không thể xóa'
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner alert if any action result */}
      {alertInfo && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 shadow-sm ${alertInfo.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
            }`}
        >
          <div className="flex items-center gap-2">
            {alertInfo.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{alertInfo.message}</span>
          </div>
          <button
            onClick={() => setAlertInfo(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
            Lập Phiếu Nhập Kho ({inboundVouchers.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tạo phiếu nhập hàng hóa, bổ sung tồn kho. LƯU Ý: Sửa/xóa phiếu nhập chỉ được phép trong vòng <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">24 giờ</strong> sau khi tạo.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo Phiếu Nhập Mới</span>
        </button>
      </div>

      {/* List of Previous Inbound Vouchers */}
      <DataTable
        data={inboundVouchers}
        columns={columns}
        rowKey={(v) => v.id}
        searchKey={(v) => `${v.code} ${v.person} ${v.department || ''} ${v.warehouseName} ${v.note}`}
        searchPlaceholder="Tìm kiếm số phiếu, người nhập, bộ phận..."
        onRowClick={(v) => setViewingVoucher(v)}
      />

      {/* Create / Edit Inbound Voucher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVoucher(null);
        }}
        title={editingVoucher ? `Chỉnh Sửa Phiếu Nhập Kho: ${editingVoucher.code}` : 'Tạo Phiếu Nhập Kho Mới'}
        maxWidth="4xl"
        minHeight="min-h-[550px] sm:min-h-[650px]"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingVoucher(null);
              }}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="stock-in-form"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
            >
              <Check className="h-4 w-4" />
              {editingVoucher ? 'Cập Nhật Phiếu & Cập Nhật Tồn Kho' : 'Lưu Phiếu & Cộng Tồn Kho'}
            </button>
          </>
        }
      >
        <form id="stock-in-form" onSubmit={handleSubmit} className="space-y-6">
          {alertInfo && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${alertInfo.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                }`}
            >
              {alertInfo.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{alertInfo.message}</span>
            </div>
          )}

          {editingVoucher && (
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                Đang chỉnh sửa phiếu <strong>{editingVoucher.code}</strong>. Khi lưu, số lượng tồn kho sẽ được tự động điều chỉnh lại. ({get24hStatus(editingVoucher).text})
              </span>
            </div>
          )}

          {/* Form Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngày Nhập
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Người Nhập
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={person}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-not-allowed opacity-90"
                title="Tài khoản đăng nhập hiện tại (không thể chỉnh sửa)"
              />
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bộ Phận Nhận / Phòng Ban
              </label>
              <input
                type="search"
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setShowDepartmentList(true);
                }}
                onFocus={() => setShowDepartmentList(true)}
                onBlur={() => {
                  setTimeout(() => setShowDepartmentList(false), 150);
                }}
                placeholder="Nhập tên phòng ban để tìm kiếm..."
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
              {showDepartmentList && (
                <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                  {filteredDepartments.length > 0 ? (
                    filteredDepartments.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDepartment(item);
                          setShowDepartmentList(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800"
                      >
                        {item}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-slate-400">
                      Không tìm thấy phòng ban
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nhập vào kho
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                aria-label="Chọn kho nhập"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ghi Chú Phiếu
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Lý do nhập kho..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items Table with Searchable Product Select */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Chi Tiết Mặt Hàng Nhập Kho ({lineItems.length})
              </h4>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-500" />
                <span>Thêm dòng</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-visible">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Hàng Hóa Nhập Kho (Có Tìm Kiếm)</th>
                    <th className="p-3 w-28 text-center">Đơn Vị</th>
                    <th className="p-3 w-36 text-right">Số Lượng Nhập</th>
                    <th className="p-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineItems.map((line, idx) => {
                    const item = items.find((i) => i.id === line.itemId);

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="p-3">
                          <ProductSelect
                            items={items}
                            value={line.itemId}
                            onChange={(itemId) => handleItemChange(idx, itemId)}
                            ariaLabel={`Mặt hàng dòng ${idx + 1}`}
                          />
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {item?.unitName || '-'}
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 1)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-right font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lineItems.length === 1}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingVoucher && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingVoucher(null)}
          onConfirm={handleConfirmDelete}
          title="Xác nhận xóa phiếu nhập kho"
          message={`Bạn có chắc chắn muốn xóa phiếu nhập kho "${deletingVoucher.code}"? Số lượng tồn kho của các sản phẩm trong phiếu sẽ được trừ tương ứng.`}
          confirmLabel="Xóa Phiếu & Hoàn Tồn Kho"
          cancelLabel="Hủy bỏ"
          isDangerous={true}
        />
      )}

      {/* View Voucher Details Modal */}
      {viewingVoucher && (
        <Modal
          isOpen={true}
          onClose={() => setViewingVoucher(null)}
          title={`Chi Tiết Phiếu Nhập Kho: ${viewingVoucher.code}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {(() => {
                  const status = get24hStatus(viewingVoucher);
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.isEditable
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Hạn sửa/xóa: {status.text}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2">
                {get24hStatus(viewingVoucher).isEditable && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(viewingVoucher)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa phiếu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(viewingVoucher)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Chỉnh sửa
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setViewingVoucher(null)}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400">Số phiếu:</span>{' '}
                <strong className="text-emerald-500 font-mono">{viewingVoucher.code}</strong>
              </div>
              <div>
                <span className="text-slate-400">Ngày nhập:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{formatDate(viewingVoucher.date)}</strong>
              </div>
              <div>
                <span className="text-slate-400">Người nhập:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{viewingVoucher.person}</strong>
              </div>
              <div>
                <span className="text-slate-400">Kho nhập:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{viewingVoucher.warehouseName}</strong>
              </div>
              {viewingVoucher.department && (
                <div className="col-span-2">
                  <span className="text-slate-400">Bộ phận nhận:</span>{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">{viewingVoucher.department}</strong>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-slate-400">Ghi chú:</span>{' '}
                <span>{viewingVoucher.note || 'Không có ghi chú'}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-2.5">Mã Hàng</th>
                    <th className="p-2.5">Tên Sản Phẩm</th>
                    <th className="p-2.5 text-center">ĐVT</th>
                    <th className="p-2.5 text-right">Số Lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(() => {
                    const detailItems =
                      viewingVoucher.items.length > 0
                        ? viewingVoucher.items
                        : logs
                          .filter(
                            (l) =>
                              l.voucherId === viewingVoucher.id ||
                              (viewingVoucher.code && l.voucherCode === viewingVoucher.code)
                          )
                          .map((l) => {
                            const matchedItem = items.find((i) => i.id === l.itemId || i.code === l.itemCode);
                            return {
                              itemId: l.itemId,
                              itemCode: l.itemCode,
                              itemName: l.itemName,
                              unitName: matchedItem?.unitName || '-',
                              quantity: l.quantity,
                            };
                          });

                    if (detailItems.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400">
                            Chưa có dữ liệu chi tiết mặt hàng cho phiếu nhập này
                          </td>
                        </tr>
                      );
                    }

                    return detailItems.map((line, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-mono text-cyan-500">{line.itemCode}</td>
                        <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">{line.itemName}</td>
                        <td className="p-2.5 text-center text-slate-500">{line.unitName || '-'}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-500">
                          +{formatNumber(line.quantity)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}