import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { getProductByBarcode } from '@/lib/pos-api';
import { useHappyHour } from '@/contexts/HappyHourContext';
import type { CartLine, Product, ProductWithStock } from '@/types/pos';

export interface LastScanned {
  name: string;
  qty: number;
  unitPrice: number;
}

interface CartContextValue {
  cart: CartLine[];
  selectedLineId: string | null;
  lastScanned: LastScanned | null;
  setSelectedLineId: (id: string | null) => void;
  addByBarcode: (
    barcode: string,
    options?: { allowZeroStock?: boolean }
  ) => Promise<{ success: true; product: ProductWithStock } | { success: false; reason: 'not_found' | 'out_of_stock' }>;
  addProduct: (product: Product | ProductWithStock, qty?: number) => void;
  updateQty: (productId: string, delta: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  total: number;
  /** Ref to the scan input so we can refocus after add. Set by POS. */
  scanInputRef: React.RefObject<HTMLInputElement | null>;
  setScanInputRef: (ref: React.RefObject<HTMLInputElement | null>) => void;
  /** Focus the scan input (e.g. F2). */
  focusScanInput: () => void;
}

const emptyRef = { current: null as HTMLInputElement | null };

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { getEffectivePrice } = useHappyHour();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<LastScanned | null>(null);
  const [scanInputRefState, setScanInputRefState] = useState<React.RefObject<HTMLInputElement | null>>(emptyRef);
  const scanInputRef = scanInputRefState;

  const setScanInputRef = useCallback((ref: React.RefObject<HTMLInputElement | null>) => {
    setScanInputRefState(ref);
  }, []);

  const refocusScan = useCallback(() => {
    setTimeout(() => scanInputRef.current?.focus({ preventScroll: true }), 0);
  }, [scanInputRef]);

  const focusScanInput = useCallback(() => {
    scanInputRef.current?.focus({ preventScroll: true });
  }, [scanInputRef]);

  const addByBarcode = useCallback(
    async (
      barcode: string,
      options?: { allowZeroStock?: boolean }
    ): Promise<{ success: true; product: ProductWithStock } | { success: false; reason: 'not_found' | 'out_of_stock' }> => {
      const product = await getProductByBarcode(barcode);
      if (!product) return { success: false, reason: 'not_found' };
      const stock = product.stock ?? 0;
      if (stock <= 0 && !options?.allowZeroStock) return { success: false, reason: 'out_of_stock' };

      const unitPrice = getEffectivePrice(product.basePrice, product.id);
      setCart(prev => {
        const existing = prev.find(c => c.product.id === product.id);
        const addQty = 1;
        if (existing) {
          return prev.map(c =>
            c.product.id === product.id
              ? { ...c, qty: c.qty + addQty, unitPrice }
              : c
          );
        }
        return [
          ...prev,
          {
            product: { ...product },
            qty: addQty,
            unitPrice,
          },
        ];
      });
      setLastScanned({ name: product.name, qty: 1, unitPrice });
      refocusScan();
      return { success: true, product };
    },
    [refocusScan, getEffectivePrice]
  );

  const addProduct = useCallback((product: Product | ProductWithStock, qty = 1) => {
    const unitPrice = getEffectivePrice(product.basePrice, product.id);
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        return prev.map(c =>
          c.product.id === product.id
            ? { ...c, qty: c.qty + qty, unitPrice }
            : c
        );
      }
      return [
        ...prev,
        {
          product: { ...product },
          qty,
          unitPrice,
        },
      ];
    });
    setLastScanned({ name: product.name, qty, unitPrice });
    refocusScan();
  }, [refocusScan, getEffectivePrice]);

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev.map(c =>
        c.product.id === productId
          ? { ...c, qty: Math.max(0, c.qty + delta) }
          : c
      ).filter(c => c.qty > 0)
    );
    setSelectedLineId(prev => (prev === productId ? null : prev));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
    setSelectedLineId(prev => (prev === productId ? null : prev));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedLineId(null);
    setLastScanned(null);
    refocusScan();
  }, [refocusScan]);

  const total = cart.reduce((sum, c) => sum + c.unitPrice * c.qty, 0);

  const value: CartContextValue = {
    cart,
    selectedLineId,
    lastScanned,
    setSelectedLineId,
    addByBarcode,
    addProduct,
    updateQty,
    removeItem,
    clearCart,
    total,
    scanInputRef,
    setScanInputRef,
    focusScanInput,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
