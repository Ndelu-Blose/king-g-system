import { restoreToLounge, saleFromLounge, writeOffNext } from "../src/lib/stock-movement-view.js";

test("a sale takes stock from the lounge only", () => {
  expect(saleFromLounge({ lounge: 10, warehouse: 4, total: 14, qty: 2 })).toEqual({
    lounge: 8,
    warehouse: 4,
    total: 12,
    qty: 2,
  });
  expect(saleFromLounge({ lounge: 1, warehouse: 20, total: 21, qty: 2 }).error).toBe(
    "Not enough stock in the lounge"
  );
});

test("a void returns the units to the lounge", () => {
  expect(restoreToLounge({ lounge: 8, warehouse: 4, total: 12, qty: 2 })).toEqual({
    lounge: 10,
    warehouse: 4,
    total: 14,
    qty: 2,
  });
});


test("broken bottles leave the lounge and the total", () => {
  expect(writeOffNext({ lounge: 10, warehouse: 4, total: 14, location: "lounge", qty: 2 })).toEqual({
    lounge: 8,
    warehouse: 4,
    total: 12,
    qty: 2,
    location: "lounge",
  });
});

test("expired stock cannot remove more than that location holds", () => {
  expect(writeOffNext({ lounge: 1, warehouse: 6, total: 7, location: "warehouse", qty: 8 }).error).toBe(
    "Not enough stock in that location"
  );
});
