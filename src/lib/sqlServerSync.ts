import { Item, Category, Warehouse, Unit, StockVoucher, InventoryLog } from '../types/inventory';
import { User } from '../types/auth';

export interface SQLServerConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  encrypt?: boolean;
}

export const DEFAULT_SQLSERVER_CONFIG: SQLServerConfig = {
  host: 'SERVER_LAN',
  port: 1433,
  user: 'antu',
  password: 'Ty2025@@',
  database: 'inventory_db',
  encrypt: false,
};

const CONFIG_STORAGE_KEY = 'inventory_sqlserver_config';

export function getStoredSQLServerConfig(): SQLServerConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SQLSERVER_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to parse saved SQL Server config', e);
  }
  return DEFAULT_SQLSERVER_CONFIG;
}

export function saveStoredSQLServerConfig(config: SQLServerConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save SQL Server config', e);
  }
}

export interface SQLServerSyncResult {
  success: boolean;
  message?: string;
  error?: string;
  items?: Item[];
  categories?: Category[];
  warehouses?: Warehouse[];
  units?: Unit[];
  vouchers?: StockVoucher[];
  logs?: InventoryLog[];
  users?: User[];
}

export async function testSQLServerConnection(config: SQLServerConfig): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/mssql/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Kết nối SQL Server thất bại' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi mạng khi kết nối tới server' };
  }
}

export async function initSQLServerTables(config: SQLServerConfig): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/mssql/init-tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Khởi tạo bảng SQL Server thất bại' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi mạng khi kết nối tới server' };
  }
}

export async function fetchAllFromSQLServer(config: SQLServerConfig): Promise<SQLServerSyncResult> {
  try {
    const res = await fetch('/api/mssql/fetch-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Tải dữ liệu từ SQL Server thất bại' };
    }

    const items: Item[] = (data.items || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      categoryId: row.category_id || '',
      categoryName: row.category_name || '',
      unitId: row.unit_id || '',
      unitName: row.unit_name || '',
      warehouseId: row.warehouse_id || '',
      warehouseName: row.warehouse_name || '',
      stockQuantity: row.stock_quantity ?? 0,
      minStockLevel: row.min_stock_level ?? 0,
      maxStockLevel: row.max_stock_level ?? 100,
      note: row.note || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const categories: Category[] = (data.categories || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || '',
    }));

    const warehouses: Warehouse[] = (data.warehouses || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      location: row.location || '',
      manager: row.manager || '',
      description: row.description || '',
      isDefault: Boolean(row.is_default),
    }));

    const units: Unit[] = (data.units || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
    }));

    const rawVoucherItemsMap = new Map<string, any[]>();
    (data.voucherItems || []).forEach((row: any) => {
      const list = rawVoucherItemsMap.get(row.voucher_id) || [];
      list.push({
        itemId: row.item_id,
        itemCode: row.item_code,
        itemName: row.item_name,
        unitName: row.unit_name,
        quantity: row.quantity,
        currentStock: row.current_stock,
      });
      rawVoucherItemsMap.set(row.voucher_id, list);
    });

    const vouchers: StockVoucher[] = (data.vouchers || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      type: row.type as 'IMPORT' | 'EXPORT',
      date: row.date,
      person: row.person || '',
      department: row.department || '',
      warehouseId: row.warehouse_id || '',
      warehouseName: row.warehouse_name || '',
      note: row.note || '',
      items: rawVoucherItemsMap.get(row.id) || [],
      totalQuantity: row.total_quantity || 0,
      createdAt: row.created_at,
    }));

    const logs: InventoryLog[] = (data.logs || []).map((row: any) => ({
      id: row.id,
      voucherId: row.voucher_id,
      voucherCode: row.voucher_code,
      type: row.type as 'IMPORT' | 'EXPORT',
      date: row.date,
      itemId: row.item_id,
      itemCode: row.item_code,
      itemName: row.item_name,
      categoryName: row.category_name || '',
      warehouseId: row.warehouse_id || '',
      warehouseName: row.warehouse_name || '',
      quantity: row.quantity,
      previousStock: row.previous_stock,
      newStock: row.new_stock,
      person: row.person || '',
      department: row.department || '',
      note: row.note || '',
      createdAt: row.created_at,
    }));

    const users: User[] = (data.users || []).map((row: any) => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name || row.fullName || '',
      position: row.position || '',
      notes: row.notes || '',
      role: row.role as 'admin' | 'user',
      status: row.status as 'active' | 'locked',
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt,
    }));

    return {
      success: true,
      items,
      categories,
      warehouses,
      units,
      vouchers,
      logs,
      users,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi mạng khi tải dữ liệu' };
  }
}

export async function saveUserToSQLServer(config: SQLServerConfig, user: User, passwordHash?: string) {
  try {
    await fetch('/api/mssql/save-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, user, passwordHash }),
    });
  } catch (err) {
    console.error('Failed to sync user to SQL Server', err);
  }
}

export async function deleteUserFromSQLServer(config: SQLServerConfig, id: string) {
  try {
    await fetch('/api/mssql/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Failed to delete user from SQL Server', err);
  }
}

export async function saveItemToSQLServer(config: SQLServerConfig, item: Item) {
  try {
    await fetch('/api/mssql/save-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, item }),
    });
  } catch (err) {
    console.error('Failed to sync item to SQL Server', err);
  }
}

export async function deleteItemFromSQLServer(config: SQLServerConfig, id: string) {
  try {
    await fetch('/api/mssql/delete-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Failed to delete item from SQL Server', err);
  }
}

export async function saveWarehouseToSQLServer(config: SQLServerConfig, warehouse: Warehouse) {
  try {
    await fetch('/api/mssql/save-warehouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, warehouse }),
    });
  } catch (err) {
    console.error('Failed to sync warehouse to SQL Server', err);
  }
}

export async function deleteWarehouseFromSQLServer(config: SQLServerConfig, id: string) {
  try {
    await fetch('/api/mssql/delete-warehouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Failed to delete warehouse from SQL Server', err);
  }
}

export async function saveCategoryToSQLServer(config: SQLServerConfig, category: Category) {
  try {
    await fetch('/api/mssql/save-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, category }),
    });
  } catch (err) {
    console.error('Failed to sync category to SQL Server', err);
  }
}

export async function deleteCategoryFromSQLServer(config: SQLServerConfig, id: string) {
  try {
    await fetch('/api/mssql/delete-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Failed to delete category from SQL Server', err);
  }
}

export async function saveUnitToSQLServer(config: SQLServerConfig, unit: Unit) {
  try {
    await fetch('/api/mssql/save-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, unit }),
    });
  } catch (err) {
    console.error('Failed to sync unit to SQL Server', err);
  }
}

export async function deleteUnitFromSQLServer(config: SQLServerConfig, id: string) {
  try {
    await fetch('/api/mssql/delete-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Failed to delete unit from SQL Server', err);
  }
}

export async function saveVoucherToSQLServer(
  config: SQLServerConfig,
  voucher: StockVoucher,
  logs: InventoryLog[],
  updatedItems: Item[]
) {
  try {
    await fetch('/api/mssql/save-voucher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, voucher, logs, updatedItems }),
    });
  } catch (err) {
    console.error('Failed to sync voucher to SQL Server', err);
  }
}
