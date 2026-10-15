/** A sale is poured in the lounge. Warehouse stock is untouched. */
export function saleFromLounge({ lounge, warehouse, total, qty }) {
  const n = Math.floor(Number(qty) || 0);
  if (n <= 0) return { error: "Invalid quantity" };
  const have = Number(lounge) || 0;
  if (have < n) return { error: "Not enough stock in the lounge" };
  return {
    lounge: have - n,
    warehouse: Number(warehouse) || 0,
    total: Math.max(0, (Number(total) || 0) - n),
    qty: n,
  };
}

/** A void puts the sold units back in the lounge. */
export function restoreToLounge({ lounge, warehouse, total, qty }) {
  const n = Math.floor(Number(qty) || 0);
  return {
    lounge: (Number(lounge) || 0) + n,
    warehouse: Number(warehouse) || 0,
    total: (Number(total) || 0) + n,
    qty: n,
  };
}

/** Reasons that remove stock without a sale. The label is what staff see later. */
export const WRITE_OFF_REASONS = {
  expired: "Expired",
  broken: "Broken bottle",
};

/**
 * Units removed from one location, and from the total.
 * Lounge and warehouse are what the stock screens show; total must fall too.
 */
export function writeOffNext({ lounge, warehouse, total, location, qty }) {
  const n = Math.floor(Number(qty) || 0);
  const loc = String(location || "").toLowerCase();
  if (n <= 0) return { error: "Invalid quantity" };
  if (loc !== "lounge" && loc !== "warehouse") return { error: "Choose lounge or warehouse" };
  const have = loc === "lounge" ? Number(lounge) || 0 : Number(warehouse) || 0;
  if (have < n) return { error: "Not enough stock in that location" };
  const nextLounge = (Number(lounge) || 0) - (loc === "lounge" ? n : 0);
  const nextWarehouse = (Number(warehouse) || 0) - (loc === "warehouse" ? n : 0);
  return {
    lounge: nextLounge,
    warehouse: nextWarehouse,
    total: Math.max(0, (Number(total) || 0) - n),
    qty: n,
    location: loc,
  };
}
