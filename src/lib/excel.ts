import * as XLSX from 'xlsx';
import { Item, InventoryLog } from '../types/inventory';

export function exportItemsToExcel(items: Item[], fileName = 'Danh_sach_hang_hoa.xlsx') {
  const data = items.map((item, index) => ({
    'STT': index + 1,
    'Mã Hàng': item.code,
    'Tên Hàng Hóa': item.name,
    'Nhóm Hàng': item.categoryName,
    'Đơn Vị Tính': item.unitName,
    'Kho': item.warehouseName,
    'Tồn Hiện Tại': item.stockQuantity,
    'Ghi Chú': item.note || '',
    'Ngày Tạo': item.createdAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hàng Hóa');

  // Auto column widths
  const max_width = data.reduce((acc: any, row: any) => {
    Object.keys(row).forEach((key) => {
      const val = String(row[key]);
      acc[key] = Math.max(acc[key] || 10, val.length + 3);
    });
    return acc;
  }, {});

  worksheet['!cols'] = Object.keys(max_width).map((key) => ({
    wch: max_width[key],
  }));

  XLSX.writeFile(workbook, fileName);
}

export function exportStockReportToExcel(items: Item[], fileName = 'Bao_cao_ton_kho.xlsx') {
  const data = items.map((item, index) => {
    let statusLabel = 'Còn hàng';
    if (item.stockQuantity <= 0) statusLabel = 'Hết hàng';
    else if (item.maxStockLevel && item.stockQuantity >= item.maxStockLevel) statusLabel = 'Tồn nhiều';

    return {
      'STT': index + 1,
      'Mã Hàng': item.code,
      'Tên Sản Phẩm': item.name,
      'Nhóm Hàng': item.categoryName,
      'Đơn Vị': item.unitName,
      'Kho Lưu Trữ': item.warehouseName,
      'Tồn Kho': item.stockQuantity,
      'Trạng Thái Tồn': statusLabel,
      'Ghi Chú': item.note || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo Cáo Tồn Kho');

  XLSX.writeFile(workbook, fileName);
}

export function exportHistoryToExcel(logs: InventoryLog[], fileName = 'Lich_su_nhap_xuat.xlsx') {
  const data = logs.map((log, index) => ({
    'STT': index + 1,
    'Ngày GD': log.date,
    'Mã Phiếu': log.voucherCode,
    'Loại GD': log.type === 'IN' ? 'Nhập kho' : 'Xuất kho',
    'Mã Hàng': log.itemCode,
    'Tên Hàng': log.itemName,
    'Nhóm Hàng': log.categoryName,
    'Kho': log.warehouseName,
    'Số Lượng': log.quantity,
    'Tồn Trước': log.previousStock,
    'Tồn Sau': log.newStock,
    'Người Thực Hiện': log.person,
    'Bộ Phận Nhận': log.department || '-',
    'Ghi Chú': log.note || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lịch Sử GD');

  XLSX.writeFile(workbook, fileName);
}

export function downloadImportTemplate() {
  const sampleData = [
    {
      'Tên Hàng Hóa': 'Sổ tay A5 bìa cứng cao cấp',
      'Nhóm Hàng': 'Sổ sách',
      'Đơn Vị Tính': 'Quyển',
      'Kho': 'Kho 1',
      'Số Lượng Tồn': 50,
      'Ghi Chú': 'Mẫu sổ công tác năm 2026',
    },
    {
      'Tên Hàng Hóa': 'Giấy in A4 Double A 70gsm',
      'Nhóm Hàng': 'Sổ sách',
      'Đơn Vị Tính': 'Ram',
      'Kho': 'Kho 1',
      'Số Lượng Tồn': 120,
      'Ghi Chú': 'Thùng 5 ram',
    },
    {
      'Tên Hàng Hóa': 'Nước lau sàn Sunhouse 1L',
      'Nhóm Hàng': 'Đồ dùng sinh hoạt',
      'Đơn Vị Tính': 'Chai',
      'Kho': 'Kho 2',
      'Số Lượng Tồn': 15,
      'Ghi Chú': 'Dùng cho nhà vệ sinh tầng 3',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Import_Hang_Hoa');

  XLSX.writeFile(workbook, 'Mau_Import_Danh_Muc_Hang_Hoa.xlsx');
}

export async function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
