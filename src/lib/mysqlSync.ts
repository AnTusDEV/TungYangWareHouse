import { Item, Category, Warehouse, Unit, StockVoucher, InventoryLog } from '../types/inventory';
import { User } from '../types/auth';

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

export const DEFAULT_MYSQL_CONFIG: MySQLConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'inventory_db',
  ssl: false,
};

const CONFIG_STORAGE_KEY = 'inventory_mysql_config';

export function getStoredMySQLConfig(): MySQLConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_MYSQL_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to parse saved MySQL config', e);
  }
  return DEFAULT_MYSQL_CONFIG;
}

export function saveStoredMySQLConfig(config: MySQLConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save MySQL config', e);
  }
}

export interface MySQLSyncResult {
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

export async function testMySQLConnection(config: MySQLConfig): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/mysql/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Kết nối MySQL thất bại' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi mạng khi kết nối tới server' };
  }
}

export async function initMySQLTables(config: MySQLConfig): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/mysql/init-tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Khởi tạo bảng MySQL thất bại' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi mạng khi kết nối tới server' };
  }
}

export async function fetchAllFromMySQL(config: MySQLConfig): Promise<MySQLSyncResult> {
  try {
    const res = await fetch('/api/mysql/fetch-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Tải dữ liệu từ MySQL thất bại' };
    }

    const items: Item[] = (data.items || []).map((row: any) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      categoryId: String(row.category_id || ''),
      categoryName: String(row.category_name || ''),
      unitId: String(row.unit_id || ''),
      unitName: String(row.unit_name || ''),
      warehouseId: String(row.warehouse_id || ''),
      warehouseName: String(row.warehouse_name || ''),
      stockQuantity: Number(row.stock_quantity) || 0,
      minStockLevel: Number(row.min_stock_level) || 0,
      maxStockLevel: Number(row.max_stock_level) || 100,
      note: String(row.note || ''),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    }));

    const categories: Category[] = (data.categories || []).map((row: any) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
    }));

    const warehouses: Warehouse[] = (data.warehouses || []).map((row: any) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      location: String(row.location || ''),
      manager: String(row.manager || ''),
      description: String(row.description || ''),
      isDefault: Boolean(row.is_default),
    }));

    const units: Unit[] = (data.units || []).map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description || ''),
    }));

    const voucherItemsData = data.voucherItems || [];
    const vouchers: StockVoucher[] = (data.vouchers || []).map((row: any) => {
      const lineItems = voucherItemsData
        .filter((vi: any) => String(vi.voucher_id) === String(row.id))
        .map((vi: any) => ({
          itemId: String(vi.item_id),
          itemCode: String(vi.item_code || ''),
          itemName: String(vi.item_name || ''),
          unitName: String(vi.unit_name || ''),
          quantity: Number(vi.quantity) || 0,
          currentStock: Number(vi.current_stock) || 0,
        }));

      return {
        id: String(row.id),
        code: String(row.code),
        type: row.type as 'IN' | 'OUT',
        date: String(row.date),
        person: String(row.person || ''),
        department: row.department ? String(row.department) : undefined,
        warehouseId: String(row.warehouse_id || ''),
        warehouseName: String(row.warehouse_name || ''),
        note: row.note ? String(row.note) : undefined,
        items: lineItems,
        totalQuantity: Number(row.total_quantity) || 0,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      };
    });

    const logs: InventoryLog[] = (data.logs || []).map((row: any) => ({
      id: String(row.id),
      voucherId: String(row.voucher_id),
      voucherCode: String(row.voucher_code),
      type: row.type as 'IN' | 'OUT',
      date: String(row.date),
      itemId: String(row.item_id),
      itemCode: String(row.item_code || ''),
      itemName: String(row.item_name || ''),
      categoryName: String(row.category_name || ''),
      warehouseId: String(row.warehouse_id || ''),
      warehouseName: String(row.warehouse_name || ''),
      quantity: Number(row.quantity) || 0,
      previousStock: Number(row.previous_stock) || 0,
      newStock: Number(row.new_stock) || 0,
      person: String(row.person || ''),
      department: row.department ? String(row.department) : undefined,
      note: String(row.note || ''),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    }));

    const users: User[] = (data.users || []).map((row: any) => {
      const getProp = (candidates: string[], fallback = '') => {
        for (const c of candidates) {
          if (row[c] !== undefined && row[c] !== null) return String(row[c]);
          const keyInsensitive = Object.keys(row).find((k) => k.toLowerCase() === c.toLowerCase());
          if (keyInsensitive && row[keyInsensitive] !== undefined && row[keyInsensitive] !== null) {
            return String(row[keyInsensitive]);
          }
        }
        return fallback;
      };

      const id = getProp(['id', 'userId', 'user_id', 'usr_id'], 'usr_' + Math.random().toString(36).substring(2, 6));
      const username = getProp(['username', 'userName', 'user_name'], 'user');
      const fullName = getProp(['fullName', 'full_name', 'name', 'ten_nguoi_dung'], username);
      const position = getProp(['position', 'chuc_vu', 'chucVu'], '');
      const notes = getProp(['notes', 'ghi_chu', 'ghiChu', 'note'], '');
      const roleRaw = getProp(['role', 'role_name', 'quyen'], 'user').toLowerCase();
      const statusRaw = getProp(['status', 'trang_thai', 'trangThai'], 'active').toLowerCase();
      const createdAt = getProp(['createdAt', 'created_at', 'createdDate', 'created_date'], new Date().toISOString());
      const updatedAt = getProp(['updatedAt', 'updated_at', 'updatedDate'], undefined);

      return {
        id,
        username,
        fullName,
        position,
        notes,
        role: roleRaw === 'admin' ? 'admin' : 'user',
        status: statusRaw === 'locked' ? 'locked' : 'active',
        createdAt,
        updatedAt: updatedAt || undefined,
      };
    });

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
    return { success: false, error: err.message || 'Lỗi kết nối tới MySQL' };
  }
}

export async function saveUserToMySQL(config: MySQLConfig, user: User, passwordHash?: string) {
  try {
    await fetch('/api/mysql/save-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, user, passwordHash }),
    });
  } catch (err) {
    console.error('Error saving user to MySQL:', err);
  }
}

export async function deleteUserFromMySQL(config: MySQLConfig, id: string) {
  try {
    await fetch('/api/mysql/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Error deleting user from MySQL:', err);
  }
}

export async function saveItemToMySQL(config: MySQLConfig, item: Item) {
  try {
    await fetch('/api/mysql/save-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, item }),
    });
  } catch (err) {
    console.error('Error saving item to MySQL:', err);
  }
}

export async function deleteItemFromMySQL(config: MySQLConfig, id: string) {
  try {
    await fetch('/api/mysql/delete-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Error deleting item from MySQL:', err);
  }
}

export async function saveWarehouseToMySQL(config: MySQLConfig, warehouse: Warehouse) {
  try {
    await fetch('/api/mysql/save-warehouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, warehouse }),
    });
  } catch (err) {
    console.error('Error saving warehouse to MySQL:', err);
  }
}

export async function deleteWarehouseFromMySQL(config: MySQLConfig, id: string) {
  try {
    await fetch('/api/mysql/delete-warehouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Error deleting warehouse from MySQL:', err);
  }
}

export async function saveCategoryToMySQL(config: MySQLConfig, category: Category) {
  try {
    await fetch('/api/mysql/save-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, category }),
    });
  } catch (err) {
    console.error('Error saving category to MySQL:', err);
  }
}

export async function deleteCategoryFromMySQL(config: MySQLConfig, id: string) {
  try {
    await fetch('/api/mysql/delete-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Error deleting category from MySQL:', err);
  }
}

export async function saveUnitToMySQL(config: MySQLConfig, unit: Unit) {
  try {
    await fetch('/api/mysql/save-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, unit }),
    });
  } catch (err) {
    console.error('Error saving unit to MySQL:', err);
  }
}

export async function deleteUnitFromMySQL(config: MySQLConfig, id: string) {
  try {
    await fetch('/api/mysql/delete-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, id }),
    });
  } catch (err) {
    console.error('Error deleting unit from MySQL:', err);
  }
}

export async function saveVoucherToMySQL(
  config: MySQLConfig,
  voucher: StockVoucher,
  logs: InventoryLog[],
  updatedItems: Item[]
) {
  try {
    await fetch('/api/mysql/save-voucher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, voucher, logs, updatedItems }),
    });
  } catch (err) {
    console.error('Error saving voucher to MySQL:', err);
  }
}
