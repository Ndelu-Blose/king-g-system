const DISCREPANCIES_KEY = 'kingg_discrepancies';
const INCIDENTS_KEY = 'kingg_incidents';
const MAX = 500;

export type DiscrepancyType = 'cash' | 'stock';

export interface DiscrepancyRecord {
  id: string;
  type: DiscrepancyType;
  /** For cash: amount in Rands. For stock: quantity or description. */
  amountOrQty: string;
  description: string;
  reportedAt: string;
  reportedBy?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedNotes?: string;
}

export interface IncidentRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  reportedAt: string;
  reportedBy?: string;
  location?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedNotes?: string;
}

function loadDiscrepancies(): DiscrepancyRecord[] {
  try {
    const raw = localStorage.getItem(DISCREPANCIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDiscrepancies(list: DiscrepancyRecord[]) {
  try {
    localStorage.setItem(DISCREPANCIES_KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // ignore
  }
}

function loadIncidents(): IncidentRecord[] {
  try {
    const raw = localStorage.getItem(INCIDENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIncidents(list: IncidentRecord[]) {
  try {
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // ignore
  }
}

export function getDiscrepancies(): DiscrepancyRecord[] {
  return loadDiscrepancies();
}

export function addDiscrepancy(
  input: Omit<DiscrepancyRecord, 'id' | 'reportedAt' | 'resolved'>
): DiscrepancyRecord {
  const list = loadDiscrepancies();
  const record: DiscrepancyRecord = {
    ...input,
    id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    reportedAt: new Date().toISOString(),
    resolved: false,
  };
  list.push(record);
  saveDiscrepancies(list);
  return record;
}

export function resolveDiscrepancy(id: string, resolvedNotes?: string): void {
  const list = loadDiscrepancies().map((r) =>
    r.id === id
      ? { ...r, resolved: true, resolvedAt: new Date().toISOString(), resolvedNotes }
      : r
  );
  saveDiscrepancies(list);
}

export function getIncidents(): IncidentRecord[] {
  return loadIncidents();
}

export function addIncident(
  input: Omit<IncidentRecord, 'id' | 'reportedAt' | 'resolved'>
): IncidentRecord {
  const list = loadIncidents();
  const record: IncidentRecord = {
    ...input,
    id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    reportedAt: new Date().toISOString(),
    resolved: false,
  };
  list.push(record);
  saveIncidents(list);
  return record;
}

export function resolveIncident(id: string, resolvedNotes?: string): void {
  const list = loadIncidents().map((r) =>
    r.id === id
      ? { ...r, resolved: true, resolvedAt: new Date().toISOString(), resolvedNotes }
      : r
  );
  saveIncidents(list);
}
