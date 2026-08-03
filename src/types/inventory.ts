export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  manager: string;
  description?: string;
  isDefault?: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface Unit {
  id: string;
  name: string;
  description?: string;
}

export type StockStatus = 'NORMAL' | 'LOW' | 'OUT' | 'HIGH';

export interface Item {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitName: string;
  warehouseId: string;
  warehouseName: string;
  stockQuantity: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockVoucherItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitName: string;
  quantity: number;
  currentStock?: number;
}

export interface StockVoucher {
  id: string;
  code: string;
  type: 'IN' | 'OUT';
  date: string;
  person: string; // Người nhập hoặc người nhận
  department?: string; // Bộ phận (nếu là phiếu xuất)
  warehouseId: string;
  warehouseName: string;
  note?: string;
  items: StockVoucherItem[];
  totalQuantity: number;
  createdAt: string;
}

export interface InventoryLog {
  id: string;
  voucherId: string;
  voucherCode: string;
  type: 'IN' | 'OUT';
  date: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  person: string;
  department?: string;
  note?: string;
}

export type TabType =
  | 'dashboard'
  | 'warehouses'
  | 'items'
  | 'stock-in'
  | 'stock-out'
  | 'stock-lookup'
  | 'history'
  | 'reports'
  | 'categories'
  | 'accounts'
  | 'settings';
