import React, { useState } from 'react';
import { Warehouse as WarehouseIcon, Plus, Edit2, Trash2, MapPin, User, Package, AlertCircle } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Warehouse } from '../../types/inventory';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatNumber } from '../../lib/formatters';

export function WarehouseManager() {
  const { warehouses, items, addWarehouse, updateWarehouse, deleteWarehouse } = useInventoryStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    location: '',
    manager: '',
    description: '',
  });

  const handleOpenAdd = () => {
    setEditingWarehouse(null);
    setFormData({
      code: `KHO${warehouses.length + 1}`,
      name: '',
      location: '',
      manager: '',
      description: '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({
      code: wh.code,
      name: wh.name,
      location: wh.location,
      manager: wh.manager,
      description: wh.description || '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Vui lòng nhập tên phòng kho');
      return;
    }

    if (editingWarehouse) {
      updateWarehouse(editingWarehouse.id, formData);
    } else {
      addWarehouse(formData);
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deletingId) return;
    const success = deleteWarehouse(deletingId);
    if (!success) {
      alert('Không thể xóa kho vì đang có hàng hóa lưu trữ bên trong! Vui lòng chuyển hàng hóa sang kho khác trước khi xóa.');
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <WarehouseIcon className="h-5 w-5 text-cyan-500" />
            Danh Sách Phòng Kho ({warehouses.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quản lý các điểm lưu trữ, quản kho phụ trách & phân bổ hàng hóa
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm Kho Mới</span>
        </button>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map((wh) => {
          const whItems = items.filter((i) => i.warehouseId === wh.id);
          const totalQty = whItems.reduce((sum, i) => sum + i.stockQuantity, 0);

          return (
            <div
              key={wh.id}
              className="group relative flex flex-col justify-between p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl hover:border-cyan-500/40 transition-all duration-300"
            >
              <div>
                {/* Badge Code & Action */}
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700">
                    {wh.code}
                  </span>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(wh)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Sửa thông tin kho"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingId(wh.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Xóa kho"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Warehouse Name */}
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {wh.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {wh.description || 'Chưa có mô tả'}
                </p>

                {/* Details list */}
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{wh.location || 'Chưa cập nhật vị trí'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Quản kho: <strong className="text-slate-800 dark:text-slate-200">{wh.manager || 'Chưa phân công'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Số mặt hàng:</span>
                  <span className="ml-1 font-bold text-slate-900 dark:text-slate-100">
                    {whItems.length}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Tổng tồn kho:</span>
                  <span className="ml-1 font-bold text-cyan-600 dark:text-cyan-400">
                    {formatNumber(totalQty)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add / Edit Warehouse */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWarehouse ? 'Cập Nhật Thông Tin Kho' : 'Thêm Phòng Kho Mới'}
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="warehouse-form"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-colors"
            >
              {editingWarehouse ? 'Lưu Thay Đổi' : 'Thêm Kho'}
            </button>
          </>
        }
      >
        <form id="warehouse-form" onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mã Kho <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="VD: KHO1"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên Kho <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Kho 1 - Tầng 2"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Người Quản Kho Phụ Trách
            </label>
            <input
              type="text"
              value={formData.manager}
              onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
              placeholder="VD: Nguyễn Văn Tuấn"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Địa Chỉ / Vị Trí Cụ Thể
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="VD: Tầng 2 - Phòng 204"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ghi Chú / Mô Tả
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Mô tả chức năng kho..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        message="Bạn có chắc chắn muốn xóa phòng kho này không?"
      />
    </div>
  );
}
