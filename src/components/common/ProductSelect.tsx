import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Package, AlertTriangle, X } from 'lucide-react';
import { Item } from '../../types/inventory';
import { formatNumber } from '../../lib/formatters';

interface ProductSelectProps {
  items: Item[];
  value: string;
  onChange: (itemId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function ProductSelect({
  items,
  value,
  onChange,
  placeholder = 'Chọn sản phẩm...',
  disabled = false,
  className = '',
  ariaLabel = 'Chọn sản phẩm',
}: ProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((i) => i.id === value);

  // Filter items by search term (matches code, name, category, or unit)
  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(term)) ||
      (item.unitName && item.unitName.toLowerCase().includes(term))
    );
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSelect = (itemId: string) => {
    onChange(itemId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left rounded-lg border transition-all ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-slate-900'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {selectedItem ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
              [{selectedItem.code}]
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
              {selectedItem.name}
            </span>
            <span
              className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                selectedItem.stockQuantity === 0
                  ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                  : selectedItem.minStockLevel && selectedItem.stockQuantity <= selectedItem.minStockLevel
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Tồn: {formatNumber(selectedItem.stockQuantity)} {selectedItem.unitName}
            </span>
          </div>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-500' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã, tên, danh mục sản phẩm..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
            {filteredItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                <Package className="h-6 w-6 text-slate-300 dark:text-slate-700 mb-1" />
                <span>Không tìm thấy sản phẩm phù hợp</span>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === value;
                const isOutOfStock = item.stockQuantity === 0;
                const isLowStock =
                  item.minStockLevel && item.stockQuantity <= item.minStockLevel && !isOutOfStock;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between gap-3 p-2 text-left rounded-lg transition-colors text-xs ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-medium'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          [{item.code}]
                        </span>
                        <span className="font-semibold truncate">{item.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{item.categoryName || 'Sản phẩm'}</span>
                        <span>•</span>
                        <span>ĐVT: {item.unitName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-bold text-xs flex items-center justify-end gap-1 ${
                            isOutOfStock
                              ? 'text-rose-500'
                              : isLowStock
                              ? 'text-amber-500'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isOutOfStock && <AlertTriangle className="h-3 w-3" />}
                          <span>{formatNumber(item.stockQuantity)}</span>
                          <span className="font-normal text-[10px] text-slate-400">{item.unitName}</span>
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {isOutOfStock ? 'Hết hàng' : isLowStock ? 'Cảnh báo tồn thấp' : 'Tồn khả dụng'}
                        </div>
                      </div>

                      {isSelected && <Check className="h-4 w-4 text-emerald-500 ml-1 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
