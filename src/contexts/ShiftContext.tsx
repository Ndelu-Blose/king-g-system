import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { Transaction } from '@/lib/mock-data';

const STORAGE_KEY = 'kingg_shift';

export interface CashUpRecord {
  counted: number;
  notes: string;
  expected: number;
  variance: number;
  endedAt: string;
}

/** One entry in the visible activity log (open shift, sale, end shift). */
export interface ActivityEntry {
  id: string;
  type: 'open' | 'close' | 'sale';
  at: string;
  message: string;
  details?: {
    total?: number;
    counted?: number;
    variance?: number;
    notes?: string;
    saleId?: string;
    paymentMethod?: string;
  };
}

interface ShiftState {
  isOpen: boolean;
  openedAt: string | null;
  expectedCash: number;
  lastCashUp: CashUpRecord | null;
  /** All actions you did: open, sales, close. Newest last. */
  activityLog: ActivityEntry[];
  /** Sales you made this session (so they show in Sales History). */
  sessionSales: Transaction[];
}

interface ShiftContextValue extends ShiftState {
  openShift: () => void;
  closeShift: (counted: number, notes: string) => void;
  setExpectedCash: (amount: number) => void;
  /** Call from POS when a sale is completed so it shows in your records. */
  recordSale: (params: {
    saleId: string;
    total: number;
    items: { productName: string; qty: number; price: number }[];
    paymentMethod: 'cash' | 'card';
    cashReceived?: number;
    changeGiven?: number;
    createdAt: string;
    cashierId: string;
    cashierName: string;
  }) => void;
}

const defaultState: ShiftState = {
  isOpen: false,
  openedAt: null,
  expectedCash: 0,
  lastCashUp: null,
  activityLog: [],
  sessionSales: [],
};

const ShiftContext = createContext<ShiftContextValue | undefined>(undefined);

function loadState(userId: string): ShiftState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      isOpen: parsed.isOpen ?? false,
      openedAt: parsed.openedAt ?? null,
      expectedCash: parsed.expectedCash ?? 0,
      lastCashUp: parsed.lastCashUp ?? null,
      activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : [],
      sessionSales: Array.isArray(parsed.sessionSales) ? parsed.sessionSales : [],
    };
  } catch {
    return defaultState;
  }
}

function saveState(userId: string, state: ShiftState) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function makeId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ShiftProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const [state, setState] = useState<ShiftState>(defaultState);

  useEffect(() => {
    if (userId) setState(loadState(userId));
    else setState(defaultState);
  }, [userId]);

  const openShift = useCallback(() => {
    const openedAt = new Date().toISOString();
    const entry: ActivityEntry = {
      id: makeId(),
      type: 'open',
      at: openedAt,
      message: 'Shift opened',
    };
    const next: ShiftState = {
      ...state,
      isOpen: true,
      openedAt,
      lastCashUp: null,
      activityLog: [...state.activityLog, entry],
    };
    setState(next);
    if (userId) saveState(userId, next);
  }, [state, userId]);

  const closeShift = useCallback(
    (counted: number, notes: string) => {
      const expected = state.expectedCash;
      const variance = counted - expected;
      const endedAt = new Date().toISOString();
      const lastCashUp: CashUpRecord = {
        counted,
        notes,
        expected,
        variance,
        endedAt,
      };
      const entry: ActivityEntry = {
        id: makeId(),
        type: 'close',
        at: endedAt,
        message: 'Shift ended / Cash-up',
        details: { counted, variance, notes },
      };
      const next: ShiftState = {
        ...defaultState,
        isOpen: false,
        openedAt: null,
        expectedCash: 0,
        lastCashUp,
        activityLog: [...state.activityLog, entry],
        sessionSales: state.sessionSales,
      };
      setState(next);
      if (userId) saveState(userId, next);
    },
    [state, userId]
  );

  const setExpectedCash = useCallback(
    (amount: number) => {
      const next = { ...state, expectedCash: amount };
      setState(next);
      if (userId) saveState(userId, next);
    },
    [state, userId]
  );

  const recordSale = useCallback(
    (params: {
      saleId: string;
      total: number;
      items: { productName: string; qty: number; price: number }[];
      paymentMethod: 'cash' | 'card';
      cashReceived?: number;
      changeGiven?: number;
      createdAt: string;
      cashierId: string;
      cashierName: string;
    }) => {
      const txn: Transaction = {
        id: params.saleId,
        cashierId: params.cashierId,
        cashierName: params.cashierName,
        items: params.items,
        total: params.total,
        paymentMethod: params.paymentMethod,
        cashReceived: params.cashReceived,
        changeGiven: params.changeGiven,
        status: 'completed',
        createdAt: params.createdAt,
      };
      const entry: ActivityEntry = {
        id: makeId(),
        type: 'sale',
        at: params.createdAt,
        message: `Sale ${params.saleId} — R${params.total.toFixed(2)}`,
        details: {
          saleId: params.saleId,
          total: params.total,
          paymentMethod: params.paymentMethod,
        },
      };
      const next: ShiftState = {
        ...state,
        sessionSales: [...state.sessionSales, txn],
        activityLog: [...state.activityLog, entry],
      };
      setState(next);
      if (userId) saveState(userId, next);
    },
    [state, userId]
  );

  const value: ShiftContextValue = {
    ...state,
    openShift,
    closeShift,
    setExpectedCash,
    recordSale,
  };

  return (
    <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>
  );
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (ctx === undefined) throw new Error('useShift must be used within ShiftProvider');
  return ctx;
}
