import React, { useState, useEffect } from 'react';
import { useInventoryStore } from './store/useInventoryStore';
import { useAuthStore } from './store/useAuthStore';
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
import { AccountManager } from './components/auth/AccountManager';
import { LoginView } from './components/auth/LoginView';

export default function App() {
  const { activeTab, setActiveTab, theme, fetchFromSQLServer } = useInventoryStore();
  const { isAuthenticated } = useAuthStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load real data from SQL Server on mount and ensure initial tab is dashboard
  useEffect(() => {
    setActiveTab('dashboard');
    fetchFromSQLServer();
  }, [fetchFromSQLServer, setActiveTab]);

  // Sync html element dark class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // If not logged in, render authentication login view
  if (!isAuthenticated) {
    return <LoginView />;
  }

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
      case 'accounts':
        return <AccountManager />;
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
