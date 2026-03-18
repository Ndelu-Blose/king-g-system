import { dailyStats, mockTransactions, mockInventory, mockProducts } from '@/lib/mock-data';

/** Escape a value for CSV (quotes if contains comma/newline). */
function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV string from rows (each row is array of cell values). */
function toCSV(rows: (string | number)[][]): string {
  return rows.map(row => row.map(cell => csvEscape(cell)).join(',')).join('\r\n');
}

/** Trigger browser download of a string as a file. */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function reportFilename(reportTitle: string, extension: string): string {
  const safe = reportTitle.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-${date}.${extension}`;
}

export type ReportSlug = string;

export function exportReportAsCSV(slug: ReportSlug, reportTitle: string): void {
  const filename = reportFilename(reportTitle, 'csv');
  const mime = 'text/csv;charset=utf-8;';

  switch (slug) {
    case 'daily-sales': {
      const rows: (string | number)[][] = [
        ['Daily Sales Summary', ''],
        ['Generated', new Date().toLocaleString()],
        [],
        ['Metric', 'Value'],
        ['Total sales (R)', dailyStats.totalSales],
        ['Transaction count', dailyStats.transactionCount],
        ['Avg transaction (R)', dailyStats.avgTransaction.toFixed(2)],
        ['Cash sales (R)', dailyStats.cashSales ?? ''],
        ['Card sales (R)', dailyStats.cardSales ?? ''],
        ['Top product', dailyStats.topProduct],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'cashier-performance': {
      const byCashier = new Map<string, { sales: number; count: number }>();
      for (const t of mockTransactions) {
        const cur = byCashier.get(t.cashierName) ?? { sales: 0, count: 0 };
        cur.sales += t.total;
        cur.count += 1;
        byCashier.set(t.cashierName, cur);
      }
      const rows: (string | number)[][] = [
        ['Cashier', 'Transactions', 'Total sales (R)'],
        ...Array.from(byCashier.entries()).map(([name, d]) => [name, d.count, d.sales.toFixed(2)]),
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'product-performance': {
      const productSales = new Map<string, number>();
      for (const t of mockTransactions) {
        for (const item of t.items) {
          const cur = productSales.get(item.productName) ?? 0;
          productSales.set(item.productName, cur + item.qty * item.price);
        }
      }
      const rows: (string | number)[][] = [
        ['Product', 'Category', 'Base price (R)', 'Total sales (R)'],
        ...mockProducts.map(p => [
          p.name,
          p.category,
          p.basePrice,
          (productSales.get(p.name) ?? 0).toFixed(2),
        ]),
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'stock-level': {
      const rows: (string | number)[][] = [
        ['Product', 'Category', 'Lounge qty', 'Warehouse qty', 'Total qty', 'Cost (R)', 'Base price (R)'],
        ...mockInventory.map(i => [
          i.productName,
          i.category,
          i.loungeQty,
          i.warehouseQty,
          i.totalQty,
          i.costPrice,
          i.basePrice,
        ]),
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'stock-movement': {
      const rows: (string | number)[][] = [
        ['Stock Movement Report'],
        ['Generated', new Date().toLocaleString()],
        [],
        ['From location', 'To location', 'Product', 'Quantity', 'Date'],
        ['—', '—', 'No transfer data', '—', '—'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'cash-reconciliation': {
      const rows: (string | number)[][] = [
        ['Cash Reconciliation'],
        ['Generated', new Date().toLocaleString()],
        [],
        ['Expected (R)', 'Actual (R)', 'Variance (R)', 'Notes'],
        [dailyStats.cashSales ?? 0, dailyStats.cashSales ?? 0, 0, 'Sample data'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'void-refund': {
      const voidRefund = mockTransactions.filter(t => t.status === 'void' || t.status === 'refunded');
      const rows: (string | number)[][] = [
        ['Transaction ID', 'Cashier', 'Total (R)', 'Status', 'Date'],
        ...voidRefund.map(t => [
          t.id,
          t.cashierName,
          t.total,
          t.status,
          new Date(t.createdAt).toLocaleString(),
        ]),
      ];
      if (voidRefund.length === 0) {
        rows.push(['No void or refund transactions in this period.']);
      }
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'supplier-variance': {
      const rows: (string | number)[][] = [
        ['Supplier Variance Report'],
        ['Generated', new Date().toLocaleString()],
        [],
        ['Supplier', 'Expected', 'Received', 'Variance', 'Date'],
        ['—', '—', '—', '—', 'No supplier delivery data'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    default: {
      const rows: (string | number)[][] = [
        [reportTitle],
        ['Generated', new Date().toLocaleString()],
        [],
        ['No export data defined for this report.'],
      ];
      downloadFile(toCSV(rows), filename, mime);
    }
  }
}
