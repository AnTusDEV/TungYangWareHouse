import { supabase } from './supabase';
import { Item, Category, Warehouse, Unit, StockVoucher, InventoryLog } from '../types/inventory';

export interface SupabaseSyncResult {
  success: boolean;
  error?: string;
  items?: Item[];
  categories?: Category[];
  warehouses?: Warehouse[];
  units?: Unit[];
  vouchers?: StockVoucher[];
  logs?: InventoryLog[];
}

function formatErrorMessage(err: unknown): string {
  if (!err) return 'Lỗi không xác định';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (obj.message && typeof obj.message === 'string') {
      let msg = obj.message;
      if (obj.details && typeof obj.details === 'string') msg += ` (${obj.details})`;
      if (obj.hint && typeof obj.hint === 'string') msg += ` - ${obj.hint}`;
      if (obj.code && typeof obj.code === 'string') msg += ` [Mã lỗi: ${obj.code}]`;
      return msg;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

export async function fetchAllFromSupabase(): Promise<SupabaseSyncResult> {
  try {
    const [itemsRes, catsRes, whsRes, unitsRes, vouchersRes, voucherItemsRes, logsRes] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('warehouses').select('*'),
      supabase.from('units').select('*'),
      supabase.from('stock_vouchers').select('*'),
      supabase.from('stock_voucher_items').select('*'),
      supabase.from('inventory_logs').select('*'),
    ]);

    if (itemsRes.error) throw itemsRes.error;
    if (catsRes.error) throw catsRes.error;
    if (whsRes.error) throw whsRes.error;
    if (unitsRes.error) throw unitsRes.error;
    if (vouchersRes.error) throw vouchersRes.error;
    if (voucherItemsRes.error) throw voucherItemsRes.error;
    if (logsRes.error) throw logsRes.error;

    const items: Item[] = (itemsRes.data || []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      categoryId: row.category_id || '',
      categoryName: row.category_name || '',
      unitId: row.unit_id || '',
      unitName: row.unit_name || '',
      warehouseId: row.warehouse_id || '',
      warehouseName: row.warehouse_name || '',
      stockQuantity: Number(row.stock_quantity) || 0,
      minStockLevel: Number(row.min_stock_level) || 0,
      maxStockLevel: Number(row.max_stock_level) || 100,
      note: row.note || '',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));

    const categories: Category[] = (catsRes.data || []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || '',
    }));

    const warehouses: Warehouse[] = (whsRes.data || []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      location: row.location || '',
      manager: row.manager || '',
      description: row.description || '',
      isDefault: Boolean(row.is_default),
    }));

    const units: Unit[] = (unitsRes.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
    }));

    const voucherItemsData = voucherItemsRes.data || [];
    const vouchers: StockVoucher[] = (vouchersRes.data || []).map((row) => {
      const lineItems = voucherItemsData
        .filter((vi) => vi.voucher_id === row.id)
        .map((vi) => ({
          itemId: vi.item_id,
          itemCode: vi.item_code,
          itemName: vi.item_name,
          unitName: vi.unit_name,
          quantity: Number(vi.quantity) || 0,
          currentStock: Number(vi.current_stock) || 0,
        }));

      return {
        id: row.id,
        code: row.code,
        type: row.type as 'IN' | 'OUT',
        date: row.date,
        person: row.person,
        department: row.department || undefined,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        note: row.note || undefined,
        items: lineItems,
        totalQuantity: Number(row.total_quantity) || 0,
        createdAt: row.created_at || new Date().toISOString(),
      };
    });

    const logs: InventoryLog[] = (logsRes.data || []).map((row) => ({
      id: row.id,
      voucherId: row.voucher_id,
      voucherCode: row.voucher_code,
      type: row.type as 'IN' | 'OUT',
      date: row.date,
      itemId: row.item_id,
      itemCode: row.item_code,
      itemName: row.item_name,
      categoryName: row.category_name,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      quantity: Number(row.quantity) || 0,
      previousStock: Number(row.previous_stock) || 0,
      newStock: Number(row.new_stock) || 0,
      person: row.person,
      department: row.department || undefined,
      note: row.note || '',
      createdAt: row.created_at || new Date().toISOString(),
    }));

    return {
      success: true,
      items,
      categories,
      warehouses,
      units,
      vouchers,
      logs,
    };
  } catch (err: unknown) {
    const errorMsg = formatErrorMessage(err);
    console.error('Failed to sync from Supabase:', errorMsg, err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

export async function saveItemToSupabase(item: Item) {
  try {
    await supabase.from('items').upsert({
      id: item.id,
      code: item.code,
      name: item.name,
      category_id: item.categoryId,
      category_name: item.categoryName,
      unit_id: item.unitId,
      unit_name: item.unitName,
      warehouse_id: item.warehouseId,
      warehouse_name: item.warehouseName,
      stock_quantity: item.stockQuantity,
      min_stock_level: item.minStockLevel || 0,
      max_stock_level: item.maxStockLevel || 100,
      note: item.note || '',
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving item to Supabase:', err);
  }
}

export async function deleteItemFromSupabase(id: string) {
  try {
    await supabase.from('items').delete().eq('id', id);
  } catch (err) {
    console.error('Error deleting item from Supabase:', err);
  }
}

export async function saveWarehouseToSupabase(wh: Warehouse) {
  try {
    await supabase.from('warehouses').upsert({
      id: wh.id,
      code: wh.code,
      name: wh.name,
      location: wh.location || '',
      manager: wh.manager || '',
      description: wh.description || '',
      is_default: wh.isDefault || false,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving warehouse to Supabase:', err);
  }
}

export async function deleteWarehouseFromSupabase(id: string) {
  try {
    await supabase.from('warehouses').delete().eq('id', id);
  } catch (err) {
    console.error('Error deleting warehouse from Supabase:', err);
  }
}

export async function saveCategoryToSupabase(cat: Category) {
  try {
    await supabase.from('categories').upsert({
      id: cat.id,
      code: cat.code,
      name: cat.name,
      description: cat.description || '',
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving category to Supabase:', err);
  }
}

export async function deleteCategoryFromSupabase(id: string) {
  try {
    await supabase.from('categories').delete().eq('id', id);
  } catch (err) {
    console.error('Error deleting category from Supabase:', err);
  }
}

export async function saveUnitToSupabase(unit: Unit) {
  try {
    await supabase.from('units').upsert({
      id: unit.id,
      name: unit.name,
      description: unit.description || '',
    });
  } catch (err) {
    console.error('Error saving unit to Supabase:', err);
  }
}

export async function deleteUnitFromSupabase(id: string) {
  try {
    await supabase.from('units').delete().eq('id', id);
  } catch (err) {
    console.error('Error deleting unit from Supabase:', err);
  }
}

export async function saveVoucherToSupabase(voucher: StockVoucher, logs: InventoryLog[], updatedItems: Item[]) {
  try {
    // 1. Save voucher
    await supabase.from('stock_vouchers').upsert({
      id: voucher.id,
      code: voucher.code,
      type: voucher.type,
      date: voucher.date,
      person: voucher.person,
      department: voucher.department || null,
      warehouse_id: voucher.warehouseId,
      warehouse_name: voucher.warehouseName,
      note: voucher.note || null,
      total_quantity: voucher.totalQuantity,
    });

    // 2. Save voucher items
    for (const item of voucher.items) {
      await supabase.from('stock_voucher_items').insert({
        voucher_id: voucher.id,
        item_id: item.itemId,
        item_code: item.itemCode,
        item_name: item.itemName,
        unit_name: item.unitName,
        quantity: item.quantity,
        current_stock: item.currentStock,
      });
    }

    // 3. Save logs
    for (const log of logs) {
      await supabase.from('inventory_logs').upsert({
        id: log.id,
        voucher_id: log.voucherId,
        voucher_code: log.voucherCode,
        type: log.type,
        date: log.date,
        item_id: log.itemId,
        item_code: log.itemCode,
        item_name: log.itemName,
        category_name: log.categoryName,
        warehouse_id: log.warehouseId,
        warehouse_name: log.warehouseName,
        quantity: log.quantity,
        previous_stock: log.previousStock,
        new_stock: log.newStock,
        person: log.person,
        department: log.department || null,
        note: log.note || null,
      });
    }

    // 4. Update items stock
    for (const item of updatedItems) {
      await saveItemToSupabase(item);
    }
  } catch (err) {
    console.error('Error saving voucher to Supabase:', err);
  }
}
