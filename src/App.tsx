import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ShiftProvider } from "@/contexts/ShiftContext";
import { HappyHourProvider } from "@/contexts/HappyHourContext";
import { CartProvider } from "@/contexts/CartContext";
import { InventoryProvider } from "@/contexts/InventoryContext";
import { PurchaseOrderProvider } from "@/contexts/PurchaseOrderContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Inventory from "@/pages/Inventory";
import TransferStock from "@/pages/TransferStock";
import StockTake from "@/pages/StockTake";
import StockAdjustments from "@/pages/StockAdjustments";
import InventoryLounge from "@/pages/InventoryLounge";
import RefundApprovals from "@/pages/RefundApprovals";
import VoidTransactions from "@/pages/VoidTransactions";
import InventoryWarehouse from "@/pages/InventoryWarehouse";
import Suppliers from "@/pages/Suppliers";
import PurchaseOrders from "@/pages/PurchaseOrders";
import Reports from "@/pages/Reports";
import ReportDetail from "@/pages/ReportDetail";
import ShiftSummary from "@/pages/ShiftSummary";
import TransactionHistory from "@/pages/TransactionHistory";
import UsersPage from "@/pages/UsersPage";
import AuditLogs from "@/pages/AuditLogs";
import VarianceApprovals from "@/pages/VarianceApprovals";
import DiscountRulesPage from "@/pages/DiscountRulesPage";
import VoidsAndRefundsPage from "@/pages/VoidsAndRefundsPage";
import SystemSettingsPage from "@/pages/SystemSettingsPage";
import DevicesPage from "@/pages/DevicesPage";
import NotificationsPage from "@/pages/NotificationsPage";
import CashReconciliationPage from "@/pages/CashReconciliationPage";
import BankDepositsPage from "@/pages/BankDepositsPage";
import CashierSalesHistory from "@/pages/CashierSalesHistory";
import ShiftHistoryPage from "@/pages/ShiftHistoryPage";
import InventoryMovementsPage from "@/pages/InventoryMovementsPage";
import DeliveriesPage from "@/pages/DeliveriesPage";
import UserActivityPage from "@/pages/UserActivityPage";
import ReceiveStockPage from "@/pages/ops/ReceiveStockPage";
import ShiftsAttendancePage from "@/pages/ops/ShiftsAttendancePage";
import DiscrepanciesPage from "@/pages/ops/DiscrepanciesPage";
import IncidentReportsPage from "@/pages/ops/IncidentReportsPage";
import ApprovalsQueuePage from "@/pages/ops/ApprovalsQueuePage";
import PromotionsPage from "@/pages/ops/PromotionsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ShiftProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <ShiftProvider userId={user?.id ?? null}>{children}</ShiftProvider>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ShiftProviderWrapper>
        <HappyHourProvider>
        <InventoryProvider>
        <PurchaseOrderProvider>
        <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/pos/sales-history" element={<CashierSalesHistory />} />
              <Route path="/shift-history" element={<ShiftHistoryPage />} />
              <Route path="/products" element={<Products />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/transfer" element={<TransferStock />} />
              <Route path="/inventory/stock-take" element={<StockTake />} />
              <Route path="/inventory/stock-adjustments" element={<StockAdjustments />} />
              <Route path="/inventory/lounge" element={<InventoryLounge />} />
              <Route path="/refund-approvals" element={<RefundApprovals />} />
              <Route path="/void-transactions" element={<VoidTransactions />} />
              <Route path="/inventory/warehouse" element={<InventoryWarehouse />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/:reportSlug" element={<ReportDetail />} />
              <Route path="/shift-summary" element={<ShiftSummary />} />
              <Route path="/transactions" element={<TransactionHistory />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/audit" element={<AuditLogs />} />
              <Route path="/audit/user-activity" element={<UserActivityPage />} />
              <Route path="/variance-approvals" element={<VarianceApprovals />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/voids-refunds" element={<VoidsAndRefundsPage />} />
              <Route path="/inventory/movements" element={<InventoryMovementsPage />} />
              <Route path="/suppliers/deliveries" element={<DeliveriesPage />} />
              <Route path="/cash/reconciliation" element={<CashReconciliationPage />} />
              <Route path="/cash/bank-deposits" element={<BankDepositsPage />} />
              <Route path="/admin/settings" element={<SystemSettingsPage />} />
              <Route path="/admin/discount-rules" element={<DiscountRulesPage />} />
              <Route path="/admin/devices" element={<DevicesPage />} />
              <Route path="/ops/receive-stock" element={<ReceiveStockPage />} />
              <Route path="/ops/shifts" element={<ShiftsAttendancePage />} />
              <Route path="/ops/discrepancies" element={<DiscrepanciesPage />} />
              <Route path="/ops/incidents" element={<IncidentReportsPage />} />
              <Route path="/ops/approvals" element={<ApprovalsQueuePage />} />
              <Route path="/ops/promotions" element={<PromotionsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </CartProvider>
        </PurchaseOrderProvider>
        </InventoryProvider>
        </HappyHourProvider>
        </ShiftProviderWrapper>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
