import React, { useState } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  FileText,
  Calendar,
  User,
  Warehouse,
  CheckCircle,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { StockVoucher } from '../../types/inventory';
import { Modal } from '../common/Modal';
import { DataTable, Column } from '../common/DataTable';
import {
  formatNumber,
  formatDate,
  generateVoucherCode,
} from '../../lib/formatters';

export function StockInManager() {
  const { items, warehouses, vouchers, createStockInVoucher } = useInventoryStore();

  const inboundVouchers = vouchers.filter((v) => v.type === 'IN');

  const [isCreating, setIsCreating] = useState(false);
  const [viewingVoucher, setViewingVoucher] = useState<StockVoucher | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [person, setPerson] = useState<string>('Nguyễn Văn Tuấn');
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id || 'wh-1');
  const [note, setNote] = useState<string>('');

  // Line Items State
  const [lineItems, setLineItems] = useState<
    { itemId: string; quantity: number }[]
  >([{ itemId: items[0]?.id || '', quantity: 1 }]);

  const handleOpenCreate = () => {
    setIsCreating(true);
    setAlertInfo(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPerson('Nguyễn Văn Tuấn');
    setWarehouseId(warehouses[0]?.id || 'wh-1');
    setNote('');
    if (items.length > 0) {
      setLineItems([{ itemId: items[0].id, quantity: 10 }]);
    }
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

    const res = createStockInVoucher({
      date,
      person,
      warehouseId,
      note,
      items: lineItems,
    });

    if (res.success) {
      setAlertInfo({ type: 'success', message: res.message });
      setTimeout(() => {
        setIsCreating(false);
        setAlertInfo(null);
      }, 1200);
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
      header: 'Người Nhập',
      sortable: true,
      render: (v) => <span className="font-semibold text-slate-900 dark:text-slate-100">{v.person}</span>,
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
      key: 'itemsCount',
      header: 'Số Mặt Hàng',
      align: 'center',
      render: (v) => <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium">{v.items.length}</span>,
    },
    {
      key: 'note',
      header: 'Ghi Chú',
      render: (v) => <span className="text-slate-500 truncate max-w-xs">{v.note || '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Chi Tiết',
      align: 'center',
      render: (v) => (
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
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
            Lập Phiếu Nhập Kho ({inboundVouchers.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tạo phiếu nhập hàng hóa, bổ sung tồn kho & lưu lịch sử biên bản giao nhận
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
        searchKey={(v) => `${v.code} ${v.person} ${v.warehouseName} ${v.note}`}
        searchPlaceholder="Tìm kiếm số phiếu, người nhập..."
        onRowClick={(v) => setViewingVoucher(v)}
      />

      {/* Create Inbound Voucher Modal */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Tạo Phiếu Nhập Kho Mới"
        maxWidth="4xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
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
              Lưu Phiếu & Cộng Tồn Kho
            </button>
          </>
        }
      >
        <form id="stock-in-form" onSubmit={handleSubmit} className="space-y-6">
          {alertInfo && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                alertInfo.type === 'success'
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

          {/* Form Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
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
                required
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kho Nhập Hàng
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

          {/* Line Items Table */}
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

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Hàng Hóa Nhập Kho</th>
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
                          <select
                            value={line.itemId}
                            onChange={(e) => handleItemChange(idx, e.target.value)}
                            aria-label={`Mặt hàng dòng ${idx + 1}`}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                          >
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>
                                [{i.code}] {i.name} (Tồn hiện tại: {i.stockQuantity} {i.unitName})
                              </option>
                            ))}
                          </select>
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

      {/* View Voucher Details Modal */}
      {viewingVoucher && (
        <Modal
          isOpen={true}
          onClose={() => setViewingVoucher(null)}
          title={`Chi Tiết Phiếu Nhập Kho: ${viewingVoucher.code}`}
          maxWidth="lg"
          footer={
            <button
              onClick={() => setViewingVoucher(null)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Đóng
            </button>
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
                  {viewingVoucher.items.map((line, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-mono text-cyan-500">{line.itemCode}</td>
                      <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">{line.itemName}</td>
                      <td className="p-2.5 text-center text-slate-500">{line.unitName}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-500">
                        +{formatNumber(line.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
