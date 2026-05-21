import type { Transaction } from './types';

export function summarizeTransactions(transactions: Transaction[]) {
  const totalSales = transactions.reduce((s, t) => s + t.total, 0);
  const transactionCount = transactions.length;
  const cashSales = transactions
    .filter((t) => t.paymentMethod === 'cash')
    .reduce((s, t) => s + t.total, 0);
  const cardSales = totalSales - cashSales;
  return {
    totalSales,
    transactionCount,
    avgTransaction: transactionCount ? totalSales / transactionCount : 0,
    cashSales,
    cardSales,
    pendingApprovals: 0,
    lowStockItems: 0,
    topProduct: '',
  };
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weeklySalesFromTransactions(transactions: Transaction[]) {
  const byDay = new Map<number, number>();
  for (let i = 0; i < 7; i++) byDay.set(i, 0);
  for (const t of transactions) {
    const d = new Date(t.createdAt).getDay();
    byDay.set(d, (byDay.get(d) ?? 0) + t.total);
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dayIndex) => ({
    day: DAY_LABELS[dayIndex],
    sales: byDay.get(dayIndex) ?? 0,
  }));
}

const CATEGORY_COLORS = [
  'hsl(32, 45%, 58%)',
  'hsl(38, 60%, 65%)',
  'hsl(220, 15%, 40%)',
  'hsl(142, 71%, 45%)',
  'hsl(220, 10%, 55%)',
  'hsl(220, 15%, 30%)',
];

export function categorySalesFromTransactions(transactions: Transaction[]) {
  const byCat = new Map<string, number>();
  for (const t of transactions) {
    for (const item of t.items) {
      const key = item.productName.split(' ')[0] || 'Other';
      byCat.set(key, (byCat.get(key) ?? 0) + item.qty * item.price);
    }
  }
  return Array.from(byCat.entries()).map(([category, value], i) => ({
    category,
    value,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));
}

export function transactionsInDateRange(
  transactions: Transaction[],
  dateFrom: string,
  dateTo: string
): Transaction[] {
  const fromStr = dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom;
  const toStr = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo;
  const from = new Date(fromStr + 'T00:00:00');
  const to = new Date(toStr + 'T23:59:59.999');
  return transactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= from && d <= to;
  });
}
