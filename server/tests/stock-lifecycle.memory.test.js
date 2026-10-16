import { jest } from "@jest/globals";

// In-process stock ledger. Updates land only when the quantities still match
// the ones that were read, same rule as the live inventory save.
function createStore() {
  const inventory = new Map();
  const products = new Map();
  const movements = [];
  const sales = [];
  const saleItems = [];
  let movementId = 1;

  function matches(row, filters) {
    return filters.every(([column, value, op]) => {
      if (op === "in") return value.includes(row[column]);
      return row[column] === value;
    });
  }

  function from(table) {
    const filters = [];
    let action = "select";
    let payload = null;
    const api = {
      select() {
        return api;
      },
      insert(row) {
        action = "insert";
        payload = row;
        return api;
      },
      update(row) {
        action = "update";
        payload = row;
        return api;
      },
      eq(column, value) {
        filters.push([column, value, "eq"]);
        return api;
      },
      in(column, value) {
        filters.push([column, value, "in"]);
        return api;
      },
      order() {
        return api;
      },
      maybeSingle() {
        return run(true);
      },
      then(resolve, reject) {
        return run(false).then(resolve, reject);
      },
    };

    function run(single) {
      return Promise.resolve().then(async () => {
        if (table === "inventory" && action === "update") {
          await new Promise((resolve) => setTimeout(resolve, 4));
          const id = filters.find(([column]) => column === "product_id")?.[1];
          const row = inventory.get(id);
          if (!row || !matches(row, filters)) return { data: [], error: null };
          Object.assign(row, payload);
          return { data: [{ product_id: id }], error: null };
        }
        if (action === "insert") {
          const rows = Array.isArray(payload) ? payload : [payload];
          if (table === "stock_movements") {
            for (const row of rows) movements.push({ id: movementId++, ...row });
          } else if (table === "sales") sales.push(...rows);
          else if (table === "sale_items") saleItems.push(...rows);
          return { data: null, error: null };
        }
        if (table === "inventory") {
          const id = filters.find(([column]) => column === "product_id")?.[1];
          const row = inventory.get(id);
          const data = row ? { ...row } : null;
          return { data: single ? data : data ? [data] : [], error: null };
        }
        if (table === "products") {
          const id = filters.find(([column]) => column === "id")?.[1];
          return { data: products.get(id) ?? null, error: null };
        }
        if (table === "sales") {
          const key = filters.find(([column]) => column === "idempotency_key")?.[1];
          const row = sales.find((sale) => sale.idempotency_key === key);
          return { data: row ? { id: row.id, created_at: row.created_at } : null, error: null };
        }
        return { data: single ? null : [], error: null };
      });
    }

    return api;
  }

  return {
    from,
    inventory,
    products,
    movements,
    sales,
    saleItems,
    seed(id, { lounge = 0, warehouse = 0, total = lounge + warehouse, name = id } = {}) {
      products.set(id, { id, name });
      inventory.set(id, { product_id: id, lounge_qty: lounge, warehouse_qty: warehouse, total_qty: total });
    },
  };
}

const store = createStore();

jest.unstable_mockModule("../src/lib/supabase.js", () => ({
  getSupabaseAdmin: () => store,
}));

const { applyStockCount, createSale, receiveStock, transferStock, writeOffStock } = await import("../src/services/pos.service.js");

function balances(productId) {
  const row = store.inventory.get(productId);
  return { lounge: row.lounge_qty, warehouse: row.warehouse_qty, total: row.total_qty };
}

function saleBody(productId, qty, key) {
  const total = qty * 10;
  return {
    idempotencyKey: key,
    cashierId: "stock-cashier",
    items: [{ productId, name: "Bottle", qty, unitPrice: 10, lineTotal: total }],
    subtotal: total,
    vat: 0,
    total,
    payments: [{ method: "card", amount: total }],
  };
}

describe("stock lifecycle under load", () => {
  it("moves a bottle from arrival to a write-off, a transfer, and a sale", async () => {
    const productId = "life-1";
    store.seed(productId, { name: "Stress bottle" });

    const arrived = await receiveStock(productId, 30, "warehouse", { actorId: "stock-owner", actorRole: "owner" });
    expect(arrived.ok).toBe(true);

    await expect(createSale(saleBody(productId, 1, "too-soon"), "Cashier")).rejects.toThrow(/lounge/i);

    const moved = await transferStock(productId, 12, "warehouse", "lounge", { actorId: "stock-owner", actorRole: "owner" });
    expect(moved.ok).toBe(true);

    const expired = await writeOffStock(productId, 4, "warehouse", "expired", { actorId: "stock-owner", actorRole: "owner" });
    const broken = await writeOffStock(productId, 2, "lounge", "broken", { actorId: "stock-owner", actorRole: "owner" });
    expect(expired.ok).toBe(true);
    expect(broken.ok).toBe(true);

    const sold = await createSale(saleBody(productId, 5, "sold-5"), "Cashier");
    expect(sold.created).toBe(true);

    expect(balances(productId)).toEqual({ lounge: 5, warehouse: 14, total: 19 });
    const types = store.movements.filter((row) => row.product_id === productId).map((row) => row.type);
    expect(types).toEqual(["RECEIPT", "TRANSFER", "ADJUSTMENT", "ADJUSTMENT", "SALE"]);

    const counted = await applyStockCount(productId, 10, { actorId: "stock-owner", actorRole: "owner" });
    expect(counted.ok).toBe(true);
    expect(balances(productId)).toEqual({ lounge: 5, warehouse: 5, total: 10 });
    expect(store.movements.filter((row) => row.product_id === productId && row.type === "COUNT")).toHaveLength(1);
  });

  it("keeps lounge, warehouse, and the total straight when moves and sales overlap", async () => {
    const productId = "burst-1";
    store.seed(productId, { name: "Stress burst" });
    const arrived = await receiveStock(productId, 200, "warehouse", { actorId: "stock-owner", actorRole: "owner" });
    expect(arrived.ok).toBe(true);

    const moves = await Promise.all(
      Array.from({ length: 20 }, () =>
        transferStock(productId, 5, "warehouse", "lounge", { actorId: "stock-owner", actorRole: "owner" })
      )
    );
    expect(moves.every((result) => result.ok)).toBe(true);

    const sales = await Promise.all(
      Array.from({ length: 20 }, (_, index) => createSale(saleBody(productId, 2, `burst-${index}`), "Cashier"))
    );
    expect(sales.every((result) => result.created)).toBe(true);

    expect(balances(productId)).toEqual({ lounge: 60, warehouse: 100, total: 160 });
    const rows = store.movements.filter((row) => row.product_id === productId);
    expect(rows.filter((row) => row.type === "TRANSFER")).toHaveLength(20);
    expect(rows.filter((row) => row.type === "SALE")).toHaveLength(20);
    expect(rows.filter((row) => row.type === "SALE").every((row) => row.from_location === "lounge")).toBe(true);
  });
});
