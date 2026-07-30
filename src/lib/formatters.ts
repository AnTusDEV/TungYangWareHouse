import { StockStatus } from '../types/inventory';

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('vi-VN').format(val || 0);
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(val || 0);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function getStockStatus(stock: number, minLevel: number = 0, maxLevel?: number): {
  status: StockStatus;
  label: string;
  badgeClass: string;
  bgClass: string;
  textClass: string;
} {
  if (stock <= 0) {
    return {
      status: 'OUT',
      label: 'Hết hàng',
      badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
      bgClass: 'bg-red-500/10',
      textClass: 'text-red-600 dark:text-red-400',
    };
  }
  if (minLevel > 0 && stock < minLevel) {
    return {
      status: 'LOW',
      label: 'Sắp hết hàng',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      bgClass: 'bg-amber-500/10',
      textClass: 'text-amber-600 dark:text-amber-400',
    };
  }
  if (maxLevel && stock >= maxLevel) {
    return {
      status: 'HIGH',
      label: 'Tồn nhiều',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      bgClass: 'bg-blue-500/10',
      textClass: 'text-blue-600 dark:text-blue-400',
    };
  }
  return {
    status: 'NORMAL',
    label: 'Còn hàng',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  };
}

export function generateItemCode(existingCodes: string[]): string {
  const numbers = existingCodes
    .map((code) => {
      const match = code.match(/HH(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNum = maxNum + 1;
  return `HH${nextNum.toString().padStart(4, '0')}`;
}

export function generateVoucherCode(type: 'IN' | 'OUT', existingCodes: string[]): string {
  const prefix = type === 'IN' ? 'PN' : 'PX';
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const currentMonthCodes = existingCodes.filter((code) =>
    code.startsWith(`${prefix}${yearMonth}`)
  );

  const numbers = currentMonthCodes
    .map((code) => {
      const suffix = code.slice((prefix + yearMonth).length);
      const num = parseInt(suffix, 10);
      return isNaN(num) ? 0 : num;
    })
    .filter((n) => !isNaN(n));

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const nextNum = maxNum + 1;
  return `${prefix}${yearMonth}${nextNum.toString().padStart(3, '0')}`;
}
