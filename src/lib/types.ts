export type UserRole = 'cashier' | 'manager' | 'senior_manager' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  basePrice: number;
  costPrice: number;
  image?: string;
}

export interface InventoryBalance {
  productId: string;
  productName: string;
  category: string;
  loungeQty: number;
  warehouseQty: number;
  totalQty: number;
  costPrice: number;
  basePrice: number;
}

export interface Transaction {
  id: string;
  cashierId: string;
  cashierName: string;
  items: { productName: string; qty: number; price: number }[];
  total: number;
  paymentMethod: 'cash' | 'card';
  cashReceived?: number;
  changeGiven?: number;
  status: 'completed' | 'void' | 'refunded';
  createdAt: string;
}

export const roleLabels: Record<UserRole, string> = {
  cashier: 'Cashier',
  manager: 'Manager',
  senior_manager: 'Senior Manager',
  owner: 'Owner',
};

export const emptyDailyStats = {
  totalSales: 0,
  transactionCount: 0,
  avgTransaction: 0,
  cashSales: 0,
  cardSales: 0,
  topProduct: '',
  lowStockItems: 0,
  pendingApprovals: 0,
};
