import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { parseExcelFile, downloadImportTemplate } from '../../lib/excel';
import { useInventoryStore } from '../../store/useInventoryStore';
import { formatNumber } from '../../lib/formatters';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExcelImportModal({ isOpen, onClose }: ExcelImportModalProps) {
  const { importItems } = useInventoryStore();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);
    setResultMessage(null);

    try {
      const rows = await parseExcelFile(selectedFile);
      const formatted = rows.map((r: any) => {
        const rawQty = r['Số Lượng Tồn'] ?? r['Tồn kho'] ?? r['Số lượng'] ?? r['Stock'] ?? 0;
        const parsedQty = Number(rawQty);
        const stockQuantity = isNaN(parsedQty) || parsedQty < 0 ? 0 : parsedQty;

        return {
          name: r['Tên Hàng Hóa'] || r['Tên hàng'] || r['Ten Hang'] || r['Name'] || '',
          categoryName: r['Nhóm Hàng'] || r['Nhóm hàng'] || r['Category'] || '',
          unitName: r['Đơn Vị Tính'] || r['Đơn vị'] || r['Unit'] || '',
          warehouseName: r['Kho'] || r['Warehouse'] || '',
          stockQuantity,
          note: r['Ghi Chú'] || r['Ghi chú'] || '',
        };
      });

      setPreviewData(formatted);
    } catch (error) {
      setResultMessage('Lỗi đọc file Excel. Vui lòng kiểm tra lại định dạng file .xlsx hoặc .csv');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (previewData.length === 0) return;

    const res = importItems(previewData);
    setResultMessage(
      `Đã nhập và lưu thành công ${res.successCount} mặt hàng vào cơ sở dữ liệu (Database).`
    );
    setTimeout(() => {
      onClose();
      setFile(null);
      setPreviewData([]);
      setResultMessage(null);
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Danh Mục Hàng Hóa Từ Excel"
      maxWidth="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={downloadImportTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors mr-auto"
          >
            <Download className="h-3.5 w-3.5 text-cyan-500" />
            Tải mẫu Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={previewData.length === 0 || isLoading}
            onClick={handleConfirmImport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white shadow-sm transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Xác nhận Import ({previewData.length})
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Upload Drop Zone */}
        <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 rounded-xl p-6 text-center transition-colors bg-slate-50/50 dark:bg-slate-900/50">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="rounded-full bg-cyan-500/10 p-3 text-cyan-500">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Kéo thả file Excel vào đây hoặc <span className="text-cyan-500 underline">chọn từ máy tính</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hỗ trợ định dạng .xlsx, .xls, .csv
            </p>
            {file && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-medium">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{file.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Result notification */}
        {resultMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
            <CheckCircle className="h-4 w-4" />
            <span>{resultMessage}</span>
          </div>
        )}

        {/* Data Preview Table */}
        {previewData.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Xem trước dữ liệu ({previewData.length} dòng)
              </h4>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">STT</th>
                    <th className="px-3 py-2">Tên Hàng Hóa</th>
                    <th className="px-3 py-2">Nhóm Hàng</th>
                    <th className="px-3 py-2">Đơn Vị</th>
                    <th className="px-3 py-2">Kho</th>
                    <th className="px-3 py-2 text-right">Số Lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100">
                        {row.name || <span className="text-rose-500">Thiếu tên</span>}
                      </td>
                      <td className="px-3 py-1.5">{row.categoryName}</td>
                      <td className="px-3 py-1.5">{row.unitName}</td>
                      <td className="px-3 py-1.5">{row.warehouseName}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{formatNumber(row.stockQuantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
