export type UserRole = 'cashier' | 'manager' | 'senior_manager' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
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

export const mockUsers: User[] = [
  { id: '1', name: 'King G', email: 'owner@kingg.co.za', role: 'owner' },
  { id: '2', name: 'Thabo M.', email: 'thabo@kingg.co.za', role: 'senior_manager' },
  { id: '3', name: 'Lerato K.', email: 'lerato@kingg.co.za', role: 'manager' },
  { id: '4', name: 'Sipho N.', email: 'sipho@kingg.co.za', role: 'cashier' },
];

export const mockProducts: Product[] = [
  { id: '1', name: 'Johnnie Walker Black', barcode: '5000267024202', category: 'Whisky', basePrice: 45, costPrice: 28 },
  { id: '2', name: 'Hennessy VS', barcode: '3245995001015', category: 'Cognac', basePrice: 55, costPrice: 35 },
  { id: '3', name: 'Moët & Chandon', barcode: '3185370001233', category: 'Champagne', basePrice: 120, costPrice: 80 },
  { id: '4', name: 'Grey Goose Vodka', barcode: '8000040060028', category: 'Vodka', basePrice: 40, costPrice: 22 },
  { id: '5', name: 'Bombay Sapphire Gin', barcode: '5010677714006', category: 'Gin', basePrice: 35, costPrice: 20 },
  { id: '6', name: 'Patron Silver Tequila', barcode: '7210003810021', category: 'Tequila', basePrice: 50, costPrice: 30 },
  { id: '7', name: 'Red Bull Energy', barcode: '9002490100070', category: 'Mixers', basePrice: 15, costPrice: 8 },
  { id: '8', name: 'Coca-Cola 330ml', barcode: '5449000000996', category: 'Mixers', basePrice: 10, costPrice: 5 },
  { id: '9', name: 'Castle Lager 340ml', barcode: '6001078012001', category: 'Beer', basePrice: 20, costPrice: 12 },
  { id: '10', name: 'Heineken 330ml', barcode: '8710398020184', category: 'Beer', basePrice: 25, costPrice: 15 },
  { id: '11', name: 'Jack Daniels', barcode: '0082184090466', category: 'Whisky', basePrice: 42, costPrice: 26 },
  { id: '12', name: 'Amarula Cream', barcode: '6001495062018', category: 'Liqueur', basePrice: 30, costPrice: 18 },
];

export const mockInventory: InventoryBalance[] = mockProducts.map(p => ({
  productId: p.id,
  productName: p.name,
  category: p.category,
  loungeQty: Math.floor(Math.random() * 20) + 5,
  warehouseQty: Math.floor(Math.random() * 50) + 10,
  totalQty: 0,
  costPrice: p.costPrice,
  basePrice: p.basePrice,
})).map(i => ({ ...i, totalQty: i.loungeQty + i.warehouseQty }));

export const mockTransactions: Transaction[] = [
  { id: 'TXN-001', cashierId: '4', cashierName: 'Sipho N.', items: [{ productName: 'Hennessy VS', qty: 2, price: 55 }, { productName: 'Red Bull Energy', qty: 2, price: 15 }], total: 140, paymentMethod: 'cash', cashReceived: 150, changeGiven: 10, status: 'completed', createdAt: '2026-02-17T14:32:00' },
  { id: 'TXN-002', cashierId: '4', cashierName: 'Sipho N.', items: [{ productName: 'Moët & Chandon', qty: 1, price: 120 }], total: 120, paymentMethod: 'card', status: 'completed', createdAt: '2026-02-17T14:15:00' },
  { id: 'TXN-003', cashierId: '4', cashierName: 'Sipho N.', items: [{ productName: 'Castle Lager 340ml', qty: 4, price: 20 }, { productName: 'Bombay Sapphire Gin', qty: 1, price: 35 }], total: 115, paymentMethod: 'cash', cashReceived: 120, changeGiven: 5, status: 'completed', createdAt: '2026-02-17T13:50:00' },
  { id: 'TXN-004', cashierId: '4', cashierName: 'Sipho N.', items: [{ productName: 'Grey Goose Vodka', qty: 1, price: 40 }, { productName: 'Coca-Cola 330ml', qty: 2, price: 10 }], total: 60, paymentMethod: 'card', status: 'completed', createdAt: '2026-02-17T13:20:00' },
];

export const roleLabels: Record<UserRole, string> = {
  cashier: 'Cashier',
  manager: 'Manager',
  senior_manager: 'Senior Manager',
  owner: 'Owner',
};

export const dailyStats = {
  totalSales: 12450,
  transactionCount: 87,
  avgTransaction: 143.10,
  cashSales: 7200,
  cardSales: 5250,
  topProduct: 'Hennessy VS',
  lowStockItems: 3,
  pendingApprovals: 2,
};

export const weeklySalesData = [
  { day: 'Mon', sales: 8200 },
  { day: 'Tue', sales: 9100 },
  { day: 'Wed', sales: 7800 },
  { day: 'Thu', sales: 11500 },
  { day: 'Fri', sales: 15200 },
  { day: 'Sat', sales: 18900 },
  { day: 'Sun', sales: 12450 },
];

export const categorySalesData = [
  { category: 'Whisky', value: 3200, fill: 'hsl(32, 45%, 58%)' },
  { category: 'Cognac', value: 2800, fill: 'hsl(38, 60%, 65%)' },
  { category: 'Champagne', value: 2100, fill: 'hsl(220, 15%, 40%)' },
  { category: 'Beer', value: 1900, fill: 'hsl(142, 71%, 45%)' },
  { category: 'Mixers', value: 1200, fill: 'hsl(220, 10%, 55%)' },
  { category: 'Other', value: 1250, fill: 'hsl(220, 15%, 30%)' },
];
