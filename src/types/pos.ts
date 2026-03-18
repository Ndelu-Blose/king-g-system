/** POS types aligned with cashier.md and backend schema (products, sales, sale_items, payments, audit_logs). */

export type PaymentMethod = 'cash' | 'card' | 'eft' | 'split';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  sku?: string;
  category: string;
  basePrice: number;
  costPrice: number;
  image?: string;
  stock?: number;
}

export interface CartLine {
  product: Product;
  qty: number;
  /** Snapshot unit price at add-to-cart (latest active price). */
  unitPrice: number;
}

export interface SaleItemPayload {
  productId: string;
  barcode: string;
  sku?: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PaymentPayload {
  method: PaymentMethod;
  amount: number;
  cashReceived?: number;
  change?: number;
}

export interface SalePayload {
  cashierId: string;
  cashierName?: string;
  shiftId?: string;
  items: SaleItemPayload[];
  subtotal: number;
  vat?: number;
  total: number;
  payments: PaymentPayload[];
  deviceId?: string;
}

/** Data for printable receipt after payment. */
export interface ReceiptData {
  saleId: string;
  createdAt: string;
  items: SaleItemPayload[];
  subtotal: number;
  vat: number;
  total: number;
  payments: PaymentPayload[];
}

export interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorRole?: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ProductWithStock extends Product {
  stock: number;
}
