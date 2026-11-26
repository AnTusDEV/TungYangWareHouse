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
  addWarehouse: (wh: Omit<Warehouse, 'id'>) => void;
  updateWarehouse: (id: string, wh: Partial<Warehouse>) => void;
  deleteWarehouse: (id: string) => boolean;

  // Actions - Categories
  addCategory: (cat: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, cat: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;

  // Actions - Units
  addUnit: (unit: Omit<Unit, 'id'>) => void;
  updateUnit: (id: string, unit: Partial<Unit>) => void;
  deleteUnit: (id: string) => boolean;

  // Actions - Items
  addItem: (itemData: Omit<Item, 'id' | 'code' | 'createdAt' | 'updatedAt'> & { code?: string }) => Item;
  updateItem: (id: string, itemData: Partial<Item>) => void;
  deleteItem: (id: string) => boolean;
  importItems: (importedItems: Partial<Item>[]) => { successCount: number; errorCount: number };
  syncMissingCategoriesFromItems: () => { addedCats: number; addedUnits: number; addedWarehouses: number };

  // Actions - Vouchers (Inbound / Outbound)
  createStockInVoucher: (data: {
    date: string;
    person: string;
    department?: string;
    warehouseId: string;
    note?: string;
    items: { itemId: string; quantity: number }[];
  }) => { success: boolean; message: string; voucher?: StockVoucher };

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
  ) => { success: boolean; message: string; voucher?: StockVoucher };

  deleteStockInVoucher: (id: string) => { success: boolean; message: string };

  createStockOutVoucher: (data: {
    date: string;
    person: string;
    department?: string;
    warehouseId: string;
    note?: string;
    items: { itemId: string; quantity: number }[];
  }) => { success: boolean; message: string; voucher?: StockVoucher };

  deleteVoucher: (id: string) => void;

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
      theme: 'dark',
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

          if (newCats.length > 0) {
            newCats.forEach((c) => {
              saveCategoryToSQLServer(config, c);
            });
          }
          if (newUnits.length > 0) {
            newUnits.forEach((u) => {
              saveUnitToSQLServer(config, u);
            });
          }
          if (newWhs.length > 0) {
            newWhs.forEach((w) => {
              saveWarehouseToSQLServer(config, w);
            });
          }

          // Merge SQL Server vouchers with current state:
          // If SQL Server returns a voucher with empty items[] (e.g. stock_voucher_items table
          // was never populated), fall back to items already stored locally so the detail
          // view never goes blank.
          const currentState = get();
          const serverVouchers = res.vouchers || [];
          const currentVouchers = currentState.vouchers;

          const mergedVouchers = serverVouchers.map((sv) => {
            if (sv.items.length === 0 && currentVouchers.length > 0) {
              const existing = currentVouchers.find(
                (v) => v.id === sv.id || v.code === sv.code
              );
              if (existing && existing.items.length > 0) {
                return {
                  ...sv,
                  items: existing.items,
                  totalQuantity: sv.totalQuantity || existing.totalQuantity,
                };
              }
            }
            return sv;
          });

          // Merge logs: keep local logs for vouchers that have no matching entry on the server
          const serverLogs = res.logs || [];
          const currentLogs = currentState.logs;
          const serverLogVoucherIds = new Set(serverLogs.map((l) => l.voucherId));
          const extraLocalLogs = currentLogs.filter(
            (l) => !serverLogVoucherIds.has(l.voucherId)
          );
          const mergedLogs = [...serverLogs, ...extraLocalLogs];

          set({
            items: rawItems,
            categories,
            warehouses,
            units,
            vouchers: mergedVouchers,
            logs: mergedLogs,
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
      addWarehouse: (whData) => {
        const id = `wh-${Date.now()}`;
        const newWh: Warehouse = { ...whData, id };
        set((state) => ({ warehouses: [...state.warehouses, newWh] }));
        saveWarehouseToSQLServer(get().sqlServerConfig, newWh);
      },

      updateWarehouse: (id, whData) => {
        set((state) => {
          const updatedWhs = state.warehouses.map((w) => (w.id === id ? { ...w, ...whData } : w));
          const updatedItems = state.items.map((item) =>
            item.warehouseId === id ? { ...item, warehouseName: whData.name || item.warehouseName } : item
          );
          const target = updatedWhs.find((w) => w.id === id);
          if (target) {
            saveWarehouseToSQLServer(get().sqlServerConfig, target);
          }
          return { warehouses: updatedWhs, items: updatedItems };
        });
      },

      deleteWarehouse: (id) => {
        const state = get();
        const hasItems = state.items.some((i) => i.warehouseId === id);
        if (hasItems) return false;
        set({ warehouses: state.warehouses.filter((w) => w.id !== id) });
        deleteWarehouseFromSQLServer(get().sqlServerConfig, id);
        return true;
      },

      // Categories
      addCategory: (catData) => {
        const id = `cat-${Date.now()}`;
        const newCat: Category = { ...catData, id };
        set((state) => ({ categories: [...state.categories, newCat] }));
        saveCategoryToSQLServer(get().sqlServerConfig, newCat);
      },

      updateCategory: (id, catData) => {
        set((state) => {
          const updatedCats = state.categories.map((c) => (c.id === id ? { ...c, ...catData } : c));
          const updatedItems = state.items.map((item) =>
            item.categoryId === id ? { ...item, categoryName: catData.name || item.categoryName } : item
          );
          const target = updatedCats.find((c) => c.id === id);
          if (target) {
            saveCategoryToSQLServer(get().sqlServerConfig, target);
          }
          return { categories: updatedCats, items: updatedItems };
        });
      },

      deleteCategory: (id) => {
        const state = get();
        const hasItems = state.items.some((i) => i.categoryId === id);
        if (hasItems) return false;
        set({ categories: state.categories.filter((c) => c.id !== id) });
        deleteCategoryFromSQLServer(get().sqlServerConfig, id);
        return true;
      },

      // Units
      addUnit: (unitData) => {
        const id = `u-${Date.now()}`;
        const newUnit: Unit = { ...unitData, id };
        set((state) => ({ units: [...state.units, newUnit] }));
        saveUnitToSQLServer(get().sqlServerConfig, newUnit);
      },

      updateUnit: (id, unitData) => {
        set((state) => {
          const updatedUnits = state.units.map((u) => (u.id === id ? { ...u, ...unitData } : u));
          const updatedItems = state.items.map((item) =>
            item.unitId === id ? { ...item, unitName: unitData.name || item.unitName } : item
          );
          const target = updatedUnits.find((u) => u.id === id);
          if (target) {
            saveUnitToSQLServer(get().sqlServerConfig, target);
          }
          return { units: updatedUnits, items: updatedItems };
        });
      },

      deleteUnit: (id) => {
        const state = get();
        const hasItems = state.items.some((i) => i.unitId === id);
        if (hasItems) return false;
        set({ units: state.units.filter((u) => u.id !== id) });
        deleteUnitFromSQLServer(get().sqlServerConfig, id);
        return true;
      },

      // Items
      addItem: (itemData) => {
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

        set({ items: [newItem, ...state.items] });
        saveItemToSQLServer(get().sqlServerConfig, newItem);
        return newItem;
      },

      updateItem: (id, itemData) => {
        const state = get();
        const category = itemData.categoryId
          ? state.categories.find((c) => c.id === itemData.categoryId)
          : undefined;
        const unit = itemData.unitId ? state.units.find((u) => u.id === itemData.unitId) : undefined;
        const warehouse = itemData.warehouseId
          ? state.warehouses.find((w) => w.id === itemData.warehouseId)
          : undefined;

        let updatedItem: Item | undefined;

        set((s) => ({
          items: s.items.map((item) => {
            if (item.id !== id) return item;
            updatedItem = {
              ...item,
              ...itemData,
              categoryName: category ? category.name : item.categoryName,
              unitName: unit ? unit.name : item.unitName,
              warehouseName: warehouse ? warehouse.name : item.warehouseName,
              updatedAt: new Date().toISOString(),
            };
            return updatedItem;
          }),
        }));

        if (updatedItem) {
          saveItemToSQLServer(get().sqlServerConfig, updatedItem);
        }
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
        deleteItemFromSQLServer(get().sqlServerConfig, id);
        return true;
      },

      importItems: (importedData) => {
        const state = get();
        let successCount = 0;
        let errorCount = 0;
        const newItems: Item[] = [];
        const existingCodes = [...state.items.map((i) => i.code)];

        let currentCategories = [...state.categories];
        let currentUnits = [...state.units];
        let currentWarehouses = [...state.warehouses];

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
            saveCategoryToSQLServer(get().sqlServerConfig, cat);
          }
          let catId = cat ? cat.id : currentCategories[0]?.id || '';
          let catName = cat ? cat.name : currentCategories[0]?.name || '';

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
            saveUnitToSQLServer(get().sqlServerConfig, unit);
          }
          let unitId = unit ? unit.id : currentUnits[0]?.id || '';
          let unitName = unit ? unit.name : currentUnits[0]?.name || '';

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
            saveWarehouseToSQLServer(get().sqlServerConfig, wh);
          }
          let whId = wh ? wh.id : currentWarehouses[0]?.id || '';
          let whName = wh ? wh.name : currentWarehouses[0]?.name || '';

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

          // Save item to SQL Server
          saveItemToSQLServer(get().sqlServerConfig, newItem);

          successCount++;
        });

        if (
          newItems.length > 0 ||
          newlyCreatedCats.length > 0 ||
          newlyCreatedUnits.length > 0 ||
          newlyCreatedWarehouses.length > 0
        ) {
          set((s) => ({
            items: [...newItems, ...s.items],
            categories: currentCategories,
            units: currentUnits,
            warehouses: currentWarehouses,
          }));
        }

        return { successCount, errorCount };
      },

      syncMissingCategoriesFromItems: () => {
        const state = get();
        const { categories, units, warehouses, newCats, newUnits, newWhs } = recoverMasterDataFromItems(
          state.items,
          state.categories,
          state.units,
          state.warehouses
        );

        if (newCats.length > 0 || newUnits.length > 0 || newWhs.length > 0) {
          set({ categories, units, warehouses });
          newCats.forEach((c) => {
            saveCategoryToSQLServer(state.sqlServerConfig, c);
          });
          newUnits.forEach((u) => {
            saveUnitToSQLServer(state.sqlServerConfig, u);
          });
          newWhs.forEach((w) => {
            saveWarehouseToSQLServer(state.sqlServerConfig, w);
          });
        }

        return {
          addedCats: newCats.length,
          addedUnits: newUnits.length,
          addedWarehouses: newWhs.length,
        };
      },

      // Create Inbound Stock Voucher
      createStockInVoucher: (data) => {
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

        for (const line of data.items) {
          const item = updatedItemsMap.get(line.itemId);
          if (!item) continue;

          const qty = Number(line.quantity) || 0;
          if (qty <= 0) continue;

          const prevStock = item.stockQuantity;
          const newStock = prevStock + qty;
          item.stockQuantity = newStock;
          item.updatedAt = nowIso;

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

        set({
          vouchers: [newVoucher, ...state.vouchers],
          logs: [...newLogs, ...state.logs],
          items: updatedItemsList,
        });

        saveVoucherToSQLServer(get().sqlServerConfig, newVoucher, newLogs, updatedItemsList);

        return { success: true, message: `Lưu phiếu nhập kho thành công: ${voucherCode}`, voucher: newVoucher };
      },

      // Update Inbound Stock Voucher (restricted to 24h)
      updateStockInVoucher: (id, data) => {
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

        // 1. Rollback stock from old voucher items
        for (const oldLine of existingVoucher.items) {
          const item = updatedItemsMap.get(oldLine.itemId);
          if (item) {
            item.stockQuantity = Math.max(0, item.stockQuantity - oldLine.quantity);
            item.updatedAt = nowIso;
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
        const updatedVouchers = state.vouchers.map((v) => (v.id === id ? updatedVoucher : v));
        const filteredLogs = state.logs.filter((l) => l.voucherId !== id);

        set({
          vouchers: updatedVouchers,
          logs: [...newLogs, ...filteredLogs],
          items: updatedItemsList,
        });

        saveVoucherToSQLServer(get().sqlServerConfig, updatedVoucher, newLogs, updatedItemsList);

        return {
          success: true,
          message: `Cập nhật phiếu nhập kho ${existingVoucher.code} thành công!`,
          voucher: updatedVoucher,
        };
      },

      // Delete Inbound Stock Voucher (restricted to 24h & reverts stock)
      deleteStockInVoucher: (id) => {
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

        // Revert stock added by this voucher
        for (const line of existingVoucher.items) {
          const item = updatedItemsMap.get(line.itemId);
          if (item) {
            item.stockQuantity = Math.max(0, item.stockQuantity - line.quantity);
            item.updatedAt = nowIso;
          }
        }

        const updatedItemsList = Array.from(updatedItemsMap.values());
        const updatedVouchers = state.vouchers.filter((v) => v.id !== id);
        const updatedLogs = state.logs.filter((l) => l.voucherId !== id);

        set({
          vouchers: updatedVouchers,
          logs: updatedLogs,
          items: updatedItemsList,
        });

        deleteVoucherFromSQLServer(get().sqlServerConfig, id, updatedItemsList);

        return {
          success: true,
          message: `Đã xóa phiếu nhập kho ${existingVoucher.code} và hoàn trả số lượng tồn kho.`,
        };
      },

      // Create Outbound Stock Voucher with STRICT stock check
      createStockOutVoucher: (data) => {
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

        for (const line of data.items) {
          const item = updatedItemsMap.get(line.itemId)!;
          const qty = Number(line.quantity) || 0;
          if (qty <= 0) continue;

          const prevStock = item.stockQuantity;
          const newStock = prevStock - qty;
          item.stockQuantity = newStock;
          item.updatedAt = nowIso;

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

        set({
          vouchers: [newVoucher, ...state.vouchers],
          logs: [...newLogs, ...state.logs],
          items: updatedItemsList,
        });

        saveVoucherToSQLServer(get().sqlServerConfig, newVoucher, newLogs, updatedItemsList);

        return { success: true, message: `Lưu phiếu xuất kho thành công: ${voucherCode}`, voucher: newVoucher };
      },

      deleteVoucher: (id) => {
        set((state) => ({
          vouchers: state.vouchers.filter((v) => v.id !== id),
        }));
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
