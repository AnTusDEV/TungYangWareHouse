import React, { useState, useEffect } from 'react';
import { useInventoryStore } from './store/useInventoryStore';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

import { Dashboard } from './components/dashboard/Dashboard';
import { WarehouseManager } from './components/warehouses/WarehouseManager';
import { ItemManager } from './components/items/ItemManager';
import { StockInManager } from './components/stock-in/StockInManager';
import { StockOutManager } from './components/stock-out/StockOutManager';
import { StockLookup } from './components/stock-lookup/StockLookup';
import { TransactionHistory } from './components/history/TransactionHistory';
import { ReportsView } from './components/reports/ReportsView';
import { CategoryUnitManager } from './components/categories/CategoryUnitManager';
import { SettingsView } from './components/settings/SettingsView';

export default function App() {
  const { activeTab, setActiveTab, theme, fetchFromSupabase } = useInventoryStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load real data from Supabase on mount
  useEffect(() => {
    fetchFromSupabase();
  }, [fetchFromSupabase]);

  // Sync html element dark class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Render main tab view
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'warehouses':
        return <WarehouseManager />;
      case 'items':
        return <ItemManager />;
      case 'stock-in':
        return <StockInManager />;
      case 'stock-out':
        return <StockOutManager />;
      case 'stock-lookup':
        return <StockLookup />;
      case 'history':
        return <TransactionHistory />;
      case 'reports':
        return <ReportsView />;
      case 'categories':
        return <CategoryUnitManager />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={`h-screen flex overflow-hidden bg-slate-100 dark:bg-[#0b132b] text-slate-800 dark:text-slate-100 transition-colors duration-200 font-sans`}>
      {/* Left Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <Header
          onOpenQuickStockIn={() => setActiveTab('stock-in')}
          onOpenQuickStockOut={() => setActiveTab('stock-out')}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}
