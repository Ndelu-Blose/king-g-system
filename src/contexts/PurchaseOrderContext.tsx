import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { mockProducts } from '@/lib/mock-data';
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

const initialOrders: PurchaseOrder[] = [
  {
    id: 'PO-001',
    supplierName: 'SA Breweries',
    supplierId: 's1',
    status: 'sent',
    total: 2450,
    createdAt: '2026-02-18T09:00:00',
    sentAt: '2026-02-18T09:30:00',
    items: [
      { productId: '9', productName: 'Castle Lager 340ml', orderedQty: 50, expectedUnitCost: 12 },
      { productId: '10', productName: 'Heineken 330ml', orderedQty: 24, expectedUnitCost: 15 },
    ],
  },
  {
    id: 'PO-002',
    supplierName: 'Pernod Ricard SA',
    supplierId: 's3',
    status: 'received',
    total: 3200,
    createdAt: '2026-02-17T14:00:00',
    sentAt: '2026-02-17T15:00:00',
    receivedAt: '2026-02-19T10:00:00',
    items: [
      { productId: '11', productName: 'Jack Daniels', orderedQty: 12, deliveredQty: 12, expectedUnitCost: 26 },
      { productId: '4', productName: 'Grey Goose Vodka', orderedQty: 12, deliveredQty: 12, expectedUnitCost: 22 },
    ],
    hasVariance: false,
  },
  {
    id: 'PO-003',
    supplierName: 'Distell Group',
    supplierId: 's2',
    status: 'draft',
    total: 432,
    createdAt: '2026-02-20T08:30:00',
    items: [
      { productId: '12', productName: 'Amarula Cream', orderedQty: 24, expectedUnitCost: 18 },
    ],
  },
];

type PurchaseOrderContextValue = {
  orders: PurchaseOrder[];
  addOrder: (supplierId: string, supplierName: string) => PurchaseOrder;
  updateOrderItems: (poId: string, items: POLineItem[]) => void;
  sendPO: (poId: string) => void;
  receiveDelivery: (poId: string, deliveryInvoiceUrl: string, deliveredQtys: Record<string, number>) => { hasVariance: boolean };
  approveVariance: (poId: string) => void;
  rejectVariance: (poId: string) => void;
  getOrder: (poId: string) => PurchaseOrder | undefined;
};

const PurchaseOrderContext = createContext<PurchaseOrderContextValue | null>(null);

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const { addWarehouseStock } = useInventory();
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);

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
    (poId: string, deliveryInvoiceUrl: string, deliveredQtys: Record<string, number>) => {
      const po = orders.find((o) => o.id === poId);
      if (!po) return { hasVariance: false };
      let hasVariance = false;
      const itemsWithDelivered: POLineItem[] = po.items.map((item) => {
        const delivered = deliveredQtys[item.productId] ?? 0;
        if (delivered !== item.orderedQty) hasVariance = true;
        return { ...item, deliveredQty: delivered };
      });
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
      if (!hasVariance) {
        itemsWithDelivered.forEach((item) => {
          const qty = item.deliveredQty ?? 0;
          if (qty > 0) addWarehouseStock(item.productId, qty);
        });
      }
      return { hasVariance };
    },
    [orders, addWarehouseStock]
  );

  const approveVariance = useCallback(
    (poId: string) => {
      setOrders((prev) => {
        const po = prev.find((o) => o.id === poId);
        if (!po || !po.hasVariance || po.varianceApprovalStatus !== 'pending') return prev;
        po.items.forEach((item) => {
          const qty = item.deliveredQty ?? 0;
          if (qty > 0) addWarehouseStock(item.productId, qty);
        });
        return prev.map((o) =>
          o.id === poId ? { ...o, varianceApprovalStatus: 'approved' as const } : o
        );
      });
    },
    [addWarehouseStock]
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

export { mockProducts as poProductList };
