import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Search,
  Filter,
  AlertTriangle,
  History,
  Boxes,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Item } from '../../types/inventory';
import { DataTable, Column } from '../common/DataTable';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ExcelImportModal } from '../common/ExcelImportModal';
import {
  formatNumber,
  formatDate,
  getStockStatus,
  generateItemCode,
} from '../../lib/formatters';
import { exportItemsToExcel } from '../../lib/excel';

export function ItemManager() {
  const {
    items,
    categories,
    units,
    warehouses,
    addItem,
    updateItem,
    deleteItem,
  } = useInventoryStore();

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedStockFilter, setSelectedStockFilter] = useState<string>('ALL');

  // Modals & Async Status
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    categoryId: '',
    unitId: '',
    warehouseId: '',
    stockQuantity: 0,
    maxStockLevel: 100,
    note: '',
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setModalError(null);
    const existingCodes = items.map((i) => i.code);
    setFormData({
      code: generateItemCode(existingCodes),
      name: '',
      categoryId: categories[0]?.id || '',
      unitId: units[0]?.id || '',
      warehouseId: warehouses[0]?.id || '',
      stockQuantity: 0,
      maxStockLevel: 100,
      note: '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setModalError(null);
    setFormData({
      code: item.code,
      name: item.name,
      categoryId: item.categoryId,
      unitId: item.unitId,
      warehouseId: item.warehouseId,
      stockQuantity: item.stockQuantity,
      maxStockLevel: item.maxStockLevel || 100,
      note: item.note || '',
    });
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || isSaving) return;

    setModalError(null);
    setIsSaving(true);
    try {
      const res = editingItem
        ? await updateItem(editingItem.id, formData)
        : await addItem(formData);

      if (res.success) {
        setAlertInfo({ type: 'success', message: res.message });
        setIsFormModalOpen(false);
      } else {
        setModalError(res.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId || isSaving) return;
    setIsSaving(true);
    try {
      const res = await deleteItem(deletingId);
      setAlertInfo({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      setDeletingId(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'ALL') {
        const catObj = categories.find((c) => c.id === selectedCategory);
        const matchId = item.categoryId === selectedCategory;
        const matchName = catObj && item.categoryName && item.categoryName.trim().toLowerCase() === catObj.name.trim().toLowerCase();
        if (!matchId && !matchName) return false;
      }
      if (selectedWarehouse !== 'ALL') {
        const whObj = warehouses.find((w) => w.id === selectedWarehouse);
        const matchId = item.warehouseId === selectedWarehouse;
        const matchName = whObj && item.warehouseName && item.warehouseName.trim().toLowerCase() === whObj.name.trim().toLowerCase();
        if (!matchId && !matchName) return false;
      }

      if (selectedStockFilter === 'OUT') {
        return item.stockQuantity <= 0;
      }
      if (selectedStockFilter === 'HIGH') {
        return item.maxStockLevel && item.stockQuantity >= item.maxStockLevel;
      }

      return true;
    });
  }, [items, selectedCategory, selectedWarehouse, selectedStockFilter]);

  // DataTable Columns
  const columns: Column<Item>[] = [
    {
      key: 'code',
      header: 'Mã Hàng',
      sortable: true,
      render: (item) => (
        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên Mặt Hàng',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
          {item.note && (
            <div className="text-[11px] text-slate-500 truncate max-w-xs">{item.note}</div>
          )}
        </div>
      ),
    },
    {
      key: 'categoryName',
      header: 'Nhóm Hàng',
      sortable: true,
      render: (item) => (
        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
          {item.categoryName}
        </span>
      ),
    },
    {
      key: 'unitName',
      header: 'ĐVT',
      align: 'center',
      render: (item) => (
        <span className="font-medium text-slate-600 dark:text-slate-400">{item.unitName}</span>
      ),
    },
    {
      key: 'warehouseName',
      header: 'Kho',
      sortable: true,
      render: (item) => <span className="text-slate-600 dark:text-slate-400">{item.warehouseName}</span>,
    },
    {
      key: 'stockQuantity',
      header: 'Tồn Hiện Tại',
      align: 'right',
      sortable: true,
      render: (item) => {
        const st = getStockStatus(item.stockQuantity, 0, item.maxStockLevel);
        return (
          <span className={`font-bold ${st.textClass}`}>
            {formatNumber(item.stockQuantity)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      align: 'center',
      render: (item) => {
        const st = getStockStatus(item.stockQuantity, 0, item.maxStockLevel);
        return (
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${st.badgeClass}`}
          >
            {st.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(item);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sửa hàng hóa"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingId(item.id);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Xóa hàng hóa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
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
            <Package className="h-5 w-5 text-cyan-500" />
            Quản Lý Danh Mục Hàng Hóa ({filteredItems.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Khai báo danh mục, quản lý thông tin vật tư, mã hàng & định mức tồn kho
          </p>
        </div>

        {/* Excel Import / Export & Add Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
            title="Import hàng hóa từ file Excel"
          >
            <Upload className="h-3.5 w-3.5 text-cyan-500" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => exportItemsToExcel(filteredItems)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
            title="Xuất danh sách ra file Excel"
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm Hàng Hóa</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <DataTable
        data={filteredItems}
        columns={columns}
        rowKey={(item) => item.id}
        searchKey={(item) => `${item.code} ${item.name} ${item.categoryName} ${item.warehouseName}`}
        searchPlaceholder="Tìm mã hàng, tên sản phẩm..."
        filters={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Lọc theo nhóm hàng"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Tất cả Nhóm hàng</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
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

            {/* Stock Level Status Filter */}
            <select
              value={selectedStockFilter}
              onChange={(e) => setSelectedStockFilter(e.target.value)}
              aria-label="Lọc theo trạng thái tồn kho"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Tất cả Trạng Thái Tồn</option>
              <option value="OUT">Hết Hàng (= 0)</option>
              <option value="HIGH">Tồn Nhiều (&gt; Tối đa)</option>
            </select>
          </div>
        }
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingItem ? 'Sửa Thông Tin Hàng Hóa' : 'Thêm Hàng Hóa Mới'}
        maxWidth="xl"
        footer={
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="item-form"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Đang lưu SQL Server...' : editingItem ? 'Lưu Thay Đổi' : 'Thêm Mặt Hàng'}
            </button>
          </>
        }
      >
        <form id="item-form" onSubmit={handleSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mã Hàng (Tự sinh hoặc tự đặt) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="VD: HH0001"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên Hàng Hóa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Giấy in A4 Double A"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nhóm Hàng <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                aria-label="Chọn nhóm hàng"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Đơn Vị Tính <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.unitId}
                onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                aria-label="Chọn đơn vị tính"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lưu Trữ Tại Kho <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.warehouseId}
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                aria-label="Chọn kho"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
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
                Số Lượng Tồn Ban Đầu
              </label>
              <input
                type="number"
                min="0"
                value={formData.stockQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mức Tồn Tối Đa (Cảnh báo tồn nhiều)
              </label>
              <input
                type="number"
                min="0"
                value={formData.maxStockLevel}
                onChange={(e) =>
                  setFormData({ ...formData, maxStockLevel: parseInt(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ghi Chú
              </label>
              <textarea
                rows={2}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="Mô tả quy cách, ứng dụng..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        message="Bạn có chắc chắn muốn xóa mặt hàng này khỏi danh mục không?"
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}
