/**
 * POS API layer: calls Node backend when available, falls back to mock data.
 */
import { mockProducts, mockInventory, mockUsers } from './mock-data';
import type { Transaction } from './mock-data';
import type { Product, SalePayload, AuditEntry, ProductWithStock } from '@/types/pos';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'kingg_token';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// --- Mock fallbacks (when backend is down) ---
function toProductWithStock(p: (typeof mockProducts)[0], stock: number): ProductWithStock {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    basePrice: p.basePrice,
    costPrice: p.costPrice,
    image: p.image,
    stock,
  };
}

function getStock(productId: string): number {
  const inv = mockInventory.find((i) => i.productId === productId);
  return inv?.totalQty ?? 0;
}

/** Get product by barcode; uses backend, falls back to mock. */
export async function getProductByBarcode(barcode: string): Promise<ProductWithStock | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  try {
    const product = await apiGet<ProductWithStock>(`/api/products/barcode/${encodeURIComponent(trimmed)}`);
    return product;
  } catch (e) {
    if ((e as Error).message === 'NOT_FOUND') return null;
    const p = mockProducts.find((prod) => prod.barcode === trimmed);
    if (!p) return null;
    return toProductWithStock(p, getStock(p.id));
  }
}

/** Search products; uses backend, falls back to mock. */
export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  try {
    const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    return await apiGet<Product[]>(`/api/products/search?${params}`);
  } catch {
    const q = query.trim().toLowerCase();
    if (!q) return mockProducts.slice(0, limit).map((p) => ({ ...p, stock: getStock(p.id) }));
    return mockProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, limit)
      .map((p) => ({ ...p, stock: getStock(p.id) }));
  }
}

/** Get all products; uses backend, falls back to mock. */
export async function getAllProducts(): Promise<ProductWithStock[]> {
  try {
    return await apiGet<ProductWithStock[]>('/api/products');
  } catch {
    return mockProducts.map((p) => toProductWithStock(p, getStock(p.id)));
  }
}

/** Get categories; uses backend, falls back to mock. */
export async function getCategories(): Promise<string[]> {
  try {
    return await apiGet<string[]>('/api/categories');
  } catch {
    return ['All', ...Array.from(new Set(mockProducts.map((p) => p.category)))];
  }
}

const salesStore: Array<{ id: string; payload: SalePayload; createdAt: string }> = [];
const auditStore: AuditEntry[] = [];
let saleIdCounter = 1;
function nextSaleId(): string {
  return `TXN-${String(saleIdCounter++).padStart(3, '0')}`;
}
function nextAuditId(): string {
  return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Create sale; decrements stock on server, returns sale id and createdAt for receipt. Server uses authenticated user as cashier. */
export async function createSale(payload: SalePayload): Promise<{ id: string; createdAt: string }> {
  try {
    const data = await apiPost<{ id: string; createdAt: string }>('/api/sales', payload);
    return data;
  } catch {
    const id = nextSaleId();
    const createdAt = new Date().toISOString();
    salesStore.push({ id, payload, createdAt });
    const cashier = mockUsers.find((u) => u.id === payload.cashierId);
    auditStore.push({
      id: nextAuditId(),
      action: 'sale_completed',
      actorId: payload.cashierId,
      actorRole: cashier?.role,
      after: {
        saleId: id,
        cashierId: payload.cashierId,
        shiftId: payload.shiftId,
        subtotal: payload.subtotal,
        vat: payload.vat,
        total: payload.total,
        itemsCount: payload.items.length,
        payments: payload.payments,
      },
      timestamp: createdAt,
      metadata: { deviceId: payload.deviceId },
    });
    return { id, createdAt };
  }
}

/** Write audit log; tries backend, then in-memory. */
export async function writeAuditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    await apiPost('/api/audit', { ...entry, timestamp: new Date().toISOString() });
  } catch {
    auditStore.push({
      ...entry,
      id: nextAuditId(),
      timestamp: new Date().toISOString(),
    });
  }
}

/** Void a sale (server-side). Requires void.approve permission. */
export async function voidSaleApi(saleId: string, reasonCode?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/sales/${encodeURIComponent(saleId)}/void`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reasonCode: reasonCode || 'void_approved' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Refund a sale (server-side). Requires refund.approve permission. */
export async function refundSaleApi(
  saleId: string,
  opts?: { amount?: number; reasonCode?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/sales/${encodeURIComponent(saleId)}/refund`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        reasonCode: opts?.reasonCode || 'refund_approved',
        amount: opts?.amount,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Fetch all transactions from the database (real-time). Optional cashierId to filter. */
export async function getTransactionsFromApi(cashierId?: string | null): Promise<Transaction[] | null> {
  try {
    const url = cashierId
      ? `${API_BASE}/api/transactions?cashierId=${encodeURIComponent(cashierId)}`
      : `${API_BASE}/api/transactions`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const LOCAL_HELP_KEY = 'kingg_help_requests';

/** Help request from cashier — notifies managers in the system */
export interface HelpRequestPayload {
  cashierId: string;
  cashierName?: string;
  message?: string;
}

function saveHelpRequestLocal(payload: HelpRequestPayload): { id: string; createdAt: string } {
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const entry = {
    id,
    cashierId: payload.cashierId,
    cashierName: payload.cashierName || payload.cashierId,
    message: payload.message || null,
    status: 'pending',
    createdAt,
    acknowledgedAt: null,
    acknowledgedBy: null,
  };
  try {
    const raw = localStorage.getItem(LOCAL_HELP_KEY);
    const list: typeof entry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem(LOCAL_HELP_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // ignore
  }
  return { id, createdAt };
}

export function getLocalHelpRequests(): HelpRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_HELP_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function removeLocalHelpRequest(id: string): void {
  try {
    const raw = localStorage.getItem(LOCAL_HELP_KEY);
    const list: { id: string }[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((r) => r.id !== id);
    localStorage.setItem(LOCAL_HELP_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function createHelpRequest(payload: HelpRequestPayload): Promise<{ id: string; createdAt: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/help-requests`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.id === 'string') return data;
    }
  } catch {
    // Network error: continue to fallback
  }
  // API failed or unreachable: save locally so managers see it on Alerts & Help and cashier always sees success
  return saveHelpRequestLocal(payload);
}

export interface HelpRequest {
  id: string;
  cashierId: string;
  cashierName: string;
  message: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export async function getHelpRequests(status?: string | null): Promise<HelpRequest[] | null> {
  try {
    const url = status
      ? `${API_BASE}/api/help-requests?status=${encodeURIComponent(status)}`
      : `${API_BASE}/api/help-requests`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function acknowledgeHelpRequest(id: string, acknowledgedBy: string): Promise<boolean> {
  if (id.startsWith('local-')) {
    removeLocalHelpRequest(id);
    return true;
  }
  try {
    const res = await fetch(`${API_BASE}/api/help-requests/${encodeURIComponent(id)}/acknowledge`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ acknowledgedBy }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
