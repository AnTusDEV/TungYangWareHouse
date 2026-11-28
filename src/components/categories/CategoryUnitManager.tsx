import React, { useState } from 'react';
import { Boxes, Plus, Edit2, Trash2, Layers, Tag, Eye, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { Category, Unit } from '../../types/inventory';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { CategoryItemsModal } from '../common/CategoryItemsModal';

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
    syncMissingCategoriesFromItems,
  } = useInventoryStore();

  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'units'>('categories');
  const [isSaving, setIsSaving] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [catModalError, setCatModalError] = useState<string | null>(null);
  const [unitModalError, setUnitModalError] = useState<string | null>(null);

  // Category Items Modal State
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<Category | null>(null);

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
    setCatModalError(null);
    setCatFormData({ code: `NH0${categories.length + 1}`, name: '', description: '' });
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (cat: Category) => {
    setEditingCategory(cat);
    setCatModalError(null);
    setCatFormData({ code: cat.code, name: cat.name, description: cat.description || '' });
    setIsCatModalOpen(true);
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormData.name.trim() || isSaving) return;

    setCatModalError(null);
    setIsSaving(true);
    try {
      const res = editingCategory
        ? await updateCategory(editingCategory.id, catFormData)
        : await addCategory(catFormData);

      if (res.success) {
        setAlertInfo({ type: 'success', message: res.message });
        setIsCatModalOpen(false);
      } else {
        setCatModalError(res.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteCat = async () => {
    if (!deletingCatId || isSaving) return;
    setIsSaving(true);
    try {
      const res = await deleteCategory(deletingCatId);
      setAlertInfo({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      setDeletingCatId(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Unit Submit
  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setUnitModalError(null);
    setUnitFormData({ name: '', description: '' });
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (u: Unit) => {
    setEditingUnit(u);
    setUnitModalError(null);
    setUnitFormData({ name: u.name, description: u.description || '' });
    setIsUnitModalOpen(true);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitFormData.name.trim() || isSaving) return;

    setUnitModalError(null);
    setIsSaving(true);
    try {
      const res = editingUnit
        ? await updateUnit(editingUnit.id, unitFormData)
        : await addUnit(unitFormData);

      if (res.success) {
        setAlertInfo({ type: 'success', message: res.message });
        setIsUnitModalOpen(false);
      } else {
        setUnitModalError(res.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteUnit = async () => {
    if (!deletingUnitId || isSaving) return;
    setIsSaving(true);
    try {
      const res = await deleteUnit(deletingUnitId);
      setAlertInfo({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
      setDeletingUnitId(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncFromItems = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await syncMissingCategoriesFromItems();
      setAlertInfo({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

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
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncFromItems}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm transition-all disabled:opacity-50"
                title="Quét lại sản phẩm và tự động khôi phục các nhóm hàng còn thiếu"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>Đồng Bộ Từ Sản Phẩm</span>
              </button>
              <button
                onClick={handleOpenAddCat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm Nhóm Hàng</span>
              </button>
            </div>
          </div>

          {categories.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <Boxes className="h-12 w-12 text-slate-400 mx-auto mb-3 opacity-60" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                Chưa có nhóm hàng hóa nào
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                Các sản phẩm đã có nhóm hàng nhưng danh mục hệ thống chưa được đồng bộ. Bấm nút dưới đây để khôi phục ngay lập tức!
              </p>
              <button
                onClick={handleSyncFromItems}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                <span>Khôi Phục Nhóm Hàng Từ Sản Phẩm</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => {
                const catItemsCount = items.filter(
                  (i) => i.categoryId === cat.id || (cat.name && i.categoryName?.trim().toLowerCase() === cat.name.trim().toLowerCase())
                ).length;
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
                            onClick={() => setSelectedCategoryModal(cat)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Xem danh sách sản phẩm thuộc nhóm này"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditCat(cat)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Sửa nhóm hàng"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingCatId(cat.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Xóa nhóm hàng"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4
                        onClick={() => setSelectedCategoryModal(cat)}
                        className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1 cursor-pointer hover:text-cyan-500 transition-colors flex items-center gap-1.5"
                      >
                        <span>{cat.name}</span>
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{cat.description || 'Chưa có mô tả'}</p>
                    </div>

                    <div
                      onClick={() => setSelectedCategoryModal(cat)}
                      className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400 cursor-pointer hover:text-cyan-500 transition-colors group/btn"
                    >
                      <span>Số mặt hàng:</span>
                      <div className="flex items-center gap-1">
                        <strong className="text-slate-800 dark:text-slate-200 group-hover/btn:text-cyan-500 transition-colors">
                          {catItemsCount} sản phẩm
                        </strong>
                        <Eye className="h-3 w-3 text-cyan-500 opacity-80" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UNITS */}
      {activeSubTab === 'units' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh Sách Đơn Vị Tính Linh Hoạt
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncFromItems}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm transition-all disabled:opacity-50"
                title="Quét lại sản phẩm và tự động khôi phục các đơn vị tính còn thiếu"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>Đồng Bộ Từ Sản Phẩm</span>
              </button>
              <button
                onClick={handleOpenAddUnit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm Đơn Vị Mới</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {units.map((u) => {
              const unitItemsCount = items.filter(
                (i) => i.unitId === u.id || (u.name && i.unitName?.trim().toLowerCase() === u.name.trim().toLowerCase())
              ).length;
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
              disabled={isSaving}
              onClick={() => setIsCatModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="cat-form"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <form id="cat-form" onSubmit={handleCatSubmit} className="space-y-4">
          {catModalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{catModalError}</span>
            </div>
          )}
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
              disabled={isSaving}
              onClick={() => setIsUnitModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="unit-form"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <form id="unit-form" onSubmit={handleUnitSubmit} className="space-y-4">
          {unitModalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{unitModalError}</span>
            </div>
          )}
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

      {/* Category Items Detail Popup Modal */}
      <CategoryItemsModal
        isOpen={selectedCategoryModal !== null}
        onClose={() => setSelectedCategoryModal(null)}
        category={selectedCategoryModal}
      />
    </div>
  );
}
