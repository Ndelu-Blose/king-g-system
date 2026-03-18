const STORAGE_KEY = 'kingg_shift_history';
const MAX_RECORDS = 200;

export interface ShiftHistoryRecord {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  notes: string;
}

function load(): ShiftHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(records: ShiftHistoryRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    // ignore
  }
}

export function getShiftHistory(): ShiftHistoryRecord[] {
  return load();
}

export function addShiftRecord(record: Omit<ShiftHistoryRecord, 'id'>): void {
  const list = load();
  const newRecord: ShiftHistoryRecord = {
    ...record,
    id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  };
  list.push(newRecord);
  save(list);
}
