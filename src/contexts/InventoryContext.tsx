import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { mockInventory as initialInventory } from '@/lib/mock-data';
import type { InventoryBalance } from '@/lib/mock-data';

export type StockLocation = 'lounge' | 'warehouse';

type InventoryContextValue = {
  inventory: InventoryBalance[];
  addWarehouseStock: (productId: string, qty: number) => void;
  /** Receive stock into lounge or warehouse (e.g. delivery). */
  receiveStock: (productId: string, qty: number, location: StockLocation) => void;
  /** Move stock between lounge and warehouse. */
  transferStock: (productId: string, qty: number, from: StockLocation, to: StockLocation) => void;
  /** Apply stock take result: set total qty to counted (variance applied to warehouse). */
  applyStockTake: (productId: string, newTotalQty: number) => void;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryBalance[]>(() =>
    initialInventory.map((i) => ({ ...i }))
  );

  const addWarehouseStock = useCallback((productId: string, qty: number) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              warehouseQty: item.warehouseQty + qty,
              totalQty: item.loungeQty + item.warehouseQty + qty,
            }
          : item
      )
    );
  }, []);

  const receiveStock = useCallback((productId: string, qty: number, location: StockLocation) => {
    if (qty <= 0) return;
    setInventory((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const newLounge = location === 'lounge' ? item.loungeQty + qty : item.loungeQty;
        const newWarehouse = location === 'warehouse' ? item.warehouseQty + qty : item.warehouseQty;
        return {
          ...item,
          loungeQty: newLounge,
          warehouseQty: newWarehouse,
          totalQty: newLounge + newWarehouse,
        };
      })
    );
  }, []);

  const transferStock = useCallback(
    (productId: string, qty: number, from: StockLocation, to: StockLocation) => {
      if (qty <= 0 || from === to) return;
      setInventory((prev) =>
        prev.map((item) => {
          if (item.productId !== productId) return item;
          const fromQty = from === 'lounge' ? item.loungeQty : item.warehouseQty;
          if (fromQty < qty) return item;
          const newLounge =
            from === 'lounge' ? item.loungeQty - qty : to === 'lounge' ? item.loungeQty + qty : item.loungeQty;
          const newWarehouse =
            from === 'warehouse'
              ? item.warehouseQty - qty
              : to === 'warehouse'
                ? item.warehouseQty + qty
                : item.warehouseQty;
          return {
            ...item,
            loungeQty: newLounge,
            warehouseQty: newWarehouse,
            totalQty: newLounge + newWarehouse,
          };
        })
      );
    },
    []
  );

  const applyStockTake = useCallback((productId: string, newTotalQty: number) => {
    if (newTotalQty < 0) return;
    setInventory((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const diff = newTotalQty - item.totalQty;
        let newWarehouse = item.warehouseQty + diff;
        let newLounge = item.loungeQty;
        if (newWarehouse < 0) {
          newLounge = Math.max(0, item.loungeQty + newWarehouse);
          newWarehouse = 0;
        }
        const total = newLounge + newWarehouse;
        return {
          ...item,
          loungeQty: newLounge,
          warehouseQty: newWarehouse,
          totalQty: total,
        };
      })
    );
  }, []);

  return (
    <InventoryContext.Provider value={{ inventory, addWarehouseStock, receiveStock, transferStock, applyStockTake }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    return {
      inventory: initialInventory,
      addWarehouseStock: () => {},
      receiveStock: () => {},
      transferStock: () => {},
      applyStockTake: () => {},
    };
  }
  return ctx;
}
