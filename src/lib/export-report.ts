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
  const generated = new Date().toLocaleString();

  switch (slug) {
    case 'daily-sales': {
      const rows: (string | number)[][] = [
        ['Daily Sales Summary', ''],
        ['Generated', generated],
        [],
        ['Metric', 'Value'],
        ['Total sales (R)', 0],
        ['Transaction count', 0],
        ['Avg transaction (R)', '0.00'],
        ['Cash sales (R)', 0],
        ['Card sales (R)', 0],
        ['Top product', ''],
        ['Note', 'No sales data in this export. Load live data from the app first.'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'cashier-performance': {
      const rows: (string | number)[][] = [
        ['Cashier', 'Transactions', 'Total sales (R)'],
        ['—', 0, '0.00'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'product-performance': {
      const rows: (string | number)[][] = [
        ['Product', 'Category', 'Base price (R)', 'Total sales (R)'],
        ['—', '—', '—', '0.00'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'stock-level': {
      const rows: (string | number)[][] = [
        ['Product', 'Category', 'Lounge qty', 'Warehouse qty', 'Total qty', 'Cost (R)', 'Base price (R)'],
        ['—', '—', 0, 0, 0, 0, 0],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'stock-movement': {
      const rows: (string | number)[][] = [
        ['Stock Movement Report'],
        ['Generated', generated],
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
        ['Generated', generated],
        [],
        ['Expected (R)', 'Actual (R)', 'Variance (R)', 'Notes'],
        [0, 0, 0, 'No reconciliation records'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'void-refund': {
      const rows: (string | number)[][] = [
        ['Transaction ID', 'Cashier', 'Total (R)', 'Status', 'Date'],
        ['No void or refund transactions in this period.'],
      ];
      downloadFile(toCSV(rows), filename, mime);
      break;
    }

    case 'supplier-variance': {
      const rows: (string | number)[][] = [
        ['Supplier Variance Report'],
        ['Generated', generated],
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
        ['Generated', generated],
        [],
        ['No export data defined for this report.'],
      ];
      downloadFile(toCSV(rows), filename, mime);
    }
  }
}
