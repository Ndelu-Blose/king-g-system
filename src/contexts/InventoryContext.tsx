import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { InventoryBalance } from '@/lib/types';
import {
  applyStockCountApi,
  getInventoryBalances,
  receiveStockApi,
  subscribeToProductCatalog,
  transferStockApi,
} from '@/lib/pos-api';

export type StockLocation = 'lounge' | 'warehouse';

type InventoryContextValue = {
  inventory: InventoryBalance[];
  loading: boolean;
  refreshInventory: () => Promise<void>;
  addWarehouseStock: (productId: string, qty: number) => Promise<void>;
  receiveStock: (productId: string, qty: number, location: StockLocation, invoiceNumber?: string) => Promise<void>;
  transferStock: (productId: string, qty: number, from: StockLocation, to: StockLocation) => Promise<void>;
  applyStockTake: (productId: string, newTotalQty: number) => Promise<void>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshInventory = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getInventoryBalances();
      setInventory(rows);
    } catch {
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  useEffect(() => {
    return subscribeToProductCatalog(() => {
      void refreshInventory();
    });
  }, [refreshInventory]);

  const addWarehouseStock = useCallback(async (productId: string, qty: number) => {
    if (qty <= 0) return;
    await receiveStockApi({ productId, qty, location: 'warehouse' });
    await refreshInventory();
  }, [refreshInventory]);

  const receiveStock = useCallback(async (
    productId: string,
    qty: number,
    location: StockLocation,
    invoiceNumber?: string
  ) => {
    if (qty <= 0) return;
    await receiveStockApi({ productId, qty, location, invoiceNumber });
    await refreshInventory();
  }, [refreshInventory]);

  const transferStock = useCallback(
    async (productId: string, qty: number, from: StockLocation, to: StockLocation) => {
      if (qty <= 0 || from === to) return;
      await transferStockApi({ productId, qty, from, to });
      await refreshInventory();
    },
    [refreshInventory]
  );

  const applyStockTake = useCallback(async (productId: string, newTotalQty: number) => {
    if (newTotalQty < 0) return;
    await applyStockCountApi(productId, newTotalQty);
    await refreshInventory();
  }, [refreshInventory]);

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        loading,
        refreshInventory,
        addWarehouseStock,
        receiveStock,
        transferStock,
        applyStockTake,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    return {
      inventory: [] as InventoryBalance[],
      loading: false,
      refreshInventory: async () => {},
      addWarehouseStock: async () => {},
      receiveStock: async () => {},
      transferStock: async () => {},
      applyStockTake: async () => {},
    };
  }
  return ctx;
}
