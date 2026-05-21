const SUPPLIERS_KEY = 'kingg_suppliers';

export type SupplierRecord = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  status: 'active' | 'inactive';
};

function load(): SupplierRecord[] {
  try {
    const raw = localStorage.getItem(SUPPLIERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: SupplierRecord[]) {
  try {
    localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getSuppliers(): SupplierRecord[] {
  return load();
}

export function addSupplier(input: { name: string; contact: string; phone: string }): SupplierRecord {
  const list = load();
  const record: SupplierRecord = {
    id: `s-${Date.now()}`,
    name: input.name.trim(),
    contact: input.contact.trim(),
    phone: input.phone.trim(),
    status: 'active',
  };
  list.push(record);
  save(list);
  return record;
}

export function getSupplierNames(): string[] {
  return load().map((s) => s.name);
}
