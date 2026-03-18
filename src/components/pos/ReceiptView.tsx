import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import type { ReceiptData } from '@/types/pos';

interface ReceiptViewProps {
  receipt: ReceiptData;
  onClose?: () => void;
  showPrintButton?: boolean;
}

/** Printable receipt content. Use ref + window.print() for printing. */
export function ReceiptView({ receipt, onClose, showPrintButton = true }: ReceiptViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const prevTitle = document.title;
    document.title = `Receipt ${receipt.saleId}`;
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    if (!win) {
      window.print();
      document.title = prevTitle;
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt ${receipt.saleId}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; max-width: 320px; margin: 0 auto; font-size: 14px; }
            h1 { font-size: 18px; margin: 0 0 8px 0; }
            .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { text-align: left; font-size: 11px; color: #666; border-bottom: 1px solid #eee; padding: 4px 0; }
            td { padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
            td.num { text-align: right; }
            .totals { margin-top: 12px; border-top: 2px solid #333; padding-top: 8px; }
            .totals div { display: flex; justify-content: space-between; margin: 4px 0; }
            .totals .grand { font-weight: bold; font-size: 16px; }
            .footer { margin-top: 24px; font-size: 11px; color: #666; text-align: center; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
    document.title = prevTitle;
  };

  const date = new Date(receipt.createdAt);
  const dateStr = date.toLocaleString('en-ZA', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-4">
      <div ref={printRef} className="bg-white text-black p-6 rounded-lg max-w-[320px] mx-auto receipt-content">
        <h1 className="text-lg font-bold border-b border-black/20 pb-2 mb-2">KING G</h1>
        <p className="text-xs text-gray-600 mb-4">Receipt #{receipt.saleId}</p>
        <p className="text-xs text-gray-600 mb-4">{dateStr}</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-1 font-medium">Item</th>
              <th className="text-right py-1 font-medium">Qty</th>
              <th className="text-right py-1 font-medium">Price</th>
              <th className="text-right py-1 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item) => (
              <tr key={`${item.productId}-${item.name}`} className="border-b border-gray-100">
                <td className="py-1.5">{item.name}</td>
                <td className="text-right py-1.5 tabular-nums">{item.qty}</td>
                <td className="text-right py-1.5 tabular-nums">R{item.unitPrice.toFixed(2)}</td>
                <td className="text-right py-1.5 tabular-nums">R{item.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals mt-4 pt-3 border-t-2 border-gray-800">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">R{receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>VAT (15%)</span>
            <span className="tabular-nums">R{receipt.vat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between grand mt-2">
            <span>Total</span>
            <span className="tabular-nums">R{receipt.total.toFixed(2)}</span>
          </div>
        </div>
        {receipt.payments.map((pay, i) => (
          <div key={i} className="mt-2 text-sm">
            <span className="capitalize">{pay.method}</span>: R{pay.amount.toFixed(2)}
            {pay.change != null && pay.change > 0 && (
              <span className="ml-2">Change: R{pay.change.toFixed(2)}</span>
            )}
          </div>
        ))}
        <p className="footer mt-6 text-center text-xs text-gray-500">Thank you for your purchase</p>
      </div>
      {showPrintButton && (
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            Print receipt
          </Button>
          {onClose && (
            <Button type="button" variant="secondary" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
