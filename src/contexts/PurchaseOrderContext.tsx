import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useInventory } from '@/contexts/InventoryContext';

export type POLineItem = {
  productId: string;
  productName: string;
  orderedQty: number;
  deliveredQty?: number;
  expectedUnitCost: number;
};

export type PurchaseOrder = {
  id: string;
  supplierName: string;
  supplierId: string;
  status: 'draft' | 'sent' | 'received';
  total: number;
  createdAt: string;
  sentAt?: string;
  receivedAt?: string;
  orderInvoiceUrl?: string;
  deliveryInvoiceUrl?: string;
  items: POLineItem[];
  hasVariance?: boolean;
  varianceApprovalStatus?: 'pending' | 'approved' | 'rejected';
};

type PurchaseOrderContextValue = {
  orders: PurchaseOrder[];
  addOrder: (supplierId: string, supplierName: string) => PurchaseOrder;
  updateOrderItems: (poId: string, items: POLineItem[]) => void;
  sendPO: (poId: string) => void;
  receiveDelivery: (poId: string, deliveryInvoiceUrl: string, deliveredQtys: Record<string, number>) => Promise<{ hasVariance: boolean }>;
  approveVariance: (poId: string) => Promise<void>;
  rejectVariance: (poId: string) => void;
  getOrder: (poId: string) => PurchaseOrder | undefined;
};

const PurchaseOrderContext = createContext<PurchaseOrderContextValue | null>(null);

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const { addWarehouseStock } = useInventory();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const addOrder = useCallback((supplierId: string, supplierName: string) => {
    const id = `PO-${String(orders.length + 1).padStart(3, '0')}`;
    const newPo: PurchaseOrder = {
      id,
      supplierId,
      supplierName,
      status: 'draft',
      total: 0,
      createdAt: new Date().toISOString().slice(0, 19),
      items: [],
    };
    setOrders((prev) => [...prev, newPo]);
    return newPo;
  }, [orders.length]);

  const updateOrderItems = useCallback((poId: string, items: POLineItem[]) => {
    const total = items.reduce((sum, i) => sum + i.orderedQty * i.expectedUnitCost, 0);
    setOrders((prev) =>
      prev.map((o) => (o.id === poId ? { ...o, items, total } : o))
    );
  }, []);

  const sendPO = useCallback((poId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === poId
          ? { ...o, status: 'sent' as const, sentAt: new Date().toISOString().slice(0, 19) }
          : o
      )
    );
  }, []);

  const receiveDelivery = useCallback(
    async (poId: string, deliveryInvoiceUrl: string, deliveredQtys: Record<string, number>) => {
      const po = orders.find((o) => o.id === poId);
      if (!po) return { hasVariance: false };
      let hasVariance = false;
      const itemsWithDelivered: POLineItem[] = po.items.map((item) => {
        const delivered = deliveredQtys[item.productId] ?? 0;
        if (delivered !== item.orderedQty) hasVariance = true;
        return { ...item, deliveredQty: delivered };
      });
      if (!hasVariance) {
        for (const item of itemsWithDelivered) {
          const qty = item.deliveredQty ?? 0;
          if (qty > 0) await addWarehouseStock(item.productId, qty);
        }
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id !== poId
            ? o
            : {
                ...o,
                status: 'received' as const,
                receivedAt: new Date().toISOString().slice(0, 19),
                deliveryInvoiceUrl,
                items: itemsWithDelivered,
                hasVariance: hasVariance || undefined,
                varianceApprovalStatus: hasVariance ? ('pending' as const) : undefined,
              }
        )
      );
      return { hasVariance };
    },
    [orders, addWarehouseStock]
  );

  const approveVariance = useCallback(
    async (poId: string) => {
      const po = orders.find((o) => o.id === poId);
      if (!po || !po.hasVariance || po.varianceApprovalStatus !== 'pending') return;
      for (const item of po.items) {
        const qty = item.deliveredQty ?? 0;
        if (qty > 0) await addWarehouseStock(item.productId, qty);
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === poId ? { ...o, varianceApprovalStatus: 'approved' as const } : o
        )
      );
    },
    [orders, addWarehouseStock]
  );

  const rejectVariance = useCallback((poId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === poId ? { ...o, varianceApprovalStatus: 'rejected' as const } : o
      )
    );
  }, []);

  const getOrder = useCallback(
    (poId: string) => orders.find((o) => o.id === poId),
    [orders]
  );

  return (
    <PurchaseOrderContext.Provider
      value={{
        orders,
        addOrder,
        updateOrderItems,
        sendPO,
        receiveDelivery,
        approveVariance,
        rejectVariance,
        getOrder,
      }}
    >
      {children}
    </PurchaseOrderContext.Provider>
  );
}

export function usePurchaseOrders() {
  const ctx = useContext(PurchaseOrderContext);
  if (!ctx) throw new Error('usePurchaseOrders must be used within PurchaseOrderProvider');
  return ctx;
}

