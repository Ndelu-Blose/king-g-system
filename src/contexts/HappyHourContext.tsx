import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';

import { loadDiscountRules } from '@/lib/discount-rules-storage';

/** Returns true if current local time is within startTime–endTime (e.g. "17:00", "19:00"). Handles overnight (e.g. 22:00–02:00). */
function isWithinTimeWindow(startTime: string, endTime: string): boolean {
  const now = new Date();
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = (startTime || '00:00').split(':').map(Number);
  const [eh, em] = (endTime || '23:59').split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins <= startMins) {
    return minutesSinceMidnight >= startMins || minutesSinceMidnight < endMins;
  }
  return minutesSinceMidnight >= startMins && minutesSinceMidnight < endMins;
}

/** Per-product discount override: productId → discount % (0 = use global). */
type ProductDiscounts = Record<string, number>;

/** Happy hour: global discount and optional per-product overrides. Time-based window from Discount Rules is enforced. */
interface HappyHourContextValue {
  /** Global discount % (0–100). Applied to products that have no per-product discount. */
  discountPercent: number;
  setDiscountPercent: (percent: number) => void;
  /** Per-product discount % (productId → percent). 0 or unset = use global. */
  productDiscounts: ProductDiscounts;
  setProductDiscount: (productId: string, percent: number) => void;
  /** Get discount % for a product (per-product if set, else global; global only applied during happy hour if time-based enabled). */
  getDiscountForProduct: (productId?: string) => number;
  /** Price after discount. Uses per-product % when productId given and set, else global. */
  getEffectivePrice: (basePrice: number, productId?: string) => number;
  /** Whether any discount is active (global or any per-product). */
  isActive: boolean;
  /** True when time-based discount is enabled and current time is within the configured window. */
  isWithinHappyHourWindow: boolean;
  /** Configured happy hour window (e.g. "17:00 – 19:00") for display. */
  happyHourWindowLabel: string | null;
  /** Apply global % to all products (sets every product's per-product discount to current global). */
  applyGlobalToAllProducts: (productIds: string[]) => void;
  /** Clear all per-product discounts. */
  clearAllProductDiscounts: () => void;
}

const HappyHourContext = createContext<HappyHourContextValue | undefined>(undefined);

export function HappyHourProvider({ children }: { children: ReactNode }) {
  const [discountPercent, setDiscountPercentState] = useState(0);
  const [productDiscounts, setProductDiscountsState] = useState<ProductDiscounts>({});
  const [timeTick, setTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const setDiscountPercent = useCallback((percent: number) => {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    setDiscountPercentState(value);
  }, []);

  const setProductDiscount = useCallback((productId: string, percent: number) => {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    setProductDiscountsState((prev) => {
      if (value === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: value };
    });
  }, []);

  const getDiscountForProduct = useCallback(
    (productId?: string): number => {
      const rules = loadDiscountRules();
      const timeBased = rules.timeBasedEnabled && rules.startTime != null && rules.endTime != null;
      const inWindow = timeBased ? isWithinTimeWindow(rules.startTime, rules.endTime) : true;
      const selectedIds = rules.happyHourProductIds ?? [];

      if (productId && productDiscounts[productId] !== undefined && productDiscounts[productId] > 0) {
        return productDiscounts[productId];
      }
      if (timeBased) {
        if (!inWindow) return 0;
        if (selectedIds.length === 0) return 0;
        if (productId && !selectedIds.includes(productId)) return 0;
      }
      return discountPercent;
    },
    [discountPercent, productDiscounts]
  );

  const rules = useMemo(() => loadDiscountRules(), [discountPercent, productDiscounts, timeTick]);
  const isWithinHappyHourWindow =
    Boolean(rules.timeBasedEnabled && rules.startTime && rules.endTime) &&
    isWithinTimeWindow(rules.startTime, rules.endTime);
  const happyHourWindowLabel =
    rules.timeBasedEnabled && rules.startTime && rules.endTime
      ? `${rules.startTime} – ${rules.endTime}`
      : null;

  const getEffectivePrice = useCallback(
    (basePrice: number, productId?: string): number => {
      const percent = getDiscountForProduct(productId);
      if (percent <= 0) return basePrice;
      const discounted = basePrice * (1 - percent / 100);
      return Math.round(discounted * 100) / 100;
    },
    [getDiscountForProduct]
  );

  const isActive = discountPercent > 0 || Object.values(productDiscounts).some((p) => p > 0);

  const applyGlobalToAllProducts = useCallback((productIds: string[]) => {
    if (discountPercent <= 0) return;
    setProductDiscountsState((prev) => {
      const next = { ...prev };
      productIds.forEach((id) => (next[id] = discountPercent));
      return next;
    });
  }, [discountPercent]);

  const clearAllProductDiscounts = useCallback(() => {
    setProductDiscountsState({});
  }, []);

  const value: HappyHourContextValue = {
    discountPercent,
    setDiscountPercent,
    productDiscounts,
    setProductDiscount,
    getDiscountForProduct,
    getEffectivePrice,
    isActive,
    isWithinHappyHourWindow,
    happyHourWindowLabel,
    applyGlobalToAllProducts,
    clearAllProductDiscounts,
  };

  return (
    <HappyHourContext.Provider value={value}>{children}</HappyHourContext.Provider>
  );
}

export function useHappyHour() {
  const ctx = useContext(HappyHourContext);
  if (!ctx) throw new Error('useHappyHour must be used within HappyHourProvider');
  return ctx;
}
