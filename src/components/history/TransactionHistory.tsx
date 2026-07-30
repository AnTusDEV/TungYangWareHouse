import React, { useState, useMemo } from 'react';
import { History, Download, ArrowDownLeft, ArrowUpRight, Filter, Calendar, User, Warehouse } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { InventoryLog } from '../../types/inventory';
import { DataTable, Column } from '../common/DataTable';
import { formatDate, formatNumber } from '../../lib/formatters';
import { exportHistoryToExcel } from '../../lib/excel';

export function TransactionHistory() {
  const { logs, warehouses, items } = useInventoryStore();

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<string>('ALL');
  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');

  // Get distinct list of performers
  const performers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.person));
    return Array.from(set);
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (typeFilter !== 'ALL' && log.type !== typeFilter) return false;
      if (selectedWarehouse !== 'ALL' && log.warehouseId !== selectedWarehouse) return false;
      if (selectedItem !== 'ALL' && log.itemId !== selectedItem) return false;
      if (selectedPerson !== 'ALL' && log.person !== selectedPerson) return false;
      return true;
    });
  }, [logs, typeFilter, selectedWarehouse, selectedItem, selectedPerson]);

  const columns: Column<InventoryLog>[] = [
    {
      key: 'date',
      header: 'Ngày GD',
      sortable: true,
      render: (log) => <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(log.date)}</span>,
    },
    {
      key: 'voucherCode',
      header: 'Mã Phiếu',
      sortable: true,
      render: (log) => (
        <span
          className={`font-mono font-bold ${
            log.type === 'IN'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {log.voucherCode}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Loại GD',
      align: 'center',
      render: (log) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            log.type === 'IN'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
          }`}
        >
          {log.type === 'IN' ? (
            <>
              <ArrowDownLeft className="h-3 w-3" /> Nhập kho
            </>
          ) : (
            <>
              <ArrowUpRight className="h-3 w-3" /> Xuất kho
            </>
          )}
        </span>
      ),
    },
    {
      key: 'itemName',
      header: 'Mặt Hàng',
      sortable: true,
      render: (log) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{log.itemName}</div>
          <div className="text-[11px] text-slate-500 font-mono">[{log.itemCode}]</div>
        </div>
      ),
    },
    {
      key: 'warehouseName',
      header: 'Kho',
      sortable: true,
      render: (log) => <span>{log.warehouseName}</span>,
    },
    {
      key: 'quantity',
      header: 'Biến Động',
      align: 'right',
      sortable: true,
      render: (log) => (
        <span
          className={`font-bold ${
            log.type === 'IN'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {log.type === 'IN' ? '+' : '-'}{formatNumber(log.quantity)}
        </span>
      ),
    },
    {
      key: 'newStock',
      header: 'Tồn Sau GD',
      align: 'right',
      sortable: true,
      render: (log) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {formatNumber(log.newStock)}
        </span>
      ),
    },
    {
      key: 'person',
      header: 'Người Thực Hiện',
      sortable: true,
      render: (log) => (
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-200">{log.person}</div>
          {log.department && (
            <div className="text-[10px] text-slate-500">{log.department}</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="h-5 w-5 text-cyan-500" />
            Nhật Ký & Lịch Sử Nhập Xuất ({filteredLogs.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Theo dõi toàn bộ nhật ký biến động kho chi tiết theo sản phẩm, ngày tháng, phòng kho & nhân sự
          </p>
        </div>

        <button
          onClick={() => exportHistoryToExcel(filteredLogs)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          <span>Export Lịch Sử Excel</span>
        </button>
      </div>

      {/* Table & Toolbar */}
      <DataTable
        data={filteredLogs}
        columns={columns}
        rowKey={(log) => log.id}
        searchKey={(log) =>
          `${log.voucherCode} ${log.itemCode} ${log.itemName} ${log.person} ${log.department || ''} ${log.note || ''}`
        }
        searchPlaceholder="Tìm mã phiếu, mã/tên hàng, người nhập/xuất..."
        filters={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              aria-label="Lọc theo loại giao dịch"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="ALL">Tất cả Loại GD</option>
              <option value="IN">🟢 Nhập kho</option>
              <option value="OUT">🔴 Xuất kho</option>
            </select>

            {/* Warehouse Filter */}
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              aria-label="Lọc theo kho"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Tất cả Phòng Kho</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Item Filter */}
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              aria-label="Lọc theo sản phẩm"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 max-w-xs truncate"
            >
              <option value="ALL">Tất cả Mặt hàng</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  [{i.code}] {i.name}
                </option>
              ))}
            </select>

            {/* Performer Filter */}
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              aria-label="Lọc theo người thực hiện"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Tất cả Người thực hiện</option>
              {performers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </div>
  );
}
