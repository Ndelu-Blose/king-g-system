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
            .item { padding: 8px 0; border-bottom: 1px solid #eee; }
            .item-name { font-weight: 600; }
            .row { display: flex; justify-content: space-between; gap: 16px; margin-top: 2px; }
            .row span:last-child { white-space: nowrap; }
            .totals { margin-top: 12px; border-top: 2px solid #333; padding-top: 8px; }
            .totals .row { margin: 4px 0; }
            .grand { font-weight: bold; font-size: 16px; }
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
        <div className="text-sm">
          {receipt.items.map((item) => (
            <div key={`${item.productId}-${item.name}`} className="item border-b border-gray-200 py-2">
              <p className="item-name font-medium">{item.name}</p>
              <div className="row flex items-baseline justify-between gap-4">
                <span className="text-gray-700">
                  {item.qty} × R{item.unitPrice.toFixed(2)}
                </span>
                <span className="tabular-nums whitespace-nowrap">R{item.lineTotal.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="totals mt-4 pt-3 border-t-2 border-gray-800 text-sm">
          <div className="row flex justify-between gap-4">
            <span>Subtotal</span>
            <span className="tabular-nums whitespace-nowrap">R{receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="row flex justify-between gap-4 mt-1">
            <span>{receipt.vat > 0 ? 'VAT (15%)' : 'VAT'}</span>
            <span className="tabular-nums whitespace-nowrap">
              {receipt.vat > 0 ? `R${receipt.vat.toFixed(2)}` : 'Not added'}
            </span>
          </div>
          <div className="row grand mt-2 flex justify-between gap-4 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums whitespace-nowrap">R{receipt.total.toFixed(2)}</span>
          </div>
        </div>
        {receipt.payments.map((pay, i) => (
          <div key={i} className="mt-3 text-sm space-y-1">
            {pay.method === 'cash' ? (
              <div className="row flex justify-between gap-4">
                <span>Cash received</span>
                <span className="tabular-nums whitespace-nowrap">R{(pay.cashReceived ?? pay.amount).toFixed(2)}</span>
              </div>
            ) : (
              <div className="row flex justify-between gap-4">
                <span className="capitalize">{pay.method}</span>
                <span className="tabular-nums whitespace-nowrap">R{pay.amount.toFixed(2)}</span>
              </div>
            )}
            {pay.change != null && pay.change > 0 && (
              <div className="row flex justify-between gap-4 font-medium">
                <span>Change</span>
                <span className="tabular-nums whitespace-nowrap">R{pay.change.toFixed(2)}</span>
              </div>
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
