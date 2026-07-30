import React, { useState } from 'react';
import { Boxes, Plus, Edit2, Trash2, Layers, Tag, AlertCircle } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Category, Unit } from '../../types/inventory';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function CategoryUnitManager() {
  const {
    categories,
    units,
    items,
    addCategory,
    updateCategory,
    deleteCategory,
    addUnit,
    updateUnit,
    deleteUnit,
  } = useInventoryStore();

  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'units'>('categories');

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [catFormData, setCatFormData] = useState({ code: '', name: '', description: '' });

  // Unit Modal State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);
  const [unitFormData, setUnitFormData] = useState({ name: '', description: '' });

  // Handle Category Submit
  const handleOpenAddCat = () => {
    setEditingCategory(null);
    setCatFormData({ code: `NH0${categories.length + 1}`, name: '', description: '' });
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (cat: Category) => {
    setEditingCategory(cat);
    setCatFormData({ code: cat.code, name: cat.name, description: cat.description || '' });
    setIsCatModalOpen(true);
  };

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormData.name.trim()) return;

    if (editingCategory) {
      updateCategory(editingCategory.id, catFormData);
    } else {
      addCategory(catFormData);
    }
    setIsCatModalOpen(false);
  };

  const handleConfirmDeleteCat = () => {
    if (!deletingCatId) return;
    const success = deleteCategory(deletingCatId);
    if (!success) {
      alert('Không thể xóa nhóm hàng vì đang có hàng hóa thuộc nhóm này!');
    }
    setDeletingCatId(null);
  };

  // Handle Unit Submit
  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setUnitFormData({ name: '', description: '' });
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (u: Unit) => {
    setEditingUnit(u);
    setUnitFormData({ name: u.name, description: u.description || '' });
    setIsUnitModalOpen(true);
  };

  const handleUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitFormData.name.trim()) return;

    if (editingUnit) {
      updateUnit(editingUnit.id, unitFormData);
    } else {
      addUnit(unitFormData);
    }
    setIsUnitModalOpen(false);
  };

  const handleConfirmDeleteUnit = () => {
    if (!deletingUnitId) return;
    const success = deleteUnit(deletingUnitId);
    if (!success) {
      alert('Không thể xóa đơn vị tính vì đang được sử dụng bởi các mặt hàng!');
    }
    setDeletingUnitId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-cyan-500" />
            Quản Lý Danh Mục Hệ Thống
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Khai báo danh mục nhóm hàng hóa & các loại đơn vị tính linh hoạt
          </p>
        </div>

        {/* Sub-tabs toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'categories'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Nhóm Hàng ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('units')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'units'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Đơn Vị Tính ({units.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CATEGORIES */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh Sách Nhóm Hàng Hóa
            </h3>
            <button
              onClick={handleOpenAddCat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm Nhóm Hàng</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const catItemsCount = items.filter((i) => i.categoryId === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="flex flex-col justify-between p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-cyan-500/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400">
                        {cat.code}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCat(cat)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-500"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingCatId(cat.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">
                      {cat.name}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{cat.description || 'Chưa có mô tả'}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Số mặt hàng:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{catItemsCount} sản phẩm</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: UNITS */}
      {activeSubTab === 'units' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh Sách Đơn Vị Tính Linh Hoạt
            </h3>
            <button
              onClick={handleOpenAddUnit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm Đơn Vị Mới</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {units.map((u) => {
              const unitItemsCount = items.filter((i) => i.unitId === u.id).length;
              return (
                <div
                  key={u.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between hover:border-cyan-500/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{u.name}</span>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => handleOpenEditUnit(u)} className="p-1 text-slate-400 hover:text-cyan-500">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={() => setDeletingUnitId(u.id)} className="p-1 text-slate-400 hover:text-rose-500">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{u.description || 'Đơn vị tính quy chuẩn'}</p>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400">
                    Sử dụng: <strong className="text-slate-700 dark:text-slate-300">{unitItemsCount} mặt hàng</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Add/Edit Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCategory ? 'Sửa Nhóm Hàng' : 'Thêm Nhóm Hàng Mới'}
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCatModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="cat-form"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              Lưu
            </button>
          </>
        }
      >
        <form id="cat-form" onSubmit={handleCatSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Mã Nhóm Hàng</label>
            <input
              type="text"
              required
              value={catFormData.code}
              onChange={(e) => setCatFormData({ ...catFormData, code: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Tên Nhóm Hàng</label>
            <input
              type="text"
              required
              value={catFormData.name}
              onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
              placeholder="VD: Sổ sách & Giấy in"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Mô Tả</label>
            <textarea
              rows={2}
              value={catFormData.description}
              onChange={(e) => setCatFormData({ ...catFormData, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
        </form>
      </Modal>

      {/* Unit Add/Edit Modal */}
      <Modal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        title={editingUnit ? 'Sửa Đơn Vị Tính' : 'Thêm Đơn Vị Tính Mới'}
        maxWidth="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsUnitModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="unit-form"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              Lưu
            </button>
          </>
        }
      >
        <form id="unit-form" onSubmit={handleUnitSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Tên Đơn Vị Tính</label>
            <input
              type="text"
              required
              value={unitFormData.name}
              onChange={(e) => setUnitFormData({ ...unitFormData, name: e.target.value })}
              placeholder="VD: Quyển, Hộp, Thùng, Ram..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Mô Tả Quy Cách</label>
            <input
              type="text"
              value={unitFormData.description}
              onChange={(e) => setUnitFormData({ ...unitFormData, description: e.target.value })}
              placeholder="Ghi chú quy cách đếm..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirms */}
      <ConfirmDialog
        isOpen={deletingCatId !== null}
        onClose={() => setDeletingCatId(null)}
        onConfirm={handleConfirmDeleteCat}
        message="Xác nhận xóa nhóm hàng này?"
      />

      <ConfirmDialog
        isOpen={deletingUnitId !== null}
        onClose={() => setDeletingUnitId(null)}
        onConfirm={handleConfirmDeleteUnit}
        message="Xác nhận xóa đơn vị tính này?"
      />
    </div>
  );
}
