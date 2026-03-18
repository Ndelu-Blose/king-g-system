import type { LucideIcon } from 'lucide-react';
import { FileText, TrendingUp, DollarSign, Package, Users } from 'lucide-react';

export interface ReportItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: string;
}

export const reportList: ReportItem[] = [
  { id: '1', slug: 'daily-sales', title: 'Daily Sales Summary', description: 'Total sales, transactions, payment breakdown', icon: DollarSign, category: 'Sales' },
  { id: '2', slug: 'cashier-performance', title: 'Cashier Performance', description: 'Sales by cashier, transactions per hour', icon: Users, category: 'Sales' },
  { id: '3', slug: 'product-performance', title: 'Product Performance', description: 'Best sellers, slow movers, category analysis', icon: TrendingUp, category: 'Sales' },
  { id: '4', slug: 'stock-level', title: 'Stock Level Report', description: 'Current quantities by location, low stock alerts', icon: Package, category: 'Inventory' },
  { id: '5', slug: 'stock-movement', title: 'Stock Movement Report', description: 'Transfers between locations, patterns', icon: Package, category: 'Inventory' },
  { id: '6', slug: 'cash-reconciliation', title: 'Cash Reconciliation', description: 'Expected vs actual, variance history', icon: DollarSign, category: 'Financial' },
  { id: '7', slug: 'void-refund', title: 'Void & Refund Report', description: 'All voided transactions, reasons, approvers', icon: FileText, category: 'Audit' },
  { id: '8', slug: 'supplier-variance', title: 'Supplier Variance Report', description: 'Delivery discrepancies, variance trends', icon: FileText, category: 'Supplier' },
  { id: '9', slug: 'inventory', title: 'Inventory Reports', description: 'Valuation, shrinkage, low stock, slow movers', icon: Package, category: 'Inventory' },
  { id: '10', slug: 'financial', title: 'Financial Reports', description: 'Revenue trends, profitability, payment fees', icon: DollarSign, category: 'Financial' },
  { id: '11', slug: 'audit', title: 'Audit Reports', description: 'Exceptions, suspicious patterns', icon: FileText, category: 'Audit' },
];

export function getReportBySlug(slug: string): ReportItem | undefined {
  return reportList.find(r => r.slug === slug);
}
