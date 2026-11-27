import React, { useState } from 'react';
import {
  ArrowUpRight,
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
  AlertTriangle,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { StockVoucher } from '../../types/inventory';
import { Modal } from '../common/Modal';
import { DataTable, Column } from '../common/DataTable';
import { ProductSelect } from '../common/ProductSelect';
import {
  formatNumber,
  formatDate,
  generateVoucherCode,
} from '../../lib/formatters';

export function StockOutManager() {
  const { currentUser } = useAuthStore();
  const currentUserName = currentUser?.fullName || currentUser?.username || 'Admin';

  const { items, warehouses, vouchers, logs, createStockOutVoucher } = useInventoryStore();

  const outboundVouchers = vouchers.filter((v) => v.type === 'OUT');

  const [isCreating, setIsCreating] = useState(false);
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
    'Nhân sự',
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
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id || 'wh-1');
  const [note, setNote] = useState<string>('Cấp phát văn phòng phẩm định kỳ');

  // Line Items State
  const [lineItems, setLineItems] = useState<{ itemId: string; quantity: number }[]>([
    { itemId: items[0]?.id || '', quantity: 1 },
  ]);

  const handleOpenCreate = () => {
    setIsCreating(true);
    setAlertInfo(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPerson(currentUserName);
    setWarehouseId(warehouses[0]?.id || 'wh-1');
    setNote('Cấp phát văn phòng phẩm');

    // Filter items with stock > 0
    const availableItem = items.find((i) => i.stockQuantity > 0) || items[0];
    if (availableItem) {
      setLineItems([{ itemId: availableItem.id, quantity: 1 }]);
    }
  };

  const handleAddLine = () => {
    const availableItem =
      items.find((i) => i.stockQuantity > 0 && !lineItems.some((l) => l.itemId === i.id)) ||
      items[0];
    if (availableItem) {
      setLineItems([...lineItems, { itemId: availableItem.id, quantity: 1 }]);
    }
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, itemId: string) => {
    const updated = [...lineItems];
    updated[index].itemId = itemId;
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

    // Frontend validation before calling store
    for (const line of lineItems) {
      const item = items.find((i) => i.id === line.itemId);
      if (!item) continue;
      if (line.quantity > item.stockQuantity) {
        setAlertInfo({
          type: 'error',
          message: `Không thể xuất vượt quá tồn kho! Mặt hàng "${item.name}" hiện chỉ còn ${item.stockQuantity} ${item.unitName}, yêu cầu xuất ${line.quantity} ${item.unitName}.`,
        });
        return;
      }
    }

    const res = createStockOutVoucher({
      date,
      person,
      department: department.trim() || undefined,
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
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
          {v.code}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Ngày Xuất',
      sortable: true,
      render: (v) => <span>{formatDate(v.date)}</span>,
    },
    {
      key: 'person',
      header: 'Người Nhận',
      sortable: true,
      render: (v) => <span className="font-semibold text-slate-900 dark:text-slate-100">{v.person}</span>,
    },
    {
      key: 'warehouseName',
      header: 'Kho Xuất',
      sortable: true,
      render: (v) => <span>{v.warehouseName}</span>,
    },
    {
      key: 'totalQuantity',
      header: 'Tổng Xuất',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="font-bold text-rose-600 dark:text-rose-400">
          {formatNumber(v.totalQuantity)}
        </span>
      ),
    },
    {
      key: 'itemsCount',
      header: 'Số Mặt Hàng',
      align: 'center',
      render: (v) => {
        const count =
          v.items.length > 0
            ? v.items.length
            : logs.filter((l) => l.voucherId === v.id || (v.code && l.voucherCode === v.code)).length;
        return <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium">{count}</span>;
      },
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
          title="Xem chi tiết phiếu xuất"
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
            <ArrowUpRight className="h-5 w-5 text-rose-500" />
            Lập Phiếu Xuất Kho ({outboundVouchers.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tạo phiếu xuất cấp phát vật tư, kiểm soát tồn kho tức thời & chặn xuất vượt mức
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo Phiếu Xuất Mới</span>
        </button>
      </div>

      {/* List of Outbound Vouchers */}
      <DataTable
        data={outboundVouchers}
        columns={columns}
        rowKey={(v) => v.id}
        searchKey={(v) => `${v.code} ${v.person} ${v.warehouseName} ${v.note}`}
        searchPlaceholder="Tìm kiếm số phiếu, người nhận..."
        onRowClick={(v) => setViewingVoucher(v)}
      />

      {/* Create Outbound Voucher Modal */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Tạo Phiếu Xuất Kho / Cấp Phát Vật Tư"
        maxWidth="4xl"
        minHeight="min-h-[550px] sm:min-h-[650px]"
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
              form="stock-out-form"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors"
            >
              <Check className="h-4 w-4" />
              Lưu Phiếu & Trừ Tồn Kho
            </button>
          </>
        }
      >
        <form id="stock-out-form" onSubmit={handleSubmit} className="space-y-6">
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

          {/* Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngày Xuất
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Người Lập Phiếu
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-rose-500 focus:outline-none"
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
                        className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-slate-800"
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
                Xuất Từ Kho
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                aria-label="Chọn kho xuất"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-rose-500 focus:outline-none"
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
                Ghi Chú Xuất
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Lý do xuất..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Chi Tiết Mặt Hàng Xuất Kho ({lineItems.length})
              </h4>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-rose-500" />
                <span>Thêm dòng</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-visible">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Hàng Hóa Xuất Kho (Có Tìm Kiếm)</th>
                    <th className="p-3 w-28 text-center">ĐVT</th>
                    <th className="p-3 w-36 text-right">Tồn Hiện Tại</th>
                    <th className="p-3 w-36 text-right">Số Lượng Xuất</th>
                    <th className="p-3 w-36 text-center">Kiểm Tra Tồn</th>
                    <th className="p-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineItems.map((line, idx) => {
                    const item = items.find((i) => i.id === line.itemId);
                    const isExceeded = item ? line.quantity > item.stockQuantity : false;

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isExceeded ? 'bg-rose-500/5' : ''
                          }`}
                      >
                        <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="p-3">
                          <ProductSelect
                            items={items}
                            value={line.itemId}
                            onChange={(itemId) => handleItemChange(idx, itemId)}
                            ariaLabel={`Mặt hàng xuất dòng ${idx + 1}`}
                          />
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {item?.unitName || '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">
                          {formatNumber(item?.stockQuantity || 0)} {item?.unitName}
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 1)}
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs text-right font-bold focus:outline-none ${isExceeded
                              ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-rose-500'
                              }`}
                          />
                        </td>
                        <td className="p-3 text-center">
                          {isExceeded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                              <AlertTriangle className="h-3 w-3" /> Vượt tồn kho!
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                              <CheckCircle className="h-3 w-3" /> Đủ hàng
                            </span>
                          )}
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
          title={`Chi Tiết Phiếu Xuất Kho: ${viewingVoucher.code}`}
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
                <strong className="text-rose-500 font-mono">{viewingVoucher.code}</strong>
              </div>
              <div>
                <span className="text-slate-400">Ngày xuất:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{formatDate(viewingVoucher.date)}</strong>
              </div>
              <div>
                <span className="text-slate-400">Người lập phiếu:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{viewingVoucher.person}</strong>
              </div>
              <div>
                <span className="text-slate-400">Xuất từ kho:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{viewingVoucher.warehouseName}</strong>
              </div>
              {viewingVoucher.department && (
                <div className="col-span-2">
                  <span className="text-slate-400">Bộ phận nhận:</span>{' '}
                  <strong className="text-rose-600 dark:text-rose-400">{viewingVoucher.department}</strong>
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
                    <th className="p-2.5 text-right">Số Lượng Xuất</th>
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
                            Chưa có dữ liệu chi tiết mặt hàng cho phiếu xuất này
                          </td>
                        </tr>
                      );
                    }

                    return detailItems.map((line, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-mono text-cyan-500">{line.itemCode}</td>
                        <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">{line.itemName}</td>
                        <td className="p-2.5 text-center text-slate-500">{line.unitName || '-'}</td>
                        <td className="p-2.5 text-right font-bold text-rose-500">
                          -{formatNumber(line.quantity)}
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
