import { authHeaders } from './auth-api';
import { getApiBase } from './api-base';
import { friendlyErrorMessage } from '@/hooks/useAsyncAction';

export interface DeliveryRecord {
  id: string;
  poRef: string;
  supplier: string;
  invoiceRef: string | null;
  status: string;
  invoiceFileName: string | null;
  podFileName: string | null;
  hasInvoice: boolean;
  hasPod: boolean;
  createdAt: string;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    /* ignore */
  }
  return friendlyErrorMessage(new Error(`API ${res.status}`));
}

export async function fetchDeliveries(): Promise<DeliveryRecord[]> {
  const res = await fetch(`${getApiBase()}/api/deliveries`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createDeliveryRecord(payload: {
  poRef: string;
  supplier: string;
  invoiceRef?: string;
  invoiceFile: File;
  podFile: File;
}): Promise<DeliveryRecord> {
  const form = new FormData();
  form.append('poRef', payload.poRef);
  form.append('supplier', payload.supplier);
  if (payload.invoiceRef) form.append('invoiceRef', payload.invoiceRef);
  form.append('invoice', payload.invoiceFile);
  form.append('pod', payload.podFile);

  const headers = authHeaders();
  delete headers['Content-Type'];

  const res = await fetch(`${getApiBase()}/api/deliveries`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getDeliveryDocumentUrl(
  recordId: string,
  type: 'invoice' | 'pod'
): Promise<{ url: string; expiresIn: number }> {
  const res = await fetch(`${getApiBase()}/api/deliveries/${encodeURIComponent(recordId)}/documents/${type}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
