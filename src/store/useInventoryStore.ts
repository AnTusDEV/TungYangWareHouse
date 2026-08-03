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
import {
  generateItemCode,
  generateVoucherCode,
} from '../lib/formatters';
import {
  fetchAllFromSupabase,
  saveItemToSupabase,
  deleteItemFromSupabase,
  saveWarehouseToSupabase,
  deleteWarehouseFromSupabase,
  saveCategoryToSupabase,
  deleteCategoryFromSupabase,
  saveUnitToSupabase,
  deleteUnitFromSupabase,
  saveVoucherToSupabase,
} from '../lib/supabaseSync';
import {
  MySQLConfig,
  DEFAULT_MYSQL_CONFIG,
  getStoredMySQLConfig,
  saveStoredMySQLConfig,
  testMySQLConnection,
  initMySQLTables,
  fetchAllFromMySQL,
  saveItemToMySQL,
  deleteItemFromMySQL,
  saveWarehouseToMySQL,
  deleteWarehouseFromMySQL,
  saveCategoryToMySQL,
  deleteCategoryFromMySQL,
  saveUnitToMySQL,
  deleteUnitFromMySQL,
  saveVoucherToMySQL,
} from '../lib/mysqlSync';
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

  // MySQL State
  mysqlConfig: MySQLConfig;
  setMysqlConfig: (config: MySQLConfig) => void;
  isLoadingFromMySQL: boolean;
  isMySQLConnected: boolean;
  mysqlError: string | null;
  fetchFromMySQL: () => Promise<void>;
  testMySQLConfig: (config?: MySQLConfig) => Promise<{ success: boolean; message: string }>;
  initMySQLDb: (config?: MySQLConfig) => Promise<{ success: boolean; message: string }>;

  // Password Lock State for Settings
  adminPassword: string;
  isSettingsUnlocked: boolean;
  verifySettingsPassword: (password: string) => boolean;
  changeAdminPassword: (oldPass: string, newPass: string) => { success: boolean; message: string };
  lockSettings: () => void;

  // Supabase State
  isLoadingFromSupabase: boolean;
  isSupabaseConnected: boolean;
  supabaseError: string | null;
  fetchFromSupabase: () => Promise<void>;

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

  // Actions - Vouchers (Inbound / Outbound)
  createStockInVoucher: (data: {
    date: string;
    person: string;
    warehouseId: string;
    note?: string;
    items: { itemId: string; quantity: number }[];
  }) => { success: boolean; message: string; voucher?: StockVoucher };

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
  resetToMockData: () => void;
  clearAllDemoData: () => void;
}

// Initial Default Mock Data
const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-1',
    code: 'KHO1',
    name: 'Kho 1',
    location: 'Tầng 2 - Phòng 204, Tòa nhà A',
    manager: 'Nguyễn Văn Tuấn',
    description: 'Kho lưu trữ văn phòng phẩm, sổ sách và thiết bị dùng chung',
    isDefault: true,
  },
  {
    id: 'wh-2',
    code: 'KHO2',
    name: 'Kho 2',
    location: 'Tầng 5 - Phòng 502, Tòa nhà A',
    manager: 'Lê Thị Hà',
    description: 'Kho vật tư sinh hoạt, bảo hộ lao động và vệ sinh công nghiệp',
    isDefault: false,
  },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', code: 'NH01', name: 'Sổ sách & Giấy in', description: 'Giấy in A4/A3, sổ công tác, bìa trình ký, cặp hồ sơ' },
  { id: 'cat-2', code: 'NH02', name: 'Đồ dùng sinh hoạt', description: 'Nước uống, trà, cà phê, nước rửa tay, giấy ăn, hóa chất vệ sinh' },
  { id: 'cat-3', code: 'NH03', name: 'Đồ dùng bảo hộ', description: 'Khẩu trang, găng tay, mũ bảo hộ, nước xịt khuẩn, tủ y tế' },
  { id: 'cat-4', code: 'NH04', name: 'Thiết bị & Linh kiện VP', description: 'Bút ký, chuột máy tính, pin, ổ cắm, mực in, bảng viết' },
];

const INITIAL_UNITS: Unit[] = [
  { id: 'u-1', name: 'Quyển', description: 'Dùng cho sổ tay, sổ kế toán' },
  { id: 'u-2', name: 'Cuốn', description: 'Dùng cho tạp chí, tài liệu' },
  { id: 'u-3', name: 'Cái', description: 'Dùng cho thiết bị, công cụ' },
  { id: 'u-4', name: 'Hộp', description: 'Dùng cho găng tay, bút, khẩu trang' },
  { id: 'u-5', name: 'Bộ', description: 'Dùng cho bộ dụng cụ' },
  { id: 'u-6', name: 'Chiếc', description: 'Dùng cho đồ dùng lẻ' },
  { id: 'u-7', name: 'Đôi', description: 'Dùng cho găng tay, giày' },
  { id: 'u-8', name: 'Gói', description: 'Dùng cho giấy ăn, trà, cà phê' },
  { id: 'u-9', name: 'Kg', description: 'Khối lượng' },
  { id: 'u-10', name: 'Mét', description: 'Chiều dài' },
  { id: 'u-11', name: 'Thùng', description: 'Quy cách đóng gói lớn' },
  { id: 'u-12', name: 'Bao', description: 'Đóng gói bao bì' },
  { id: 'u-13', name: 'Chai', description: 'Dùng cho hóa chất, chất lỏng' },
  { id: 'u-14', name: 'Ram', description: 'Dùng cho giấy in (500 tờ)' },
  { id: 'u-15', name: 'Cuộn', description: 'Dùng cho băng dính, giấy in nhiệt' },
];

const INITIAL_ITEMS: Item[] = [
  {
    id: 'item-1',
    code: 'HH0001',
    name: 'Sổ tay A5 bìa da cao cấp',
    categoryId: 'cat-1',
    categoryName: 'Sổ sách & Giấy in',
    unitId: 'u-1',
    unitName: 'Quyển',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    stockQuantity: 85,
    minStockLevel: 20,
    maxStockLevel: 150,
    note: 'Sổ bìa da công tác năm 2026',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-07-20T10:15:00Z',
  },
  {
    id: 'item-2',
    code: 'HH0002',
    name: 'Giấy in A4 Double A 70gsm',
    categoryId: 'cat-1',
    categoryName: 'Sổ sách & Giấy in',
    unitId: 'u-14',
    unitName: 'Ram',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    stockQuantity: 12, // LOW STOCK
    minStockLevel: 30,
    maxStockLevel: 200,
    note: 'Dùng cho các phòng ban in ấn tài liệu',
    createdAt: '2026-06-01T08:30:00Z',
    updatedAt: '2026-07-28T14:20:00Z',
  },
  {
    id: 'item-3',
    code: 'HH0003',
    name: 'Bút dạ bảng Thiên Long WB-03',
    categoryId: 'cat-1',
    categoryName: 'Sổ sách & Giấy in',
    unitId: 'u-4',
    unitName: 'Hộp',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    stockQuantity: 42,
    minStockLevel: 10,
    maxStockLevel: 80,
    note: 'Màu xanh & đen',
    createdAt: '2026-06-05T09:00:00Z',
    updatedAt: '2026-07-22T11:00:00Z',
  },
  {
    id: 'item-4',
    code: 'HH0004',
    name: 'Nước rửa tay Lifebuoy 500ml',
    categoryId: 'cat-2',
    categoryName: 'Đồ dùng sinh hoạt',
    unitId: 'u-13',
    unitName: 'Chai',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    stockQuantity: 6, // LOW STOCK
    minStockLevel: 15,
    maxStockLevel: 60,
    note: 'Đặt tại khu vực vệ sinh & bếp tầng 2, 3, 5',
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-07-25T16:30:00Z',
  },
  {
    id: 'item-5',
    code: 'HH0005',
    name: 'Khẩu trang y tế 4 lớp 3M',
    categoryId: 'cat-3',
    categoryName: 'Đồ dùng bảo hộ',
    unitId: 'u-4',
    unitName: 'Hộp',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    stockQuantity: 110,
    minStockLevel: 25,
    maxStockLevel: 200,
    note: 'Hộp 50 chiếc',
    createdAt: '2026-06-12T11:00:00Z',
    updatedAt: '2026-07-15T09:10:00Z',
  },
  {
    id: 'item-6',
    code: 'HH0006',
    name: 'Mũ bảo hộ lao động Thùy Dương',
    categoryId: 'cat-3',
    categoryName: 'Đồ dùng bảo hộ',
    unitId: 'u-3',
    unitName: 'Cái',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    stockQuantity: 0, // OUT OF STOCK
    minStockLevel: 10,
    maxStockLevel: 50,
    note: 'Cần nhập bổ sung gấp cho đội kỹ thuật',
    createdAt: '2026-06-15T13:20:00Z',
    updatedAt: '2026-07-29T08:00:00Z',
  },
  {
    id: 'item-7',
    code: 'HH0007',
    name: 'Găng tay cao su y tế chống nước',
    categoryId: 'cat-3',
    categoryName: 'Đồ dùng bảo hộ',
    unitId: 'u-7',
    unitName: 'Đôi',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    stockQuantity: 280, // HIGH STOCK
    minStockLevel: 50,
    maxStockLevel: 200,
    note: 'Găng tay chống hóa chất lau dọn',
    createdAt: '2026-06-18T14:00:00Z',
    updatedAt: '2026-07-10T15:45:00Z',
  },
  {
    id: 'item-8',
    code: 'HH0008',
    name: 'Bút ký kim loại cao cấp Parker',
    categoryId: 'cat-4',
    categoryName: 'Thiết bị & Linh kiện VP',
    unitId: 'u-6',
    unitName: 'Chiếc',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    stockQuantity: 4, // LOW STOCK
    minStockLevel: 10,
    maxStockLevel: 30,
    note: 'Dùng cho Ban Giám đốc & Tiếp khách VIP',
    createdAt: '2026-06-20T15:00:00Z',
    updatedAt: '2026-07-27T10:00:00Z',
  },
  {
    id: 'item-9',
    code: 'HH0009',
    name: 'Pin AA Panasonic Hi-Top 24 viên',
    categoryId: 'cat-4',
    categoryName: 'Thiết bị & Linh kiện VP',
    unitId: 'u-4',
    unitName: 'Hộp',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    stockQuantity: 22,
    minStockLevel: 5,
    maxStockLevel: 40,
    note: 'Dùng cho chuột không dây, đồng hồ, điều hòa',
    createdAt: '2026-06-22T09:30:00Z',
    updatedAt: '2026-07-18T16:00:00Z',
  },
  {
    id: 'item-10',
    code: 'HH0010',
    name: 'Khăn giấy ăn Napkin Pulppy',
    categoryId: 'cat-2',
    categoryName: 'Đồ dùng sinh hoạt',
    unitId: 'u-8',
    unitName: 'Gói',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    stockQuantity: 95,
    minStockLevel: 20,
    maxStockLevel: 150,
    note: 'Giấy lau phòng họp & căn tin',
    createdAt: '2026-06-25T10:10:00Z',
    updatedAt: '2026-07-26T11:20:00Z',
  },
  {
    id: 'item-11',
    code: 'HH0011',
    name: 'Băng dính trong 5cm x 100m',
    categoryId: 'cat-1',
    categoryName: 'Sổ sách & Giấy in',
    unitId: 'u-15',
    unitName: 'Cuộn',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    stockQuantity: 38,
    minStockLevel: 10,
    maxStockLevel: 60,
    note: 'Đóng gói bưu phẩm & tài liệu gửi đi',
    createdAt: '2026-06-28T11:40:00Z',
    updatedAt: '2026-07-21T09:30:00Z',
  },
  {
    id: 'item-12',
    code: 'HH0012',
    name: 'Bình xịt khử khuẩn không khí Cloramin B',
    categoryId: 'cat-2',
    categoryName: 'Đồ dùng sinh hoạt',
    unitId: 'u-13',
    unitName: 'Chai',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    stockQuantity: 3, // LOW STOCK
    minStockLevel: 8,
    maxStockLevel: 30,
    note: 'Khử khuẩn định kỳ văn phòng',
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-28T17:00:00Z',
  },
];

const INITIAL_VOUCHERS: StockVoucher[] = [
  {
    id: 'v-in-1',
    code: 'PN202607001',
    type: 'IN',
    date: '2026-07-05',
    person: 'Nguyễn Văn Tuấn',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    note: 'Nhập văn phòng phẩm đợt 1 tháng 7',
    totalQuantity: 100,
    items: [
      { itemId: 'item-1', itemCode: 'HH0001', itemName: 'Sổ tay A5 bìa da cao cấp', unitName: 'Quyển', quantity: 50 },
      { itemId: 'item-2', itemCode: 'HH0002', itemName: 'Giấy in A4 Double A 70gsm', unitName: 'Ram', quantity: 50 },
    ],
    createdAt: '2026-07-05T09:00:00Z',
  },
  {
    id: 'v-in-2',
    code: 'PN202607002',
    type: 'IN',
    date: '2026-07-12',
    person: 'Lê Thị Hà',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    note: 'Nhập vật tư bảo hộ đợt tháng 7',
    totalQuantity: 200,
    items: [
      { itemId: 'item-5', itemCode: 'HH0005', itemName: 'Khẩu trang y tế 4 lớp 3M', unitName: 'Hộp', quantity: 100 },
      { itemId: 'item-7', itemCode: 'HH0007', itemName: 'Găng tay cao su y tế chống nước', unitName: 'Đôi', quantity: 100 },
    ],
    createdAt: '2026-07-12T10:30:00Z',
  },
  {
    id: 'v-out-1',
    code: 'PX202607001',
    type: 'OUT',
    date: '2026-07-20',
    person: 'Trần Thị Mai',
    department: 'Phòng Hành chính Nhân sự',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    note: 'Cấp phát văn phòng phẩm tháng 7',
    totalQuantity: 48,
    items: [
      { itemId: 'item-1', itemCode: 'HH0001', itemName: 'Sổ tay A5 bìa da cao cấp', unitName: 'Quyển', quantity: 10 },
      { itemId: 'item-2', itemCode: 'HH0002', itemName: 'Giấy in A4 Double A 70gsm', unitName: 'Ram', quantity: 38 },
    ],
    createdAt: '2026-07-20T14:00:00Z',
  },
  {
    id: 'v-out-2',
    code: 'PX202607002',
    type: 'OUT',
    date: '2026-07-25',
    person: 'Phạm Minh Đức',
    department: 'Phòng Kỹ thuật Công nghệ',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    note: 'Xuất dùng khử khuẩn và bảo hộ định kỳ',
    totalQuantity: 15,
    items: [
      { itemId: 'item-4', itemCode: 'HH0004', itemName: 'Nước rửa tay Lifebuoy 500ml', unitName: 'Chai', quantity: 10 },
      { itemId: 'item-12', itemCode: 'HH0012', itemName: 'Bình xịt khử khuẩn không khí Cloramin B', unitName: 'Chai', quantity: 5 },
    ],
    createdAt: '2026-07-25T16:00:00Z',
  },
];

const INITIAL_LOGS: InventoryLog[] = [
  {
    id: 'log-1',
    voucherId: 'v-in-1',
    voucherCode: 'PN202607001',
    type: 'IN',
    date: '2026-07-05',
    itemId: 'item-1',
    itemCode: 'HH0001',
    itemName: 'Sổ tay A5 bìa da cao cấp',
    categoryName: 'Sổ sách & Giấy in',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    quantity: 50,
    previousStock: 45,
    newStock: 95,
    person: 'Nguyễn Văn Tuấn',
    note: 'Nhập đợt 1 tháng 7',
  },
  {
    id: 'log-2',
    voucherId: 'v-in-1',
    voucherCode: 'PN202607001',
    type: 'IN',
    date: '2026-07-05',
    itemId: 'item-2',
    itemCode: 'HH0002',
    itemName: 'Giấy in A4 Double A 70gsm',
    categoryName: 'Sổ sách & Giấy in',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    quantity: 50,
    previousStock: 0,
    newStock: 50,
    person: 'Nguyễn Văn Tuấn',
    note: 'Nhập đợt 1 tháng 7',
  },
  {
    id: 'log-3',
    voucherId: 'v-out-1',
    voucherCode: 'PX202607001',
    type: 'OUT',
    date: '2026-07-20',
    itemId: 'item-1',
    itemCode: 'HH0001',
    itemName: 'Sổ tay A5 bìa da cao cấp',
    categoryName: 'Sổ sách & Giấy in',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    quantity: 10,
    previousStock: 95,
    newStock: 85,
    person: 'Trần Thị Mai',
    department: 'Phòng Hành chính Nhân sự',
    note: 'Cấp phát tháng 7',
  },
  {
    id: 'log-4',
    voucherId: 'v-out-1',
    voucherCode: 'PX202607001',
    type: 'OUT',
    date: '2026-07-20',
    itemId: 'item-2',
    itemCode: 'HH0002',
    itemName: 'Giấy in A4 Double A 70gsm',
    categoryName: 'Sổ sách & Giấy in',
    warehouseId: 'wh-1',
    warehouseName: 'Kho 1',
    quantity: 38,
    previousStock: 50,
    newStock: 12,
    person: 'Trần Thị Mai',
    department: 'Phòng Hành chính Nhân sự',
    note: 'Cấp phát in ấn ấn phẩm',
  },
  {
    id: 'log-5',
    voucherId: 'v-out-2',
    voucherCode: 'PX202607002',
    type: 'OUT',
    date: '2026-07-25',
    itemId: 'item-4',
    itemCode: 'HH0004',
    itemName: 'Nước rửa tay Lifebuoy 500ml',
    categoryName: 'Đồ dùng sinh hoạt',
    warehouseId: 'wh-2',
    warehouseName: 'Kho 2',
    quantity: 10,
    previousStock: 16,
    newStock: 6,
    person: 'Phạm Minh Đức',
    department: 'Phòng Kỹ thuật Công nghệ',
    note: 'Dùng xà phòng lau dọn phòng máy',
  },
];

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
          set({
            items: res.items || [],
            categories: res.categories || [],
            warehouses: res.warehouses || [],
            units: res.units || [],
            vouchers: res.vouchers || [],
            logs: res.logs || [],
            isSQLServerConnected: true,
            isLoadingFromSQLServer: false,
          });
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

      // MySQL State & Actions
      mysqlConfig: getStoredMySQLConfig(),
      setMysqlConfig: (config) => {
        saveStoredMySQLConfig(config);
        set({ mysqlConfig: config });
      },
      isLoadingFromMySQL: false,
      isMySQLConnected: false,
      mysqlError: null,

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

      fetchFromMySQL: async () => {
        set({ isLoadingFromMySQL: true, mysqlError: null });
        const config = get().mysqlConfig;
        const res = await fetchAllFromMySQL(config);
        if (res.success) {
          set({
            items: res.items || [],
            categories: res.categories || [],
            warehouses: res.warehouses || [],
            units: res.units || [],
            vouchers: res.vouchers || [],
            logs: res.logs || [],
            isMySQLConnected: true,
            isLoadingFromMySQL: false,
          });
        } else {
          set({
            mysqlError: res.error || 'Không thể tải dữ liệu từ MySQL',
            isMySQLConnected: false,
            isLoadingFromMySQL: false,
          });
        }
      },

      testMySQLConfig: async (cfg) => {
        const configToTest = cfg || get().mysqlConfig;
        const result = await testMySQLConnection(configToTest);
        if (result.success) {
          set({ isMySQLConnected: true, mysqlError: null });
        } else {
          set({ isMySQLConnected: false, mysqlError: result.message });
        }
        return result;
      },

      initMySQLDb: async (cfg) => {
        const configToInit = cfg || get().mysqlConfig;
        const result = await initMySQLTables(configToInit);
        if (result.success) {
          set({ isMySQLConnected: true, mysqlError: null });
        }
        return result;
      },

      // Supabase State & Action
      isLoadingFromSupabase: false,
      isSupabaseConnected: false,
      supabaseError: null,

      fetchFromSupabase: async () => {
        set({ isLoadingFromSupabase: true, supabaseError: null });
        const res = await fetchAllFromSupabase();
        if (res.success) {
          set({
            items: res.items || [],
            categories: res.categories && res.categories.length > 0 ? res.categories : get().categories,
            warehouses: res.warehouses && res.warehouses.length > 0 ? res.warehouses : get().warehouses,
            units: res.units && res.units.length > 0 ? res.units : get().units,
            vouchers: res.vouchers || [],
            logs: res.logs || [],
            isSupabaseConnected: true,
            isLoadingFromSupabase: false,
          });
        } else {
          set({
            supabaseError: res.error || 'Failed to fetch from Supabase',
            isSupabaseConnected: false,
            isLoadingFromSupabase: false,
          });
        }
      },

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
        saveWarehouseToSupabase(newWh);
        saveWarehouseToMySQL(get().mysqlConfig, newWh);
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
            saveWarehouseToSupabase(target);
            saveWarehouseToMySQL(get().mysqlConfig, target);
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
        deleteWarehouseFromSupabase(id);
        deleteWarehouseFromMySQL(get().mysqlConfig, id);
        deleteWarehouseFromSQLServer(get().sqlServerConfig, id);
        return true;
      },

      // Categories
      addCategory: (catData) => {
        const id = `cat-${Date.now()}`;
        const newCat: Category = { ...catData, id };
        set((state) => ({ categories: [...state.categories, newCat] }));
        saveCategoryToSupabase(newCat);
        saveCategoryToMySQL(get().mysqlConfig, newCat);
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
            saveCategoryToSupabase(target);
            saveCategoryToMySQL(get().mysqlConfig, target);
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
        deleteCategoryFromSupabase(id);
        deleteCategoryFromMySQL(get().mysqlConfig, id);
        deleteCategoryFromSQLServer(get().sqlServerConfig, id);
        return true;
      },

      // Units
      addUnit: (unitData) => {
        const id = `u-${Date.now()}`;
        const newUnit: Unit = { ...unitData, id };
        set((state) => ({ units: [...state.units, newUnit] }));
        saveUnitToSupabase(newUnit);
        saveUnitToMySQL(get().mysqlConfig, newUnit);
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
            saveUnitToSupabase(target);
            saveUnitToMySQL(get().mysqlConfig, target);
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
        deleteUnitFromSupabase(id);
        deleteUnitFromMySQL(get().mysqlConfig, id);
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
        saveItemToSupabase(newItem);
        saveItemToMySQL(get().mysqlConfig, newItem);
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
          saveItemToSupabase(updatedItem);
          saveItemToMySQL(get().mysqlConfig, updatedItem);
          saveItemToSQLServer(get().sqlServerConfig, updatedItem);
        }
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
        deleteItemFromSupabase(id);
        deleteItemFromMySQL(get().mysqlConfig, id);
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
            saveCategoryToSupabase(cat);
            saveCategoryToMySQL(state.mysqlConfig, cat);
          }
          let catId = cat ? cat.id : currentCategories[0]?.id || 'cat-1';
          let catName = cat ? cat.name : currentCategories[0]?.name || 'Văn phòng phẩm';

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
            saveUnitToSupabase(unit);
            saveUnitToMySQL(state.mysqlConfig, unit);
          }
          let unitId = unit ? unit.id : currentUnits[0]?.id || 'u-3';
          let unitName = unit ? unit.name : currentUnits[0]?.name || 'Cái';

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
            saveWarehouseToSupabase(wh);
            saveWarehouseToMySQL(state.mysqlConfig, wh);
          }
          let whId = wh ? wh.id : currentWarehouses[0]?.id || 'wh-1';
          let whName = wh ? wh.name : currentWarehouses[0]?.name || 'Kho 1';

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

          // Save item to DB (Supabase, MySQL & SQL Server)
          saveItemToSupabase(newItem);
          saveItemToMySQL(state.mysqlConfig, newItem);
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

        saveVoucherToSupabase(newVoucher, newLogs, updatedItemsList);
        saveVoucherToMySQL(get().mysqlConfig, newVoucher, newLogs, updatedItemsList);
        saveVoucherToSQLServer(get().sqlServerConfig, newVoucher, newLogs, updatedItemsList);

        return { success: true, message: `Lưu phiếu nhập kho thành công: ${voucherCode}`, voucher: newVoucher };
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

        saveVoucherToSupabase(newVoucher, newLogs, updatedItemsList);
        saveVoucherToMySQL(get().mysqlConfig, newVoucher, newLogs, updatedItemsList);
        saveVoucherToSQLServer(get().sqlServerConfig, newVoucher, newLogs, updatedItemsList);

        return { success: true, message: `Lưu phiếu xuất kho thành công: ${voucherCode}`, voucher: newVoucher };
      },

      deleteVoucher: (id) => {
        set((state) => ({
          vouchers: state.vouchers.filter((v) => v.id !== id),
        }));
      },

      resetToMockData: () => {
        set({
          warehouses: INITIAL_WAREHOUSES,
          categories: INITIAL_CATEGORIES,
          units: INITIAL_UNITS,
          items: INITIAL_ITEMS,
          vouchers: INITIAL_VOUCHERS,
          logs: INITIAL_LOGS,
        });
      },

      clearAllDemoData: () => {
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
