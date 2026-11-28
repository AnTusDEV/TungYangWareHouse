import { Item, Category, Warehouse, Unit, StockVoucher, InventoryLog } from '../types/inventory';
import { User } from '../types/auth';

export interface SQLServerConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  encrypt?: boolean;
  isCustom?: boolean;
}

export const DEFAULT_SQLSERVER_CONFIG: SQLServerConfig = {
  host: 'SERVER_LAN',
  port: 1433,
  user: 'antu',
  password: 'Ty2025@@',
  database: 'inventory_db_test',
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

export function hasCustomSQLServerConfig(): boolean {
  try {
    return Boolean(localStorage.getItem(CONFIG_STORAGE_KEY));
  } catch {
    return false;
  }
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

function withConfigMeta(config: SQLServerConfig): SQLServerConfig {
  return {
    ...config,
    isCustom: config?.isCustom !== undefined ? config.isCustom : hasCustomSQLServerConfig(),
  };
}

export async function fetchAllFromSQLServer(config: SQLServerConfig): Promise<SQLServerSyncResult> {
  try {
    const effectiveConfig = withConfigMeta(config);
    const res = await fetch('/api/mssql/fetch-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(effectiveConfig),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.message || 'Tải dữ liệu từ SQL Server thất bại' };
    }

    const items: Item[] = (data.items || []).map((row: any) => ({
      id: String(row.id || '').trim(),
      code: String(row.code || '').trim(),
      name: String(row.name || ''),
      categoryId: String(row.category_id || '').trim(),
      categoryName: String(row.category_name || ''),
      unitId: String(row.unit_id || '').trim(),
      unitName: String(row.unit_name || ''),
      warehouseId: String(row.warehouse_id || '').trim(),
      warehouseName: String(row.warehouse_name || ''),
      stockQuantity: Number(row.stock_quantity) || 0,
      minStockLevel: Number(row.min_stock_level) || 0,
      maxStockLevel: Number(row.max_stock_level) || 100,
      note: String(row.note || ''),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    }));

    const itemById = new Map<string, Item>(items.map((it) => [it.id, it]));
    const itemByCode = new Map<string, Item>(items.map((it) => [it.code, it]));

    const categories: Category[] = (data.categories || []).map((row: any) => ({
      id: String(row.id || '').trim(),
      code: String(row.code || '').trim(),
      name: String(row.name || ''),
      description: String(row.description || ''),
    }));

    const warehouses: Warehouse[] = (data.warehouses || []).map((row: any) => ({
      id: String(row.id || '').trim(),
      code: String(row.code || '').trim(),
      name: String(row.name || ''),
      location: String(row.location || ''),
      manager: String(row.manager || ''),
      description: String(row.description || ''),
      isDefault: Boolean(row.is_default),
    }));

    const units: Unit[] = (data.units || []).map((row: any) => ({
      id: String(row.id || '').trim(),
      name: String(row.name || ''),
      description: String(row.description || ''),
    }));

    const logs: InventoryLog[] = (data.logs || []).map((row: any) => ({
      id: String(row.id || '').trim(),
      voucherId: String(row.voucher_id || '').trim(),
      voucherCode: String(row.voucher_code || '').trim(),
      type: row.type === 'OUT' ? 'OUT' : 'IN',
      date: String(row.date || ''),
      itemId: String(row.item_id || '').trim(),
      itemCode: String(row.item_code || '').trim(),
      itemName: String(row.item_name || ''),
      categoryName: String(row.category_name || ''),
      warehouseId: String(row.warehouse_id || '').trim(),
      warehouseName: String(row.warehouse_name || ''),
      quantity: Number(row.quantity) || 0,
      previousStock: Number(row.previous_stock) || 0,
      newStock: Number(row.new_stock) || 0,
      person: String(row.person || ''),
      department: row.department ? String(row.department) : undefined,
      note: String(row.note || ''),
    }));

    const getRowField = (row: any, candidates: string[], fallback: any = '') => {
      for (const c of candidates) {
        if (row[c] !== undefined && row[c] !== null) return row[c];
        const keyInsensitive = Object.keys(row).find((k) => k.toLowerCase() === c.toLowerCase());
        if (keyInsensitive && row[keyInsensitive] !== undefined && row[keyInsensitive] !== null) {
          return row[keyInsensitive];
        }
      }
      return fallback;
    };

    const rawVoucherItemsMap = new Map<string, any[]>();
    (data.voucherItems || []).forEach((row: any) => {
      const voucherId = String(getRowField(row, ['voucher_id', 'voucherId'], '')).trim();
      if (!voucherId) return;
      const list = rawVoucherItemsMap.get(voucherId) || [];
      list.push({
        itemId: String(getRowField(row, ['item_id', 'itemId'], '')).trim(),
        itemCode: String(getRowField(row, ['item_code', 'itemCode'], '')).trim(),
        itemName: String(getRowField(row, ['item_name', 'itemName'], '')),
        unitName: String(getRowField(row, ['unit_name', 'unitName'], '')),
        quantity: Number(getRowField(row, ['quantity'], 0)) || 0,
        currentStock: Number(getRowField(row, ['current_stock', 'currentStock'], 0)) || 0,
      });
      rawVoucherItemsMap.set(voucherId, list);
    });

    // Track vouchers that needed log-fallback so we can auto-repair them in the DB
    const vouchersNeedingRepair: { voucherId: string; items: any[] }[] = [];

    const vouchers: StockVoucher[] = (data.vouchers || []).map((row: any) => {
      const voucherId = String(row.id || '').trim();
      const voucherCode = String(row.code || '').trim();
      let lineItems = rawVoucherItemsMap.get(voucherId) || [];
      let repairedFromLogs = false;

      // Fallback: reconstruct line items from inventory_logs if stock_voucher_items is empty
      if (lineItems.length === 0) {
        const matchingLogs = logs.filter(
          (l) =>
            (l.voucherId && l.voucherId === voucherId) ||
            (l.voucherCode && voucherCode && l.voucherCode === voucherCode)
        );
        lineItems = matchingLogs.map((l) => {
          const matchedItem = itemById.get(l.itemId) || itemByCode.get(l.itemCode);
          return {
            itemId: l.itemId,
            itemCode: l.itemCode,
            itemName: l.itemName,
            unitName: matchedItem?.unitName || '',
            quantity: l.quantity,
            currentStock: l.newStock,
          };
        });
        if (lineItems.length > 0) {
          repairedFromLogs = true;
        }
      }

      if (repairedFromLogs) {
        vouchersNeedingRepair.push({ voucherId, items: lineItems });
      }

      const computedTotalQty = lineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0), 0);

      return {
        id: voucherId,
        code: voucherCode,
        type: row.type === 'OUT' ? 'OUT' : 'IN',
        date: String(row.date || ''),
        person: String(row.person || ''),
        department: row.department ? String(row.department) : undefined,
        warehouseId: String(row.warehouse_id || '').trim(),
        warehouseName: String(row.warehouse_name || ''),
        note: row.note ? String(row.note) : undefined,
        items: lineItems,
        totalQuantity: Number(row.total_quantity) || computedTotalQty,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      };
    });

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

    // Auto-repair: fire-and-forget INSERT for vouchers whose items were missing
    // from stock_voucher_items but recoverable from inventory_logs.
    // Runs in background — does NOT block the fetch result.
    if (vouchersNeedingRepair.length > 0) {
      vouchersNeedingRepair.forEach(({ voucherId, items: repairItems }) => {
        fetch('/api/mssql/repair-voucher-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: effectiveConfig, voucherId, items: repairItems }),
        }).catch(() => {
          // silent — repair is best-effort, never breaks UI
        });
      });
    }

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

export interface SQLServerActionResult {
  success: boolean;
  message?: string;
  insertedItems?: number;
}

async function postToSQLServer(
  endpoint: string,
  payload: Record<string, unknown>,
  actionLabel: string
): Promise<SQLServerActionResult> {
  try {
    const bodyPayload =
      payload && typeof payload === 'object' && 'config' in payload && payload.config
        ? { ...payload, config: withConfigMeta(payload.config as SQLServerConfig) }
        : payload;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      const msg = data?.message || res.statusText || 'Lỗi lưu dữ liệu lên SQL Server';
      console.error(`Failed to ${actionLabel} on SQL Server:`, msg);
      return { success: false, message: msg };
    }
    return {
      success: true,
      message: data?.message,
      insertedItems: typeof data?.insertedItems === 'number' ? data.insertedItems : undefined,
    };
  } catch (err: any) {
    const msg = err?.message || 'Không thể kết nối tới máy chủ để lưu SQL Server';
    console.error(`Failed to ${actionLabel} on SQL Server`, err);
    return { success: false, message: msg };
  }
}

export async function saveUserToSQLServer(config: SQLServerConfig, user: User, passwordHash?: string) {
  return postToSQLServer('/api/mssql/save-user', { config, user, passwordHash }, 'sync user');
}

export async function deleteUserFromSQLServer(config: SQLServerConfig, id: string) {
  return postToSQLServer('/api/mssql/delete-user', { config, id }, 'delete user');
}

export async function saveItemToSQLServer(config: SQLServerConfig, item: Item) {
  return postToSQLServer('/api/mssql/save-item', { config, item }, 'sync item');
}

export async function deleteItemFromSQLServer(config: SQLServerConfig, id: string) {
  return postToSQLServer('/api/mssql/delete-item', { config, id }, 'delete item');
}

export async function saveWarehouseToSQLServer(config: SQLServerConfig, warehouse: Warehouse) {
  return postToSQLServer('/api/mssql/save-warehouse', { config, warehouse }, 'sync warehouse');
}

export async function deleteWarehouseFromSQLServer(config: SQLServerConfig, id: string) {
  return postToSQLServer('/api/mssql/delete-warehouse', { config, id }, 'delete warehouse');
}

export async function saveCategoryToSQLServer(config: SQLServerConfig, category: Category) {
  return postToSQLServer('/api/mssql/save-category', { config, category }, 'sync category');
}

export async function deleteCategoryFromSQLServer(config: SQLServerConfig, id: string) {
  return postToSQLServer('/api/mssql/delete-category', { config, id }, 'delete category');
}

export async function saveUnitToSQLServer(config: SQLServerConfig, unit: Unit) {
  return postToSQLServer('/api/mssql/save-unit', { config, unit }, 'sync unit');
}

export async function deleteUnitFromSQLServer(config: SQLServerConfig, id: string) {
  return postToSQLServer('/api/mssql/delete-unit', { config, id }, 'delete unit');
}

export async function saveVoucherToSQLServer(
  config: SQLServerConfig,
  voucher: StockVoucher,
  logs: InventoryLog[],
  updatedItems: Item[]
): Promise<SQLServerActionResult> {
  return postToSQLServer('/api/mssql/save-voucher', { config, voucher, logs, updatedItems }, 'sync voucher');
}

export async function deleteVoucherFromSQLServer(
  config: SQLServerConfig,
  id: string,
  updatedItems: Item[]
): Promise<SQLServerActionResult> {
  return postToSQLServer('/api/mssql/delete-voucher', { config, id, updatedItems }, 'delete voucher');
}

export async function repairVoucherItemsInSQLServer(
  config: SQLServerConfig,
  voucherId: string,
  items: StockVoucher['items']
): Promise<SQLServerActionResult> {
  return postToSQLServer(
    '/api/mssql/repair-voucher-items',
    { config, voucherId, items },
    'repair voucher items'
  );
}

export async function importItemsBatchToSQLServer(
  config: SQLServerConfig,
  payload: {
    categories?: Category[];
    units?: Unit[];
    warehouses?: Warehouse[];
    items?: Item[];
  }
): Promise<SQLServerActionResult> {
  return postToSQLServer(
    '/api/mssql/import-items-batch',
    { config, ...payload },
    'import items batch'
  );
}
