/**
 * POS API layer: calls Node backend or Supabase when configured.
 */
import { type Transaction, type InventoryBalance } from './types';
import type { Product, SalePayload, AuditEntry, ProductWithStock } from '@/types/pos';
import { isSupabaseConfigured, supabase } from './supabase';

export type ReceiveIntoLocation = 'warehouse' | 'lounge' | string;
export type ReceivingStatus =
  | 'draft'
  | 'expected_captured'
  | 'physical_verified'
  | 'variance_review'
  | 'confirmed'
  | string;

export interface DeliveryIntakeHeader {
  id: string;
  intakeNumber: string;
  supplier: string;
  invoiceNumber: string;
  deliveryReference: string;
  deliveryDate: string;
  branchSite: string;
  receiveIntoLocation: ReceiveIntoLocation;
  receivedBy: string;
  notes?: string | null;
  status: ReceivingStatus;
  confirmedAt?: string | null;
}

export interface DeliveryIntakeLine {
  id: string;
  intakeId: string;
  productId: string;
  expectedQty: number;
  actualQty: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  unitOfMeasure: string;
  unitCost?: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  discrepancyReason?: string | null;
  decision?: 'accept' | 'reject' | 'hold' | string;
  verificationNotes?: string | null;
  destination?: string | null;
}

export interface BlindTransferCopyHeader {
  id: string;
  blindCopyNumber: string;
  intakeId: string;
  fromLocation: string;
  toLocation: string;
  createdBy?: string | null;
  issuedBy?: string | null;
  receivedBy?: string | null;
  issuedAt?: string | null;
  receivedAt?: string | null;
  status: string;
}

export interface BlindTransferCopyLine {
  productId: string;
  qty: number;
  unitOfMeasure: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
  destinationBin?: string | null;
}

import { getApiBase } from './api-base';

const API_BASE = getApiBase();
const TOKEN_KEY = 'kingg_token';
// Default to backend API mode. Direct Supabase access is opt-in only.
const USE_DIRECT_SUPABASE = isSupabaseConfigured && import.meta.env.VITE_USE_DIRECT_SUPABASE === 'true';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUnknownProp(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return obj[key];
}

function looksLikeUnauthorized(err: unknown): boolean {
  const status = readUnknownProp(err, 'statusCode') ?? readUnknownProp(err, 'status');
  if (status === 401) return true;

  const raw =
    typeof err === 'string'
      ? err
      : readUnknownProp(err, 'message') ?? readUnknownProp(err, 'error_description');
  const text = typeof raw === 'string' ? raw : String(raw ?? '');
  const lower = text.toLowerCase();
  return lower.includes('401') || lower.includes('unauthorized');
}

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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API ${res.status}`);
  }
  return res.json();
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API ${res.status}`);
  }
  return res.json();
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API ${res.status}`);
  }
  return res.json();
}

export type ProductInput = {
  name: string;
  barcode: string;
  category: string;
  basePrice: number;
  costPrice: number;
  sizeMl?: number | null;
};

/** Create product in database (owner / senior manager). */
export async function createProduct(input: ProductInput): Promise<ProductWithStock> {
  return apiPost<ProductWithStock>('/api/products', input);
}

/** Update product in database (owner / senior manager). */
export async function updateProduct(id: string, input: ProductInput): Promise<ProductWithStock> {
  return apiPut<ProductWithStock>(`/api/products/${encodeURIComponent(id)}`, input);
}

/** Delete product from database (owner / senior manager). */
export async function deleteProduct(id: string): Promise<{ ok: true; id: string; name: string }> {
  return apiDelete<{ ok: true; id: string; name: string }>(`/api/products/${encodeURIComponent(id)}`);
}

/** Subscribe to live product/inventory changes (Supabase realtime). */
export function subscribeToProductCatalog(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;

  const channel = supabase
    .channel('product-catalog-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Get product by barcode from backend or Supabase. */
export async function getProductByBarcode(barcode: string): Promise<ProductWithStock | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  if (USE_DIRECT_SUPABASE) {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,barcode,category,base_price,cost_price,size_ml,image,inventory(total_qty)')
      .eq('barcode', trimmed)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      barcode: data.barcode,
      category: data.category,
      basePrice: data.base_price,
      costPrice: data.cost_price,
      sizeMl: data.size_ml ?? undefined,
      image: data.image ?? undefined,
      stock: data.inventory?.[0]?.total_qty ?? 0,
    };
  }
  try {
    const product = await apiGet<ProductWithStock>(`/api/products/barcode/${encodeURIComponent(trimmed)}`);
    return product;
  } catch {
    return null;
  }
}

/** Search products from backend or Supabase. */
export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  if (USE_DIRECT_SUPABASE) {
    const q = query.trim();
    let req = supabase
      .from('products')
      .select('id,name,barcode,category,base_price,cost_price,size_ml,image,inventory(total_qty)')
      .limit(limit);
    if (q) req = req.or(`name.ilike.%${q}%,barcode.ilike.%${q}%,category.ilike.%${q}%`);
    const { data, error } = await req;
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      basePrice: p.base_price,
      costPrice: p.cost_price,
      sizeMl: p.size_ml ?? undefined,
      image: p.image ?? undefined,
      stock: p.inventory?.[0]?.total_qty ?? 0,
    }));
  }
  try {
    const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    return await apiGet<Product[]>(`/api/products/search?${params}`);
  } catch {
    return [];
  }
}

/** Get all products from backend or Supabase. */
export async function getAllProducts(): Promise<ProductWithStock[]> {
  if (USE_DIRECT_SUPABASE) {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id,name,barcode,category,base_price,cost_price,size_ml,image');
    if (pErr) throw new Error(pErr.message);
    const { data: inventoryRows, error: iErr } = await supabase
      .from('inventory')
      .select('product_id,total_qty');
    if (iErr) throw new Error(iErr.message);
    const stockMap = new Map((inventoryRows ?? []).map((r) => [r.product_id, r.total_qty]));
    return (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      basePrice: p.base_price,
      costPrice: p.cost_price,
      sizeMl: p.size_ml ?? undefined,
      image: p.image ?? undefined,
      stock: stockMap.get(p.id) ?? 0,
    }));
  }
  try {
    return await apiGet<ProductWithStock[]>('/api/products');
  } catch {
    return [];
  }
}

/** Lounge + warehouse stock balances for inventory screens. */
export async function getInventoryBalances(): Promise<InventoryBalance[]> {
  if (USE_DIRECT_SUPABASE) {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id,name,category,base_price,cost_price');
    if (pErr) throw new Error(pErr.message);

    const { data: invRows, error: iErr } = await supabase
      .from('inventory')
      .select('product_id,total_qty,lounge_qty,warehouse_qty');
    if (iErr) throw new Error(iErr.message);

    const invMap = new Map((invRows ?? []).map((r) => [r.product_id, r]));
    return (products ?? []).map((p) => {
      const inv = invMap.get(p.id);
      return {
        productId: p.id,
        productName: p.name,
        category: p.category,
        costPrice: Number(p.cost_price ?? 0),
        basePrice: Number(p.base_price ?? 0),
        loungeQty: Number(inv?.lounge_qty ?? 0),
        warehouseQty: Number(inv?.warehouse_qty ?? 0),
        totalQty: Number(inv?.total_qty ?? 0),
      };
    });
  }
  try {
    return await apiGet<InventoryBalance[]>('/api/inventory/balances');
  } catch {
    return [];
  }
}

/** Get categories from backend or Supabase. */
export async function getCategories(): Promise<string[]> {
  if (USE_DIRECT_SUPABASE) {
    const { data, error } = await supabase.from('products').select('category');
    if (error) throw new Error(error.message);
    const cats = Array.from(new Set((data ?? []).map((d) => d.category).filter(Boolean)));
    return ['All', ...cats];
  }
  try {
    return await apiGet<string[]>('/api/categories');
  } catch {
    return ['All'];
  }
}

/** Create sale; decrements stock on server, returns sale id and createdAt for receipt. Server uses authenticated user as cashier. */
export async function createSale(payload: SalePayload): Promise<{ id: string; createdAt: string }> {
  return apiPost<{ id: string; createdAt: string }>('/api/sales', payload);
}

type AuditWriteEntry = Omit<AuditEntry, 'id' | 'timestamp'> & {
  entityType?: string;
  entityId?: string;
  reasonCode?: string | null;
};

/** Write audit log; tries backend, then in-memory. */
export async function writeAuditLog(entry: AuditWriteEntry): Promise<void> {
  await apiPost('/api/audit', { ...entry, timestamp: new Date().toISOString() });
}

/** Void a sale and restore stock quantities. Requires void.approve permission. */
export async function voidSaleApi(saleId: string, reasonCode?: string): Promise<{ ok: true }> {
  if (USE_DIRECT_SUPABASE) {
    const { data: sale, error: saleError } = await supabase.from('sales').select('*').eq('id', saleId).single();
    if (saleError) throw new Error(saleError.message);
    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'void') throw new Error('Sale is already voided');

    const { data: items, error: itemsError } = await supabase.from('sale_items').select('*').eq('sale_id', saleId);
    if (itemsError) throw new Error(itemsError.message);

    for (const item of items ?? []) {
      const restoreQty = Math.max(0, Number(item.qty) || 0);
      if (restoreQty === 0) continue;

      const { data: inv, error: invError } = await supabase
        .from('inventory')
        .select('total_qty')
        .eq('product_id', item.product_id)
        .single();
      if (invError) throw new Error(invError.message);
      if (!inv) throw new Error(`Inventory row not found for product ${item.product_id}`);

      const { error: invUpdateError } = await supabase
        .from('inventory')
        .update({ total_qty: (inv.total_qty ?? 0) + restoreQty })
        .eq('product_id', item.product_id);
      if (invUpdateError) throw new Error(invUpdateError.message);
    }

    const { error: statusError } = await supabase.from('sales').update({ status: 'void' }).eq('id', saleId);
    if (statusError) throw new Error(statusError.message);

    await writeAuditLog({
      action: 'void.completed',
      actorId: String(sale.cashier_id),
      actorRole: null,
      entityType: 'sale',
      entityId: saleId,
      before: { status: sale.status, total: sale.total },
      after: { status: 'void' },
      reasonCode: reasonCode || null,
    });

    return { ok: true };
  }

  const res = await fetch(`${API_BASE}/api/sales/${encodeURIComponent(saleId)}/void`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ reasonCode: reasonCode || 'void_approved' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Void failed (${res.status})`);
  }
  return { ok: true };
}

/** Refund a sale (server-side). Requires refund.approve permission. */
export async function refundSaleApi(
  saleId: string,
  opts?: { amount?: number; reasonCode?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (USE_DIRECT_SUPABASE) {
    try {
      const { data: sale, error } = await supabase.from('sales').select('*').eq('id', saleId).single();
      if (error || !sale) return { ok: false, error: error?.message || 'Sale not found' };
      const { error: updErr } = await supabase.from('sales').update({ status: 'refunded' }).eq('id', saleId);
      if (updErr) return { ok: false, error: updErr.message };
      await writeAuditLog({
        action: 'refund.completed',
        actorId: String(sale.cashier_id),
        actorRole: null,
        entityType: 'sale',
        entityId: saleId,
        before: { status: 'completed', total: sale.total },
        after: { status: 'refunded', refundAmount: opts?.amount ?? sale.total },
        reasonCode: opts?.reasonCode || 'refund_approved',
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
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

/** Receive stock into lounge or warehouse (server-side). */
export async function receiveStockApi(
  payload: { productId: string; qty: number; location: 'lounge' | 'warehouse'; invoiceNumber?: string }
): Promise<{ ok: true; result: { total_qty: number; lounge_qty: number; warehouse_qty: number } }> {
  if (USE_DIRECT_SUPABASE) {
    const { data: inv, error } = await supabase
      .from('inventory')
      .select('total_qty,lounge_qty,warehouse_qty')
      .eq('product_id', payload.productId)
      .single();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error(`Inventory row not found for product ${payload.productId}`);

    const qty = Math.max(0, Number(payload.qty) || 0);
    const next = {
      total_qty: (inv.total_qty ?? 0) + qty,
      lounge_qty: (inv.lounge_qty ?? 0) + (payload.location === 'lounge' ? qty : 0),
      warehouse_qty: (inv.warehouse_qty ?? 0) + (payload.location === 'warehouse' ? qty : 0),
    };

    const { error: updErr } = await supabase.from('inventory').update(next).eq('product_id', payload.productId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, result: next };
  }

  const res = await fetch(`${API_BASE}/api/inventory/receive`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Receive failed (${res.status})`);
  }
  const body = (await res.json()) as {
    ok: boolean;
    after?: { total?: number; lounge?: number; warehouse?: number };
  };
  return {
    ok: true,
    result: {
      total_qty: Number(body.after?.total ?? 0),
      lounge_qty: Number(body.after?.lounge ?? 0),
      warehouse_qty: Number(body.after?.warehouse ?? 0),
    },
  };
}

export interface DeliveryIntakeApiPayload {
  id?: string;
  intakeNumber?: string;
  supplier: string;
  invoiceNumber: string;
  deliveryReference: string;
  deliveryDate: string;
  branchSite: string;
  receiveIntoLocation: ReceiveIntoLocation;
  receivedBy: string;
  notes?: string;
  status?: ReceivingStatus;
}

export interface DeliveryLineApiPayload {
  id?: string;
  productId: string;
  expectedQty: number;
  actualQty?: number;
  unitOfMeasure: string;
  unitCostOptional?: number | null;
  batchNumber?: string;
  expiryDate?: string;
  discrepancyReason?: string | null;
  decision?: 'accept' | 'reject' | 'hold';
  verificationNotes?: string;
  destinationLocation?: string;
}

export interface DeliveryIntakeApiResponse {
  header: DeliveryIntakeHeader;
  lines: DeliveryIntakeLine[];
}

export interface BlindCopyApiResponse {
  header: BlindTransferCopyHeader;
  lines: BlindTransferCopyLine[];
}

export async function saveIntakeDraftApi(payload: DeliveryIntakeApiPayload): Promise<DeliveryIntakeApiResponse> {
  if (USE_DIRECT_SUPABASE) {
    const row = {
      id: payload.id,
      intake_number: payload.intakeNumber,
      supplier: payload.supplier,
      invoice_number: payload.invoiceNumber,
      delivery_reference: payload.deliveryReference,
      delivery_date: payload.deliveryDate,
      branch_site: payload.branchSite,
      receive_into_location: payload.receiveIntoLocation,
      received_by: payload.receivedBy,
      notes: payload.notes ?? null,
      status: payload.status ?? 'draft',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = payload.id
      ? await supabase.from('delivery_intakes').update(row).eq('id', payload.id).select('*').single()
      : await supabase
          .from('delivery_intakes')
          .insert({
            ...row,
            created_at: new Date().toISOString(),
          })
          .select('*')
          .single();
    if (error) throw new Error(error.message);
    return {
      header: {
        id: data.id,
        intakeNumber: data.intake_number,
        supplier: data.supplier,
        invoiceNumber: data.invoice_number,
        deliveryReference: data.delivery_reference,
        deliveryDate: data.delivery_date,
        branchSite: data.branch_site ?? '',
        receiveIntoLocation: data.receive_into_location,
        receivedBy: data.received_by ?? '',
        notes: data.notes,
        status: data.status,
        confirmedAt: data.confirmed_at,
      },
      lines: [],
    };
  }
  if (payload.id) {
    const res = await fetch(`${API_BASE}/api/intakes/${encodeURIComponent(payload.id)}/draft`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update intake draft');
    return res.json();
  }
  const res = await fetch(`${API_BASE}/api/intakes/draft`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create intake draft');
  return res.json();
}

export async function saveExpectedLinesApi(intakeId: string, lines: DeliveryLineApiPayload[]): Promise<DeliveryIntakeApiResponse> {
  if (USE_DIRECT_SUPABASE) {
    const { error: delErr } = await supabase.from('delivery_intake_lines').delete().eq('intake_id', intakeId);
    if (delErr) throw new Error(delErr.message);
    const rows = lines.map((line) => ({
      id: line.id,
      intake_id: intakeId,
      product_id: line.productId,
      expected_qty: line.expectedQty,
      actual_qty: line.expectedQty,
      accepted_qty: line.expectedQty,
      rejected_qty: 0,
      held_qty: 0,
      unit_of_measure: line.unitOfMeasure,
      unit_cost_optional: line.unitCostOptional ?? null,
      batch_number: line.batchNumber ?? null,
      expiry_date: line.expiryDate ?? null,
      decision: 'accept',
      destination_location: line.destinationLocation ?? null,
    }));
    const { error: insErr } = await supabase.from('delivery_intake_lines').insert(rows);
    if (insErr) throw new Error(insErr.message);
    const { data: header, error: hErr } = await supabase
      .from('delivery_intakes')
      .update({ status: 'expected_captured', updated_at: new Date().toISOString() })
      .eq('id', intakeId)
      .select('*')
      .single();
    if (hErr) throw new Error(hErr.message);
    const { data: savedLines, error: lErr } = await supabase.from('delivery_intake_lines').select('*').eq('intake_id', intakeId);
    if (lErr) throw new Error(lErr.message);
    return {
      header: {
        id: header.id,
        intakeNumber: header.intake_number,
        supplier: header.supplier,
        invoiceNumber: header.invoice_number,
        deliveryReference: header.delivery_reference,
        deliveryDate: header.delivery_date,
        branchSite: header.branch_site ?? '',
        receiveIntoLocation: header.receive_into_location,
        receivedBy: header.received_by ?? '',
        notes: header.notes,
        status: header.status,
        confirmedAt: header.confirmed_at,
      },
      lines: (savedLines ?? []).map((line) => ({
        id: line.id,
        intakeId: line.intake_id,
        productId: line.product_id,
        expectedQty: line.expected_qty,
        actualQty: line.actual_qty,
        acceptedQty: line.accepted_qty,
        rejectedQty: line.rejected_qty,
        heldQty: line.held_qty,
        unitOfMeasure: line.unit_of_measure,
        unitCost: line.unit_cost_optional,
        batchNumber: line.batch_number,
        expiryDate: line.expiry_date,
        discrepancyReason: line.discrepancy_reason,
        decision: line.decision,
        verificationNotes: line.verification_notes,
        destination: line.destination_location,
      })),
    };
  }
  const res = await fetch(`${API_BASE}/api/intakes/${encodeURIComponent(intakeId)}/expected-lines`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) throw new Error('Failed to save expected lines');
  return res.json();
}

export async function saveVerificationApi(
  intakeId: string,
  lines: DeliveryLineApiPayload[],
  status: ReceivingStatus
): Promise<DeliveryIntakeApiResponse> {
  if (USE_DIRECT_SUPABASE) {
    for (const line of lines) {
      const acceptedQty = line.decision === 'accept' ? Math.max(0, Number(line.actualQty) || 0) : 0;
      const rejectedQty = line.decision === 'reject' ? Math.max(0, Number(line.actualQty) || 0) : 0;
      const heldQty = line.decision === 'hold' ? Math.max(0, Number(line.actualQty) || 0) : 0;
      const { error } = await supabase
        .from('delivery_intake_lines')
        .update({
          actual_qty: line.actualQty ?? line.expectedQty,
          accepted_qty: acceptedQty,
          rejected_qty: rejectedQty,
          held_qty: heldQty,
          discrepancy_reason: line.discrepancyReason ?? null,
          decision: line.decision ?? 'accept',
          verification_notes: line.verificationNotes ?? null,
          destination_location: line.destinationLocation ?? null,
        })
        .eq('id', line.id);
      if (error) throw new Error(error.message);
    }
    const { data: header, error: hErr } = await supabase
      .from('delivery_intakes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', intakeId)
      .select('*')
      .single();
    if (hErr) throw new Error(hErr.message);
    const { data: savedLines, error: lErr } = await supabase.from('delivery_intake_lines').select('*').eq('intake_id', intakeId);
    if (lErr) throw new Error(lErr.message);
    return {
      header: {
        id: header.id,
        intakeNumber: header.intake_number,
        supplier: header.supplier,
        invoiceNumber: header.invoice_number,
        deliveryReference: header.delivery_reference,
        deliveryDate: header.delivery_date,
        branchSite: header.branch_site ?? '',
        receiveIntoLocation: header.receive_into_location,
        receivedBy: header.received_by ?? '',
        notes: header.notes,
        status: header.status,
        confirmedAt: header.confirmed_at,
      },
      lines: (savedLines ?? []).map((line) => ({
        id: line.id,
        intakeId: line.intake_id,
        productId: line.product_id,
        expectedQty: line.expected_qty,
        actualQty: line.actual_qty,
        acceptedQty: line.accepted_qty,
        rejectedQty: line.rejected_qty,
        heldQty: line.held_qty,
        unitOfMeasure: line.unit_of_measure,
        unitCost: line.unit_cost_optional,
        batchNumber: line.batch_number,
        expiryDate: line.expiry_date,
        discrepancyReason: line.discrepancy_reason,
        decision: line.decision,
        verificationNotes: line.verification_notes,
        destination: line.destination_location,
      })),
    };
  }
  const res = await fetch(`${API_BASE}/api/intakes/${encodeURIComponent(intakeId)}/verification`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lines, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to save verification');
  }
  return res.json();
}

export async function confirmIntakeApi(intakeId: string): Promise<DeliveryIntakeApiResponse> {
  if (USE_DIRECT_SUPABASE) {
    const { data: lines, error: lErr } = await supabase.from('delivery_intake_lines').select('*').eq('intake_id', intakeId);
    if (lErr) throw new Error(lErr.message);
    for (const line of lines ?? []) {
      const accepted = Number(line.accepted_qty) || 0;
      if (accepted <= 0) continue;
      const { data: inv, error: invErr } = await supabase
        .from('inventory')
        .select('product_id,total_qty,lounge_qty,warehouse_qty')
        .eq('product_id', line.product_id)
        .single();
      if (invErr) throw new Error(invErr.message);
      const isBackStore = String(line.destination_location || '').toLowerCase().includes('back store');
      const next = {
        total_qty: (inv.total_qty ?? 0) + accepted,
        lounge_qty: (inv.lounge_qty ?? 0) + (isBackStore ? accepted : 0),
        warehouse_qty: (inv.warehouse_qty ?? 0) + (isBackStore ? 0 : accepted),
      };
      const { error: updErr } = await supabase.from('inventory').update(next).eq('product_id', line.product_id);
      if (updErr) throw new Error(updErr.message);
    }
    const { data: header, error: hErr } = await supabase
      .from('delivery_intakes')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', intakeId)
      .select('*')
      .single();
    if (hErr) throw new Error(hErr.message);
    const { data: savedLines, error: linesErr } = await supabase.from('delivery_intake_lines').select('*').eq('intake_id', intakeId);
    if (linesErr) throw new Error(linesErr.message);
    return {
      header: {
        id: header.id,
        intakeNumber: header.intake_number,
        supplier: header.supplier,
        invoiceNumber: header.invoice_number,
        deliveryReference: header.delivery_reference,
        deliveryDate: header.delivery_date,
        branchSite: header.branch_site ?? '',
        receiveIntoLocation: header.receive_into_location,
        receivedBy: header.received_by ?? '',
        notes: header.notes,
        status: header.status,
        confirmedAt: header.confirmed_at,
      },
      lines: (savedLines ?? []).map((line) => ({
        id: line.id,
        intakeId: line.intake_id,
        productId: line.product_id,
        expectedQty: line.expected_qty,
        actualQty: line.actual_qty,
        acceptedQty: line.accepted_qty,
        rejectedQty: line.rejected_qty,
        heldQty: line.held_qty,
        unitOfMeasure: line.unit_of_measure,
        unitCost: line.unit_cost_optional,
        batchNumber: line.batch_number,
        expiryDate: line.expiry_date,
        discrepancyReason: line.discrepancy_reason,
        decision: line.decision,
        verificationNotes: line.verification_notes,
        destination: line.destination_location,
      })),
    };
  }
  const res = await fetch(`${API_BASE}/api/intakes/${encodeURIComponent(intakeId)}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to confirm intake');
  }
  return res.json();
}

export async function generateBlindCopyApi(intakeId: string): Promise<BlindCopyApiResponse> {
  if (USE_DIRECT_SUPABASE) {
    const { data: intake, error: iErr } = await supabase.from('delivery_intakes').select('*').eq('id', intakeId).single();
    if (iErr) throw new Error(iErr.message);
    const { data: lines, error: lErr } = await supabase
      .from('delivery_intake_lines')
      .select('*')
      .eq('intake_id', intakeId)
      .gt('accepted_qty', 0);
    if (lErr) throw new Error(lErr.message);
    const blindCopyNumber = `BTC-${Date.now()}`;
    const { data: header, error: hErr } = await supabase
      .from('blind_transfer_copies')
      .insert({
        blind_copy_number: blindCopyNumber,
        intake_id: intakeId,
        from_location: 'Receiving Bay',
        to_location: intake.receive_into_location,
        status: 'generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (hErr) throw new Error(hErr.message);
    const blindLines = (lines ?? []).map((line) => ({
      blind_copy_id: header.id,
      product_id: line.product_id,
      qty: line.accepted_qty,
      unit_of_measure: line.unit_of_measure,
      batch_number: line.batch_number,
      expiry_date: line.expiry_date,
      destination_bin: line.destination_location,
    }));
    if (blindLines.length) {
      const { error: blErr } = await supabase.from('blind_transfer_copy_lines').insert(blindLines);
      if (blErr) throw new Error(blErr.message);
    }
    return {
      header: {
        id: header.id,
        blindCopyNumber: header.blind_copy_number,
        intakeId: header.intake_id,
        fromLocation: header.from_location,
        toLocation: header.to_location,
        createdBy: header.created_by_user_id,
        issuedBy: header.issued_by_user_id,
        receivedBy: header.received_by_user_id,
        issuedAt: header.issued_at,
        receivedAt: header.received_at,
        status: header.status,
      },
      lines: [],
    };
  }
  const res = await fetch(`${API_BASE}/api/intakes/${encodeURIComponent(intakeId)}/blind-copy`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to generate blind copy');
  }
  return res.json();
}

export async function issueBlindCopyApi(blindCopyId: string): Promise<BlindCopyApiResponse> {
  if (USE_DIRECT_SUPABASE) {
    const { data: header, error } = await supabase
      .from('blind_transfer_copies')
      .update({ status: 'issued', issued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', blindCopyId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      header: {
        id: header.id,
        blindCopyNumber: header.blind_copy_number,
        intakeId: header.intake_id,
        fromLocation: header.from_location,
        toLocation: header.to_location,
        createdBy: header.created_by_user_id,
        issuedBy: header.issued_by_user_id,
        receivedBy: header.received_by_user_id,
        issuedAt: header.issued_at,
        receivedAt: header.received_at,
        status: header.status,
      },
      lines: [],
    };
  }
  const res = await fetch(`${API_BASE}/api/blind-copies/${encodeURIComponent(blindCopyId)}/issue`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to issue blind copy');
  }
  return res.json();
}

export async function getIntakeByIdApi(intakeId: string): Promise<DeliveryIntakeApiResponse | null> {
  try {
    return await apiGet<DeliveryIntakeApiResponse>(`/api/intakes/${encodeURIComponent(intakeId)}`);
  } catch {
    return null;
  }
}

export async function getBlindCopyByIdApi(blindCopyId: string): Promise<BlindCopyApiResponse | null> {
  try {
    return await apiGet<BlindCopyApiResponse>(`/api/blind-copies/${encodeURIComponent(blindCopyId)}`);
  } catch {
    return null;
  }
}

/** Fetch all transactions from the database (real-time). Optional cashierId to filter. */
export async function getTransactionsFromApi(cashierId?: string | null): Promise<Transaction[]> {
  if (!USE_DIRECT_SUPABASE) {
    const params = new URLSearchParams();
    if (cashierId) params.set('cashierId', cashierId);
    const qs = params.toString();
    return apiGet<Transaction[]>(`/api/transactions${qs ? `?${qs}` : ''}`);
  }

  let salesReq = supabase.from('sales').select('*').order('created_at', { ascending: false });
  if (cashierId) salesReq = salesReq.eq('cashier_id', cashierId);

  const { data: sales, error: salesError } = await salesReq;
  if (salesError) throw new Error(salesError.message);

  const saleIds = (sales ?? []).map((sale) => sale.id);
  const { data: items, error: itemsError } = saleIds.length
    ? await supabase.from('sale_items').select('*').in('sale_id', saleIds)
    : { data: [], error: null };

  if (itemsError) throw new Error(itemsError.message);

  return (sales ?? []).map((sale) => ({
    id: sale.id,
    cashierId: sale.cashier_id,
    cashierName: sale.cashier_name,
    items: (items ?? [])
      .filter((item) => item.sale_id === sale.id)
      .map((item) => ({ productName: item.product_name, qty: item.qty, price: item.unit_price })),
    total: sale.total,
    paymentMethod: sale.payment_method,
    cashReceived: sale.cash_received ?? undefined,
    changeGiven: sale.change_given ?? undefined,
    status: sale.status,
    createdAt: sale.created_at,
  })) as Transaction[];
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
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const allowOfflineHelpMode = !token;
  if (allowOfflineHelpMode) {
    return saveHelpRequestLocal(payload);
  }

  if (!USE_DIRECT_SUPABASE) {
    return apiPost<{ id: string; createdAt: string }>('/api/help-requests', payload);
  }

  const id = `HR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const { error } = await supabase.from('help_requests').insert({
    id,
    cashier_id: payload.cashierId,
    cashier_name: payload.cashierName || payload.cashierId,
    message: payload.message || null,
    status: 'pending',
    created_at: createdAt,
    acknowledged_at: null,
    acknowledged_by: null,
  });

  if (error) throw new Error(error.message);
  return { id, createdAt };
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

export async function getHelpRequests(status?: string | null): Promise<HelpRequest[]> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const allowOfflineHelpMode = !token;
  if (allowOfflineHelpMode) {
    const local = getLocalHelpRequests();
    return status ? local.filter((r) => r.status === status) : local;
  }

  if (!USE_DIRECT_SUPABASE) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiGet<HelpRequest[]>(`/api/help-requests${query}`);
  }

  let req = supabase.from('help_requests').select('*').order('created_at', { ascending: false });
  if (status) req = req.eq('status', status);

  const { data, error } = await req;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    cashierId: r.cashier_id,
    cashierName: r.cashier_name,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at,
    acknowledgedBy: r.acknowledged_by,
  }));
}

export async function acknowledgeHelpRequest(id: string, acknowledgedBy: string): Promise<boolean> {
  if (id.startsWith('local-')) {
    removeLocalHelpRequest(id);
    return true;
  }

  if (!USE_DIRECT_SUPABASE) {
    const res = await fetch(`${API_BASE}/api/help-requests/${encodeURIComponent(id)}/acknowledge`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ acknowledgedBy }),
    });
    if (!res.ok) throw new Error('Failed to acknowledge help request');
    return true;
  }

  const { error } = await supabase
    .from('help_requests')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: acknowledgedBy,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}
