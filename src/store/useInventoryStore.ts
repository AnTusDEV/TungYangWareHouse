import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Warehouse,
  Category,
  Unit,
  Item,
  StockVoucher,
  InventoryLog,
  TabType,
} from '../types/inventory';
import { useAuthStore } from './useAuthStore';
import { saveStoredLocalUsers } from '../lib/authApi';
import {
  generateItemCode,
  generateVoucherCode,
} from '../lib/formatters';
import {
  SQLServerConfig,
  getStoredSQLServerConfig,
  saveStoredSQLServerConfig,
  testSQLServerConnection,
  initSQLServerTables,
  fetchAllFromSQLServer,
  saveItemToSQLServer,
  deleteItemFromSQLServer,
  saveWarehouseToSQLServer,
  deleteWarehouseFromSQLServer,
  saveCategoryToSQLServer,
  deleteCategoryFromSQLServer,
  saveUnitToSQLServer,
  deleteUnitFromSQLServer,
  saveVoucherToSQLServer,
  deleteVoucherFromSQLServer,
  repairVoucherItemsInSQLServer,
  importItemsBatchToSQLServer,
} from '../lib/sqlServerSync';

interface InventoryState {
  // Navigation & Theme
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // SQL Server State
  sqlServerConfig: SQLServerConfig;
  setSqlServerConfig: (config: SQLServerConfig) => void;
  isLoadingFromSQLServer: boolean;
  isSQLServerConnected: boolean;
  sqlServerError: string | null;
  fetchFromSQLServer: () => Promise<void>;
  testSQLServerConfig: (config?: SQLServerConfig) => Promise<{ success: boolean; message: string }>;
  initSQLServerDb: (config?: SQLServerConfig) => Promise<{ success: boolean; message: string }>;

  // Password Lock State for Settings
  adminPassword: string;
  isSettingsUnlocked: boolean;
  verifySettingsPassword: (password: string) => boolean;
  changeAdminPassword: (oldPass: string, newPass: string) => { success: boolean; message: string };
  lockSettings: () => void;

  // Master Data
  warehouses: Warehouse[];
  categories: Category[];
  units: Unit[];
  items: Item[];
  vouchers: StockVoucher[];
  logs: InventoryLog[];

  // Actions - Warehouses
  addWarehouse: (wh: Omit<Warehouse, 'id'>) => Promise<{ success: boolean; message: string }>;
  updateWarehouse: (id: string, wh: Partial<Warehouse>) => Promise<{ success: boolean; message: string }>;
  deleteWarehouse: (id: string) => Promise<{ success: boolean; message: string }>;

  // Actions - Categories
  addCategory: (cat: Omit<Category, 'id'>) => Promise<{ success: boolean; message: string }>;
  updateCategory: (id: string, cat: Partial<Category>) => Promise<{ success: boolean; message: string }>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message: string }>;

  // Actions - Units
  addUnit: (unit: Omit<Unit, 'id'>) => Promise<{ success: boolean; message: string }>;
  updateUnit: (id: string, unit: Partial<Unit>) => Promise<{ success: boolean; message: string }>;
  deleteUnit: (id: string) => Promise<{ success: boolean; message: string }>;

  // Actions - Items
  addItem: (
    itemData: Omit<Item, 'id' | 'code' | 'createdAt' | 'updatedAt'> & { code?: string }
  ) => Promise<{ success: boolean; message: string; item?: Item }>;
  updateItem: (id: string, itemData: Partial<Item>) => Promise<{ success: boolean; message: string }>;
  deleteItem: (id: string) => Promise<{ success: boolean; message: string }>;
  importItems: (
    importedItems: Partial<Item>[]
  ) => Promise<{ success: boolean; message: string; successCount: number; errorCount: number }>;
  syncMissingCategoriesFromItems: () => Promise<{
    success: boolean;
    message: string;
    addedCats: number;
    addedUnits: number;
    addedWarehouses: number;
  }>;

  // Actions - Vouchers (Inbound / Outbound)
  createStockInVoucher: (data: {
    date: string;
    person: string;
    department?: string;
    warehouseId: string;
    note?: string;
    items: { itemId: string; quantity: number }[];
  }) => Promise<{ success: boolean; message: string; voucher?: StockVoucher }>;

  updateStockInVoucher: (
    id: string,
    data: {
      date: string;
      person: string;
      department?: string;
      warehouseId: string;
      note?: string;
      items: { itemId: string; quantity: number }[];
    }
  ) => Promise<{ success: boolean; message: string; voucher?: StockVoucher }>;

  deleteStockInVoucher: (id: string) => Promise<{ success: boolean; message: string }>;

  createStockOutVoucher: (data: {
    date: string;
    person: string;
    department?: string;
    warehouseId: string;
    note?: string;
    items: { itemId: string; quantity: number }[];
  }) => Promise<{ success: boolean; message: string; voucher?: StockVoucher }>;

  deleteVoucher: (id: string) => void;

  syncLocalVouchersToSQLServer: (type?: 'IN' | 'OUT') => Promise<{
    success: boolean;
    message: string;
    syncedCount: number;
    syncedItemsCount: number;
    skippedEmptyCount: number;
  }>;

  // Utility
  clearLocalData: () => void;
}

// Utility: Auto-recover categories, units and warehouses from items if missing
function recoverMasterDataFromItems(
  items: Item[],
  currentCats: Category[],
  currentUnits: Unit[],
  currentWhs: Warehouse[]
): {
  categories: Category[];
  units: Unit[];
  warehouses: Warehouse[];
  newCats: Category[];
  newUnits: Unit[];
  newWhs: Warehouse[];
} {
  const categories = [...currentCats];
  const catMap = new Map<string, Category>();
  categories.forEach((c) => {
    if (c.id) catMap.set(c.id, c);
    if (c.name) catMap.set(c.name.trim().toLowerCase(), c);
  });
  const newCats: Category[] = [];
  items.forEach((item) => {
    const catName = (item.categoryName || '').trim();
    const catId = item.categoryId;
    if (catName && !catMap.has(catId) && !catMap.has(catName.toLowerCase())) {
      const newCat: Category = {
        id: catId || `cat-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: `NH${String(categories.length + 1).padStart(2, '0')}`,
        name: catName,
        description: `Nhóm hàng ${catName}`,
      };
      categories.push(newCat);
      catMap.set(newCat.id, newCat);
      catMap.set(catName.toLowerCase(), newCat);
      newCats.push(newCat);
    }
  });

  const units = [...currentUnits];
  const unitMap = new Map<string, Unit>();
  units.forEach((u) => {
    if (u.id) unitMap.set(u.id, u);
    if (u.name) unitMap.set(u.name.trim().toLowerCase(), u);
  });
  const newUnits: Unit[] = [];
  items.forEach((item) => {
    const unitName = (item.unitName || '').trim();
    const unitId = item.unitId;
    if (unitName && !unitMap.has(unitId) && !unitMap.has(unitName.toLowerCase())) {
      const newUnit: Unit = {
        id: unitId || `unit-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: unitName,
        description: `Đơn vị tính ${unitName}`,
      };
      units.push(newUnit);
      unitMap.set(newUnit.id, newUnit);
      unitMap.set(unitName.toLowerCase(), newUnit);
      newUnits.push(newUnit);
    }
  });

  const warehouses = [...currentWhs];
  const whMap = new Map<string, Warehouse>();
  warehouses.forEach((w) => {
    if (w.id) whMap.set(w.id, w);
    if (w.name) whMap.set(w.name.trim().toLowerCase(), w);
  });
  const newWhs: Warehouse[] = [];
  items.forEach((item) => {
    const whName = (item.warehouseName || '').trim();
    const whId = item.warehouseId;
    if (whName && !whMap.has(whId) && !whMap.has(whName.toLowerCase())) {
      const newWh: Warehouse = {
        id: whId || `wh-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: `KHO-${warehouses.length + 1}`,
        name: whName,
        location: 'Khu vực chung',
        manager: 'Quản kho chính',
        description: `Kho ${whName}`,
        isDefault: warehouses.length === 0,
      };
      warehouses.push(newWh);
      whMap.set(newWh.id, newWh);
      whMap.set(whName.toLowerCase(), newWh);
      newWhs.push(newWh);
    }
  });

  return { categories, units, warehouses, newCats, newUnits, newWhs };
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      activeTab: 'dashboard',
      setActiveTab: (tab) => set({ activeTab: tab }),
      theme: 'light',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      searchTerm: '',
      setSearchTerm: (term) => set({ searchTerm: term }),

      // SQL Server State & Actions
      sqlServerConfig: getStoredSQLServerConfig(),
      setSqlServerConfig: (config) => {
        saveStoredSQLServerConfig(config);
        set({ sqlServerConfig: config });
      },
      isLoadingFromSQLServer: false,
      isSQLServerConnected: false,
      sqlServerError: null,

      fetchFromSQLServer: async () => {
        set({ isLoadingFromSQLServer: true, sqlServerError: null });
        const config = get().sqlServerConfig;
        const res = await fetchAllFromSQLServer(config);
        if (res.success) {
          const rawItems = res.items || [];
          const { categories, units, warehouses, newCats, newUnits, newWhs } = recoverMasterDataFromItems(
            rawItems,
            res.categories || [],
            res.units || [],
            res.warehouses || []
          );

          if (newCats.length > 0 || newUnits.length > 0 || newWhs.length > 0) {
            importItemsBatchToSQLServer(config, {
              categories: newCats,
              units: newUnits,
              warehouses: newWhs,
              items: [],
            });
          }

          // Merge SQL Server vouchers with current state:
          // If SQL Server returns a voucher with empty items[] (e.g. stock_voucher_items table
          // was never populated), fall back to items already stored locally so the detail
          // view never goes blank.
          const currentState = get();
          const serverVouchers = res.vouchers || [];
          const currentVouchers = currentState.vouchers;
          const vouchersToRepairFromLocal: { voucherId: string; items: StockVoucher['items'] }[] = [];

          const mergedVouchers = serverVouchers.map((sv) => {
            if (sv.items.length === 0 && currentVouchers.length > 0) {
              const existing = currentVouchers.find(
                (v) => v.id === sv.id || v.code === sv.code
              );
              if (existing && existing.items.length > 0) {
                vouchersToRepairFromLocal.push({
                  voucherId: sv.id,
                  items: existing.items,
                });
                return {
                  ...sv,
                  items: existing.items,
                  totalQuantity: sv.totalQuantity || existing.totalQuantity,
                };
              }
            }
            return sv;
          });

          if (vouchersToRepairFromLocal.length > 0) {
            vouchersToRepairFromLocal.forEach(({ voucherId, items: repairItems }) => {
              repairVoucherItemsInSQLServer(config, voucherId, repairItems);
            });
          }

          // Use authoritative logs directly from SQL Server so deleted records do not persist from localStorage
          const serverLogs = res.logs || [];

          set({
            items: rawItems,
            categories,
            warehouses,
            units,
            vouchers: mergedVouchers,
            logs: serverLogs,
            isSQLServerConnected: true,
            isLoadingFromSQLServer: false,
          });
          if (res.users && Array.isArray(res.users)) {
            useAuthStore.setState({ usersList: res.users });
            saveStoredLocalUsers(res.users);
          }
        } else {
          set({
            sqlServerError: res.error || 'Không thể tải dữ liệu từ SQL Server',
            isSQLServerConnected: false,
            isLoadingFromSQLServer: false,
          });
        }
      },

      testSQLServerConfig: async (cfg) => {
        const configToTest = cfg || get().sqlServerConfig;
        const result = await testSQLServerConnection(configToTest);
        if (result.success) {
          set({ isSQLServerConnected: true, sqlServerError: null });
        } else {
          set({ isSQLServerConnected: false, sqlServerError: result.message });
        }
        return result;
      },

      initSQLServerDb: async (cfg) => {
        const configToInit = cfg || get().sqlServerConfig;
        const result = await initSQLServerTables(configToInit);
        if (result.success) {
          set({ isSQLServerConnected: true, sqlServerError: null });
        }
        return result;
      },

      adminPassword: 'Antu123!@',
      isSettingsUnlocked: false,

      verifySettingsPassword: (inputPass) => {
        const currentPass = get().adminPassword || 'Antu123!@';
        if (inputPass === currentPass) {
          set({ isSettingsUnlocked: true });
          return true;
        }
        return false;
      },

      changeAdminPassword: (oldPass, newPass) => {
        const currentPass = get().adminPassword || 'Antu123!@';
        if (oldPass !== currentPass) {
          return { success: false, message: 'Mật khẩu hiện tại không chính xác!' };
        }
        if (!newPass || newPass.trim().length < 4) {
          return { success: false, message: 'Mật khẩu mới phải có ít nhất 4 ký tự!' };
        }
        set({ adminPassword: newPass.trim() });
        return { success: true, message: 'Đổi mật khẩu cài đặt thành công!' };
      },

      lockSettings: () => set({ isSettingsUnlocked: false }),

      warehouses: [],
      categories: [],
      units: [],
      items: [],
      vouchers: [],
      logs: [],

      // Warehouses
      addWarehouse: async (whData) => {
        const id = `wh-${Date.now()}`;
        const newWh: Warehouse = { ...whData, id };
        const dbRes = await saveWarehouseToSQLServer(get().sqlServerConfig, newWh);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể lưu kho lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu kho vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }
        set((state) => ({
          warehouses: [...state.warehouses, newWh],
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: `Đã thêm kho "${newWh.name}" vào SQL Server.` };
      },

      updateWarehouse: async (id, whData) => {
        const state = get();
        const existing = state.warehouses.find((w) => w.id === id);
        if (!existing) {
          return { success: false, message: 'Không tìm thấy kho cần cập nhật' };
        }
        const target: Warehouse = { ...existing, ...whData };
        const dbRes = await saveWarehouseToSQLServer(state.sqlServerConfig, target);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể cập nhật kho lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể cập nhật kho vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          warehouses: s.warehouses.map((w) => (w.id === id ? target : w)),
          items: s.items.map((item) =>
            item.warehouseId === id
              ? { ...item, warehouseName: target.name || item.warehouseName }
              : item
          ),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: `Đã cập nhật kho "${target.name}" vào SQL Server.` };
      },

      deleteWarehouse: async (id) => {
        const state = get();
        const hasItems = state.items.some((i) => i.warehouseId === id);
        if (hasItems) {
          return {
            success: false,
            message:
              'Không thể xóa kho vì đang có hàng hóa lưu trữ bên trong! Vui lòng chuyển hàng hóa sang kho khác trước khi xóa.',
          };
        }

        const dbRes = await deleteWarehouseFromSQLServer(state.sqlServerConfig, id);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể xóa kho trên SQL Server',
          });
          return {
            success: false,
            message: `Không thể xóa kho trên SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          warehouses: s.warehouses.filter((w) => w.id !== id),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: 'Đã xóa kho khỏi SQL Server.' };
      },

      // Categories
      addCategory: async (catData) => {
        const id = `cat-${Date.now()}`;
        const newCat: Category = { ...catData, id };
        const dbRes = await saveCategoryToSQLServer(get().sqlServerConfig, newCat);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể lưu nhóm hàng lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu nhóm hàng vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }
        set((state) => ({
          categories: [...state.categories, newCat],
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: `Đã thêm nhóm hàng "${newCat.name}" vào SQL Server.` };
      },

      updateCategory: async (id, catData) => {
        const state = get();
        const existing = state.categories.find((c) => c.id === id);
        if (!existing) {
          return { success: false, message: 'Không tìm thấy nhóm hàng cần cập nhật' };
        }
        const target: Category = { ...existing, ...catData };
        const dbRes = await saveCategoryToSQLServer(state.sqlServerConfig, target);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể cập nhật nhóm hàng lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể cập nhật nhóm hàng vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? target : c)),
          items: s.items.map((item) =>
            item.categoryId === id
              ? { ...item, categoryName: target.name || item.categoryName }
              : item
          ),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: `Đã cập nhật nhóm hàng "${target.name}" vào SQL Server.` };
      },

      deleteCategory: async (id) => {
        const state = get();
        const hasItems = state.items.some((i) => i.categoryId === id);
        if (hasItems) {
          return {
            success: false,
            message: 'Không thể xóa nhóm hàng vì đang có hàng hóa thuộc nhóm này!',
          };
        }

        const dbRes = await deleteCategoryFromSQLServer(state.sqlServerConfig, id);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể xóa nhóm hàng trên SQL Server',
          });
          return {
            success: false,
            message: `Không thể xóa nhóm hàng trên SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: 'Đã xóa nhóm hàng khỏi SQL Server.' };
      },

      // Units
      addUnit: async (unitData) => {
        const id = `u-${Date.now()}`;
        const newUnit: Unit = { ...unitData, id };
        const dbRes = await saveUnitToSQLServer(get().sqlServerConfig, newUnit);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể lưu đơn vị tính lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu đơn vị tính vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }
        set((state) => ({
          units: [...state.units, newUnit],
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: `Đã thêm đơn vị tính "${newUnit.name}" vào SQL Server.` };
      },

      updateUnit: async (id, unitData) => {
        const state = get();
        const existing = state.units.find((u) => u.id === id);
        if (!existing) {
          return { success: false, message: 'Không tìm thấy đơn vị tính cần cập nhật' };
        }
        const target: Unit = { ...existing, ...unitData };
        const dbRes = await saveUnitToSQLServer(state.sqlServerConfig, target);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể cập nhật đơn vị tính lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể cập nhật đơn vị tính vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          units: s.units.map((u) => (u.id === id ? target : u)),
          items: s.items.map((item) =>
            item.unitId === id ? { ...item, unitName: target.name || item.unitName } : item
          ),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: `Đã cập nhật đơn vị tính "${target.name}" vào SQL Server.` };
      },

      deleteUnit: async (id) => {
        const state = get();
        const hasItems = state.items.some((i) => i.unitId === id);
        if (hasItems) {
          return {
            success: false,
            message: 'Không thể xóa đơn vị tính vì đang được sử dụng bởi các mặt hàng!',
          };
        }

        const dbRes = await deleteUnitFromSQLServer(state.sqlServerConfig, id);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể xóa đơn vị tính trên SQL Server',
          });
          return {
            success: false,
            message: `Không thể xóa đơn vị tính trên SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          units: s.units.filter((u) => u.id !== id),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: 'Đã xóa đơn vị tính khỏi SQL Server.' };
      },

      // Items
      addItem: async (itemData) => {
        const state = get();
        const id = `item-${Date.now()}`;
        const existingCodes = state.items.map((i) => i.code);
        const code = itemData.code || generateItemCode(existingCodes);

        const category = state.categories.find((c) => c.id === itemData.categoryId);
        const unit = state.units.find((u) => u.id === itemData.unitId);
        const warehouse = state.warehouses.find((w) => w.id === itemData.warehouseId);

        const now = new Date().toISOString();

        const newItem: Item = {
          ...itemData,
          id,
          code,
          categoryName: category ? category.name : itemData.categoryName || '',
          unitName: unit ? unit.name : itemData.unitName || '',
          warehouseName: warehouse ? warehouse.name : itemData.warehouseName || '',
          createdAt: now,
          updatedAt: now,
        };

        const dbRes = await saveItemToSQLServer(state.sqlServerConfig, newItem);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể lưu hàng hóa lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu hàng hóa vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          items: [newItem, ...s.items],
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return {
          success: true,
          message: `Đã thêm mặt hàng "${newItem.name}" vào SQL Server.`,
          item: newItem,
        };
      },

      updateItem: async (id, itemData) => {
        const state = get();
        const existingItem = state.items.find((i) => i.id === id);
        if (!existingItem) {
          return { success: false, message: 'Không tìm thấy mặt hàng cần cập nhật' };
        }

        const category = itemData.categoryId
          ? state.categories.find((c) => c.id === itemData.categoryId)
          : undefined;
        const unit = itemData.unitId ? state.units.find((u) => u.id === itemData.unitId) : undefined;
        const warehouse = itemData.warehouseId
          ? state.warehouses.find((w) => w.id === itemData.warehouseId)
          : undefined;

        const updatedItem: Item = {
          ...existingItem,
          ...itemData,
          categoryName: category ? category.name : existingItem.categoryName,
          unitName: unit ? unit.name : existingItem.unitName,
          warehouseName: warehouse ? warehouse.name : existingItem.warehouseName,
          updatedAt: new Date().toISOString(),
        };

        const dbRes = await saveItemToSQLServer(state.sqlServerConfig, updatedItem);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể cập nhật hàng hóa lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể cập nhật hàng hóa vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((s) => ({
          items: s.items.map((item) => (item.id === id ? updatedItem : item)),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return {
          success: true,
          message: `Đã cập nhật mặt hàng "${updatedItem.name}" vào SQL Server.`,
        };
      },

      deleteItem: async (id) => {
        const dbRes = await deleteItemFromSQLServer(get().sqlServerConfig, id);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể xóa hàng hóa trên SQL Server',
          });
          return {
            success: false,
            message: `Không thể xóa hàng hóa trên SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          isSQLServerConnected: true,
          sqlServerError: null,
        }));
        return { success: true, message: 'Đã xóa mặt hàng khỏi SQL Server.' };
      },

      importItems: async (importedData) => {
        const state = get();
        let successCount = 0;
        let errorCount = 0;
        const newItems: Item[] = [];
        const existingCodes = [...state.items.map((i) => i.code)];

        const currentCategories = [...state.categories];
        const currentUnits = [...state.units];
        const currentWarehouses = [...state.warehouses];

        const newlyCreatedCats: Category[] = [];
        const newlyCreatedUnits: Unit[] = [];
        const newlyCreatedWarehouses: Warehouse[] = [];

        importedData.forEach((row, idx) => {
          if (!row.name) {
            errorCount++;
            return;
          }

          // 1. Match or Create Category
          const rowCatName = (row.categoryName || '').trim();
          let cat = currentCategories.find(
            (c) =>
              c.name.toLowerCase() === rowCatName.toLowerCase() ||
              c.code.toLowerCase() === rowCatName.toLowerCase()
          );
          if (!cat && rowCatName) {
            const catCode = `DM${String(currentCategories.length + 1).padStart(2, '0')}`;
            cat = {
              id: `cat-imp-${Date.now()}-${idx}`,
              code: catCode,
              name: rowCatName,
              description: `Nhóm hàng ${rowCatName} tự động tạo từ Excel import`,
            };
            currentCategories.push(cat);
            newlyCreatedCats.push(cat);
          }
          const catId = cat ? cat.id : currentCategories[0]?.id || '';
          const catName = cat ? cat.name : currentCategories[0]?.name || '';

          // 2. Match or Create Unit
          const rowUnitName = (row.unitName || '').trim();
          let unit = currentUnits.find(
            (u) => u.name.toLowerCase() === rowUnitName.toLowerCase()
          );
          if (!unit && rowUnitName) {
            unit = {
              id: `unit-imp-${Date.now()}-${idx}`,
              name: rowUnitName,
              description: `Đơn vị tính ${rowUnitName}`,
            };
            currentUnits.push(unit);
            newlyCreatedUnits.push(unit);
          }
          const unitId = unit ? unit.id : currentUnits[0]?.id || '';
          const unitName = unit ? unit.name : currentUnits[0]?.name || '';

          // 3. Match or Create Warehouse
          const rowWhName = (row.warehouseName || '').trim();
          let wh = currentWarehouses.find(
            (w) =>
              w.name.toLowerCase() === rowWhName.toLowerCase() ||
              w.code.toLowerCase() === rowWhName.toLowerCase()
          );
          if (!wh && rowWhName) {
            const whCode = `KHO-${currentWarehouses.length + 1}`;
            wh = {
              id: `wh-imp-${Date.now()}-${idx}`,
              code: whCode,
              name: rowWhName,
              location: 'Khu vực chung',
              manager: 'Quản kho chính',
              description: `Kho ${rowWhName} tự động tạo từ Excel import`,
            };
            currentWarehouses.push(wh);
            newlyCreatedWarehouses.push(wh);
          }
          const whId = wh ? wh.id : currentWarehouses[0]?.id || '';
          const whName = wh ? wh.name : currentWarehouses[0]?.name || '';

          // Code generation
          const code = generateItemCode([...existingCodes, ...newItems.map((n) => n.code)]);
          const now = new Date().toISOString();

          // Stock Quantity - negative stock or '-' defaults to 0
          const rawQty = Number(row.stockQuantity);
          const stockQuantity = isNaN(rawQty) || rawQty < 0 ? 0 : rawQty;

          const newItem: Item = {
            id: `item-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
            code,
            name: row.name,
            categoryId: catId,
            categoryName: catName,
            unitId: unitId,
            unitName: unitName,
            warehouseId: whId,
            warehouseName: whName,
            stockQuantity,
            minStockLevel: Number(row.minStockLevel) || 0,
            maxStockLevel: Number(row.maxStockLevel) || 100,
            note: row.note || 'Import từ Excel',
            createdAt: now,
            updatedAt: now,
          };

          newItems.push(newItem);
          successCount++;
        });

        if (
          newItems.length === 0 &&
          newlyCreatedCats.length === 0 &&
          newlyCreatedUnits.length === 0 &&
          newlyCreatedWarehouses.length === 0
        ) {
          return {
            success: false,
            message: 'Không có dòng dữ liệu hợp lệ nào để import.',
            successCount: 0,
            errorCount,
          };
        }

        const dbRes = await importItemsBatchToSQLServer(state.sqlServerConfig, {
          categories: newlyCreatedCats,
          units: newlyCreatedUnits,
          warehouses: newlyCreatedWarehouses,
          items: newItems,
        });

        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể import hàng hóa lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu dữ liệu import vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
            successCount: 0,
            errorCount,
          };
        }

        set((s) => ({
          items: [...newItems, ...s.items],
          categories: currentCategories,
          units: currentUnits,
          warehouses: currentWarehouses,
          isSQLServerConnected: true,
          sqlServerError: null,
        }));

        return {
          success: true,
          message: `Đã import và lưu thành công ${successCount} mặt hàng vào SQL Server.`,
          successCount,
          errorCount,
        };
      },

      syncMissingCategoriesFromItems: async () => {
        const state = get();
        const { categories, units, warehouses, newCats, newUnits, newWhs } = recoverMasterDataFromItems(
          state.items,
          state.categories,
          state.units,
          state.warehouses
        );

        if (newCats.length === 0 && newUnits.length === 0 && newWhs.length === 0) {
          return {
            success: true,
            message: 'Tất cả nhóm hàng, đơn vị tính và kho đã được đồng bộ đầy đủ từ sản phẩm!',
            addedCats: 0,
            addedUnits: 0,
            addedWarehouses: 0,
          };
        }

        const dbRes = await importItemsBatchToSQLServer(state.sqlServerConfig, {
          categories: newCats,
          units: newUnits,
          warehouses: newWhs,
          items: [],
        });

        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể đồng bộ danh mục lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu danh mục khôi phục lên SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
            addedCats: 0,
            addedUnits: 0,
            addedWarehouses: 0,
          };
        }

        set({
          categories,
          units,
          warehouses,
          isSQLServerConnected: true,
          sqlServerError: null,
        });

        return {
          success: true,
          message: `Đã khôi phục và lưu lên SQL Server: ${newCats.length} nhóm hàng, ${newUnits.length} đơn vị tính, ${newWhs.length} kho.`,
          addedCats: newCats.length,
          addedUnits: newUnits.length,
          addedWarehouses: newWhs.length,
        };
      },

      // Create Inbound Stock Voucher
      createStockInVoucher: async (data) => {
        const state = get();
        if (!data.items || data.items.length === 0) {
          return { success: false, message: 'Vui lòng chọn ít nhất 1 mặt hàng để nhập kho' };
        }

        const warehouse = state.warehouses.find((w) => w.id === data.warehouseId);
        if (!warehouse) {
          return { success: false, message: 'Kho nhập không tồn tại' };
        }

        const voucherCode = generateVoucherCode(
          'IN',
          state.vouchers.map((v) => v.code)
        );
        const voucherId = `v-in-${Date.now()}`;
        const nowIso = new Date().toISOString();

        let totalQty = 0;
        const voucherItems: StockVoucher['items'] = [];
        const newLogs: InventoryLog[] = [];
        const updatedItemsMap = new Map<string, Item>(state.items.map((i) => [i.id, { ...i }]));
        const changedItemIds = new Set<string>();

        for (const line of data.items) {
          const item = updatedItemsMap.get(line.itemId);
          if (!item) continue;

          const qty = Number(line.quantity) || 0;
          if (qty <= 0) continue;

          const prevStock = item.stockQuantity;
          const newStock = prevStock + qty;
          item.stockQuantity = newStock;
          item.updatedAt = nowIso;
          changedItemIds.add(item.id);

          totalQty += qty;

          voucherItems.push({
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            unitName: item.unitName,
            quantity: qty,
            currentStock: newStock,
          });

          newLogs.push({
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            voucherId,
            voucherCode,
            type: 'IN',
            date: data.date,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            categoryName: item.categoryName,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            quantity: qty,
            previousStock: prevStock,
            newStock: newStock,
            person: data.person,
            department: data.department,
            note: data.note || 'Nhập kho',
          });
        }

        if (voucherItems.length === 0) {
          return { success: false, message: 'Số lượng nhập phải lớn hơn 0' };
        }

        const newVoucher: StockVoucher = {
          id: voucherId,
          code: voucherCode,
          type: 'IN',
          date: data.date,
          person: data.person,
          department: data.department,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          note: data.note,
          items: voucherItems,
          totalQuantity: totalQty,
          createdAt: nowIso,
        };

        const updatedItemsList = Array.from(updatedItemsMap.values());
        const changedItemsList = updatedItemsList.filter((i) => changedItemIds.has(i.id));

        const dbRes = await saveVoucherToSQLServer(get().sqlServerConfig, newVoucher, newLogs, changedItemsList);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể lưu phiếu nhập kho lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu phiếu nhập kho vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set({
          vouchers: [newVoucher, ...state.vouchers],
          logs: [...newLogs, ...state.logs],
          items: updatedItemsList,
          isSQLServerConnected: true,
          sqlServerError: null,
        });

        return { success: true, message: `Lưu phiếu nhập kho thành công: ${voucherCode}`, voucher: newVoucher };
      },

      // Update Inbound Stock Voucher (restricted to 24h)
      updateStockInVoucher: async (id, data) => {
        const state = get();
        const existingVoucher = state.vouchers.find((v) => v.id === id);
        if (!existingVoucher) {
          return { success: false, message: 'Không tìm thấy phiếu nhập kho' };
        }
        if (existingVoucher.type !== 'IN') {
          return { success: false, message: 'Phiếu này không phải là phiếu nhập kho' };
        }

        // 24-hour validation check
        const createdAtMs = new Date(existingVoucher.createdAt || existingVoucher.date).getTime();
        const diffHours = (Date.now() - createdAtMs) / (1000 * 60 * 60);
        if (diffHours > 24) {
          return {
            success: false,
            message: 'Chỉ được chỉnh sửa phiếu nhập kho trong vòng 24 giờ kể từ thời điểm tạo phiếu.',
          };
        }

        if (!data.items || data.items.length === 0) {
          return { success: false, message: 'Vui lòng chọn ít nhất 1 mặt hàng' };
        }

        const warehouse = state.warehouses.find((w) => w.id === data.warehouseId);
        if (!warehouse) {
          return { success: false, message: 'Kho nhập không tồn tại' };
        }

        const nowIso = new Date().toISOString();
        const updatedItemsMap = new Map<string, Item>(state.items.map((i) => [i.id, { ...i }]));
        const changedItemIds = new Set<string>();

        // 1. Rollback stock from old voucher items
        for (const oldLine of existingVoucher.items) {
          const item = updatedItemsMap.get(oldLine.itemId);
          if (item) {
            item.stockQuantity = Math.max(0, item.stockQuantity - oldLine.quantity);
            item.updatedAt = nowIso;
            changedItemIds.add(item.id);
          }
        }

        // 2. Add stock from new voucher items
        let totalQty = 0;
        const newVoucherItems: StockVoucher['items'] = [];
        const newLogs: InventoryLog[] = [];

        for (const line of data.items) {
          const item = updatedItemsMap.get(line.itemId);
          if (!item) continue;
          const qty = Number(line.quantity) || 0;
          if (qty <= 0) continue;

          const prevStock = item.stockQuantity;
          const newStock = prevStock + qty;
          item.stockQuantity = newStock;
          item.updatedAt = nowIso;
          changedItemIds.add(item.id);
          totalQty += qty;

          newVoucherItems.push({
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            unitName: item.unitName,
            quantity: qty,
            currentStock: newStock,
          });

          newLogs.push({
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            voucherId: id,
            voucherCode: existingVoucher.code,
            type: 'IN',
            date: data.date,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            categoryName: item.categoryName,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            quantity: qty,
            previousStock: prevStock,
            newStock: newStock,
            person: data.person,
            department: data.department,
            note: data.note || 'Cập nhật phiếu nhập kho',
          });
        }

        if (newVoucherItems.length === 0) {
          return { success: false, message: 'Số lượng nhập phải lớn hơn 0' };
        }

        const updatedVoucher: StockVoucher = {
          ...existingVoucher,
          date: data.date,
          person: data.person,
          department: data.department,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          note: data.note,
          items: newVoucherItems,
          totalQuantity: totalQty,
        };

        const updatedItemsList = Array.from(updatedItemsMap.values());
        const changedItemsList = updatedItemsList.filter((i) => changedItemIds.has(i.id));

        const dbRes = await saveVoucherToSQLServer(get().sqlServerConfig, updatedVoucher, newLogs, changedItemsList);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể cập nhật phiếu nhập kho lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể cập nhật phiếu nhập kho vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        const updatedVouchers = state.vouchers.map((v) => (v.id === id ? updatedVoucher : v));
        const filteredLogs = state.logs.filter((l) => l.voucherId !== id);

        set({
          vouchers: updatedVouchers,
          logs: [...newLogs, ...filteredLogs],
          items: updatedItemsList,
          isSQLServerConnected: true,
          sqlServerError: null,
        });

        return {
          success: true,
          message: `Cập nhật phiếu nhập kho ${existingVoucher.code} thành công!`,
          voucher: updatedVoucher,
        };
      },

      // Delete Inbound Stock Voucher (restricted to 24h & reverts stock)
      deleteStockInVoucher: async (id) => {
        const state = get();
        const existingVoucher = state.vouchers.find((v) => v.id === id);
        if (!existingVoucher) {
          return { success: false, message: 'Không tìm thấy phiếu nhập kho' };
        }
        if (existingVoucher.type !== 'IN') {
          return { success: false, message: 'Phiếu này không phải là phiếu nhập kho' };
        }

        // 24-hour validation check
        const createdAtMs = new Date(existingVoucher.createdAt || existingVoucher.date).getTime();
        const diffHours = (Date.now() - createdAtMs) / (1000 * 60 * 60);
        if (diffHours > 24) {
          return {
            success: false,
            message: 'Chỉ được xóa phiếu nhập kho trong vòng 24 giờ kể từ thời điểm tạo phiếu.',
          };
        }

        const nowIso = new Date().toISOString();
        const updatedItemsMap = new Map<string, Item>(state.items.map((i) => [i.id, { ...i }]));
        const changedItemIds = new Set<string>();

        // Revert stock added by this voucher
        for (const line of existingVoucher.items) {
          const item = updatedItemsMap.get(line.itemId);
          if (item) {
            item.stockQuantity = Math.max(0, item.stockQuantity - line.quantity);
            item.updatedAt = nowIso;
            changedItemIds.add(item.id);
          }
        }

        const updatedItemsList = Array.from(updatedItemsMap.values());
        const changedItemsList = updatedItemsList.filter((i) => changedItemIds.has(i.id));

        const dbRes = await deleteVoucherFromSQLServer(get().sqlServerConfig, id, changedItemsList);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể xóa phiếu nhập kho trên SQL Server',
          });
          return {
            success: false,
            message: `Không thể xóa phiếu nhập kho trên SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        const updatedVouchers = state.vouchers.filter((v) => v.id !== id);
        const updatedLogs = state.logs.filter((l) => l.voucherId !== id);

        set({
          vouchers: updatedVouchers,
          logs: updatedLogs,
          items: updatedItemsList,
          isSQLServerConnected: true,
          sqlServerError: null,
        });

        return {
          success: true,
          message: `Đã xóa phiếu nhập kho ${existingVoucher.code} và hoàn trả số lượng tồn kho.`,
        };
      },

      // Create Outbound Stock Voucher with STRICT stock check
      createStockOutVoucher: async (data) => {
        const state = get();
        if (!data.items || data.items.length === 0) {
          return { success: false, message: 'Vui lòng chọn ít nhất 1 mặt hàng để xuất kho' };
        }

        const warehouse = state.warehouses.find((w) => w.id === data.warehouseId);
        if (!warehouse) {
          return { success: false, message: 'Kho xuất không tồn tại' };
        }

        // Check stock availability
        for (const line of data.items) {
          const item = state.items.find((i) => i.id === line.itemId);
          if (!item) {
            return { success: false, message: 'Có mặt hàng không tồn tại trong hệ thống' };
          }
          if (line.quantity > item.stockQuantity) {
            return {
              success: false,
              message: `Không đủ tồn kho cho mặt hàng "${item.name}". Tồn hiện tại: ${item.stockQuantity} ${item.unitName}, Yêu cầu xuất: ${line.quantity} ${item.unitName}.`,
            };
          }
        }

        const voucherCode = generateVoucherCode(
          'OUT',
          state.vouchers.map((v) => v.code)
        );
        const voucherId = `v-out-${Date.now()}`;
        const nowIso = new Date().toISOString();

        let totalQty = 0;
        const voucherItems: StockVoucher['items'] = [];
        const newLogs: InventoryLog[] = [];
        const updatedItemsMap = new Map<string, Item>(state.items.map((i) => [i.id, { ...i }]));
        const changedItemIds = new Set<string>();

        for (const line of data.items) {
          const item = updatedItemsMap.get(line.itemId)!;
          const qty = Number(line.quantity) || 0;
          if (qty <= 0) continue;

          const prevStock = item.stockQuantity;
          const newStock = prevStock - qty;
          item.stockQuantity = newStock;
          item.updatedAt = nowIso;
          changedItemIds.add(item.id);

          totalQty += qty;

          voucherItems.push({
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            unitName: item.unitName,
            quantity: qty,
            currentStock: newStock,
          });

          newLogs.push({
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            voucherId,
            voucherCode,
            type: 'OUT',
            date: data.date,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            categoryName: item.categoryName,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            quantity: qty,
            previousStock: prevStock,
            newStock: newStock,
            person: data.person,
            department: data.department,
            note: data.note || 'Xuất kho',
          });
        }

        if (voucherItems.length === 0) {
          return { success: false, message: 'Số lượng xuất phải lớn hơn 0' };
        }

        const newVoucher: StockVoucher = {
          id: voucherId,
          code: voucherCode,
          type: 'OUT',
          date: data.date,
          person: data.person,
          department: data.department,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          note: data.note,
          items: voucherItems,
          totalQuantity: totalQty,
          createdAt: nowIso,
        };

        const updatedItemsList = Array.from(updatedItemsMap.values());
        const changedItemsList = updatedItemsList.filter((i) => changedItemIds.has(i.id));

        const dbRes = await saveVoucherToSQLServer(get().sqlServerConfig, newVoucher, newLogs, changedItemsList);
        if (!dbRes.success) {
          set({
            isSQLServerConnected: false,
            sqlServerError: dbRes.message || 'Không thể lưu phiếu xuất kho lên SQL Server',
          });
          return {
            success: false,
            message: `Không thể lưu phiếu xuất kho vào SQL Server: ${dbRes.message || 'Lỗi kết nối cơ sở dữ liệu'}`,
          };
        }

        set({
          vouchers: [newVoucher, ...state.vouchers],
          logs: [...newLogs, ...state.logs],
          items: updatedItemsList,
          isSQLServerConnected: true,
          sqlServerError: null,
        });

        return { success: true, message: `Lưu phiếu xuất kho thành công: ${voucherCode}`, voucher: newVoucher };
      },

      deleteVoucher: (id) => {
        set((state) => ({
          vouchers: state.vouchers.filter((v) => v.id !== id),
        }));
      },

      syncLocalVouchersToSQLServer: async (type) => {
        const state = get();
        const config = state.sqlServerConfig;
        const targetVouchers = type
          ? state.vouchers.filter((v) => v.type === type)
          : state.vouchers;

        if (targetVouchers.length === 0) {
          return {
            success: false,
            message: 'Không có phiếu nào trong bộ nhớ để đồng bộ lên SQL Server.',
            syncedCount: 0,
            syncedItemsCount: 0,
            skippedEmptyCount: 0,
          };
        }

        let syncedCount = 0;
        let syncedItemsCount = 0;
        let skippedEmptyCount = 0;
        const failedCodes: string[] = [];
        let lastErrorMessage = '';

        for (const v of targetVouchers) {
          const matchingLogs = state.logs.filter(
            (l) => l.voucherId === v.id || (v.code && l.voucherCode === v.code)
          );

          const effectiveItems =
            v.items && v.items.length > 0
              ? v.items
              : matchingLogs.map((l) => {
                  const matchedItem = state.items.find(
                    (i) => i.id === l.itemId || i.code === l.itemCode
                  );
                  return {
                    itemId: l.itemId,
                    itemCode: l.itemCode,
                    itemName: l.itemName,
                    unitName: matchedItem?.unitName || '',
                    quantity: l.quantity,
                    currentStock: l.newStock,
                  };
                });

          if (effectiveItems.length === 0) {
            skippedEmptyCount++;
            continue;
          }

          const computedTotalQty = effectiveItems.reduce(
            (sum, li) => sum + (Number(li.quantity) || 0),
            0
          );

          const voucherPayload: StockVoucher = {
            ...v,
            items: effectiveItems,
            totalQuantity: v.totalQuantity || computedTotalQty,
          };

          const logsToSave: InventoryLog[] =
            matchingLogs.length > 0
              ? matchingLogs.map((l) => ({
                  ...l,
                  voucherId: v.id,
                  voucherCode: v.code,
                }))
              : effectiveItems.map((line, idx) => {
                  const matchedItem = state.items.find(
                    (i) => i.id === line.itemId || i.code === line.itemCode
                  );
                  const currentStockVal =
                    Number(line.currentStock) || matchedItem?.stockQuantity || 0;
                  const qtyVal = Number(line.quantity) || 0;
                  const prevStockVal =
                    v.type === 'IN'
                      ? Math.max(0, currentStockVal - qtyVal)
                      : currentStockVal + qtyVal;
                  return {
                    id: `log-sync-${v.id}-${idx}`,
                    voucherId: v.id,
                    voucherCode: v.code,
                    type: v.type,
                    date: v.date,
                    itemId: line.itemId,
                    itemCode: line.itemCode,
                    itemName: line.itemName,
                    categoryName: matchedItem?.categoryName || '',
                    warehouseId: v.warehouseId,
                    warehouseName: v.warehouseName,
                    quantity: qtyVal,
                    previousStock: prevStockVal,
                    newStock: currentStockVal,
                    person: v.person,
                    department: v.department,
                    note: v.note || (v.type === 'IN' ? 'Nhập kho' : 'Xuất kho'),
                  };
                });

          // Pass updatedItems = [] so existing stock quantities in SQL Server are NOT modified again
          const res = await saveVoucherToSQLServer(config, voucherPayload, logsToSave, []);
          if (!res.success) {
            failedCodes.push(v.code || v.id);
            lastErrorMessage = res.message || 'Lỗi kết nối SQL Server';
            // If first call fails due to DB connection error, stop early instead of repeating timeouts
            if (syncedCount === 0 && failedCodes.length === 1) {
              set({
                isSQLServerConnected: false,
                sqlServerError: lastErrorMessage,
              });
              return {
                success: false,
                message: `Không thể đồng bộ lên SQL Server: ${lastErrorMessage}`,
                syncedCount: 0,
                syncedItemsCount: 0,
                skippedEmptyCount,
              };
            }
          } else {
            syncedCount++;
            syncedItemsCount += effectiveItems.length;
          }
        }

        if (syncedCount === 0) {
          return {
            success: false,
            message:
              failedCodes.length > 0
                ? `Đồng bộ thất bại (${failedCodes.length} phiếu): ${lastErrorMessage}`
                : 'Các phiếu hiện có chưa có dữ liệu chi tiết mặt hàng ở máy này để đồng bộ.',
            syncedCount: 0,
            syncedItemsCount: 0,
            skippedEmptyCount,
          };
        }

        await get().fetchFromSQLServer();

        const extraNote =
          skippedEmptyCount > 0
            ? ` (Bỏ qua ${skippedEmptyCount} phiếu không có chi tiết ở máy hiện tại)`
            : '';
        const failNote =
          failedCodes.length > 0
            ? ` | Lỗi ${failedCodes.length} phiếu: ${failedCodes.join(', ')}`
            : '';

        return {
          success: failedCodes.length === 0,
          message: `Đã đồng bộ thành công ${syncedCount} phiếu (${syncedItemsCount} dòng chi tiết) lên SQL Server${extraNote}${failNote}.`,
          syncedCount,
          syncedItemsCount,
          skippedEmptyCount,
        };
      },

      clearLocalData: () => {
        set({
          warehouses: [],
          categories: [],
          units: [],
          items: [],
          vouchers: [],
          logs: [],
        });
      },
    }),
    {
      name: 'erp-mini-inventory-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2 && persistedState && typeof persistedState === 'object') {
          return { ...persistedState, theme: 'light' };
        }
        return persistedState;
      },
      partialize: (state) => ({
        theme: state.theme,
        warehouses: state.warehouses,
        categories: state.categories,
        units: state.units,
        items: state.items,
        vouchers: state.vouchers,
        logs: state.logs,
      }),
    }
  )
);
