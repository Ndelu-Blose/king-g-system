import { useState, useCallback, useMemo } from 'react';
import { CreditCard, Banknote, Building2, Receipt, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCart } from '@/contexts/CartContext';
import { useShift } from '@/contexts/ShiftContext';
import { useAuth } from '@/lib/auth-context';
import { createSale } from '@/lib/pos-api';
import { VAT_RATE } from '@/lib/pos-constants';
import { ReceiptView } from '@/components/pos/ReceiptView';
import type { PaymentMethod, ReceiptData } from '@/types/pos';
import { cn } from '@/lib/utils';

const QUICK_CASH = [50, 100, 200, 500];

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'method' | 'cash' | 'card' | 'eft' | 'split' | 'complete';

export function PaymentModal({ open, onClose, onSuccess }: PaymentModalProps) {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const recordSaleToShift = useShift().recordSale;
  const [step, setStep] = useState<Step>('method');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const subtotal = useMemo(() => cart.reduce((sum, c) => sum + c.unitPrice * c.qty, 0), [cart]);
  const vat = useMemo(() => Math.round(subtotal * VAT_RATE * 100) / 100, [subtotal]);
  const grandTotal = useMemo(() => Math.round((subtotal + vat) * 100) / 100, [subtotal, vat]);

  const cashNum = parseFloat(cashReceived) || 0;
  const change = cashNum >= grandTotal ? cashNum - grandTotal : 0;

  const handleClose = useCallback(() => {
    if (paymentComplete && receiptData) return;
    setStep('method');
    setCashReceived('');
    setReceiptData(null);
    onClose();
  }, [onClose, paymentComplete, receiptData]);

  const completeSale = useCallback(
    async (method: PaymentMethod, amount: number, cashReceivedAmount?: number, changeAmount?: number) => {
      if (!user?.id || cart.length === 0) return;
      const items = cart.map((c) => ({
        productId: c.product.id,
        barcode: c.product.barcode,
        sku: c.product.sku,
        name: c.product.name,
        qty: c.qty,
        unitPrice: c.unitPrice,
        lineTotal: c.unitPrice * c.qty,
      }));
      const { id, createdAt } = await createSale({
        cashierId: user.id,
        cashierName: user.name,
        items,
        subtotal,
        vat,
        total: grandTotal,
        payments: [
          {
            method,
            amount,
            ...(method === 'cash' && {
              cashReceived: cashReceivedAmount ?? amount,
              change: changeAmount ?? 0,
            }),
          },
        ],
      });
      recordSaleToShift({
        saleId: id,
        total: grandTotal,
        items: items.map((i) => ({ productName: i.name, qty: i.qty, price: i.unitPrice })),
        paymentMethod: (method === 'cash' ? 'cash' : 'card') as 'cash' | 'card',
        ...(method === 'cash' && {
          cashReceived: cashReceivedAmount ?? amount,
          changeGiven: changeAmount ?? 0,
        }),
        createdAt,
        cashierId: user.id,
        cashierName: user.name,
      });
      setReceiptData({
        saleId: id,
        createdAt,
        items,
        subtotal,
        vat,
        total: grandTotal,
        payments: [
          {
            method,
            amount,
            ...(method === 'cash' && {
              cashReceived: cashReceivedAmount ?? amount,
              change: changeAmount ?? 0,
            }),
          },
        ],
      });
      setPaymentComplete(true);
      clearCart();
    },
    [user?.id, user?.name, cart, subtotal, vat, grandTotal, clearCart, recordSaleToShift]
  );

  const handleCashConfirm = () => {
    if (cashNum >= grandTotal) {
      completeSale('cash', grandTotal, cashNum, change);
    }
  };

  const handleCardOrEft = (method: 'card' | 'eft') => {
    completeSale(method, grandTotal);
  };

  const handleReceiptDone = useCallback(() => {
    setPaymentComplete(false);
    setStep('method');
    setCashReceived('');
    setReceiptData(null);
    handleClose();
    onSuccess();
  }, [handleClose, onSuccess]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className={cn('sm:max-w-md', receiptData && 'sm:max-w-lg')}
        onEscapeKeyDown={handleClose}
        onPointerDownOutside={handleClose}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Payment</span>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        {paymentComplete && receiptData ? (
          <div className="py-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-2">
                <Receipt className="w-8 h-8 text-success" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">Payment complete</h3>
              {receiptData.payments.some((p) => p.method === 'cash') && (
                <p className="text-2xl font-bold text-primary mt-2">
                  Change: R{change.toFixed(2)}
                </p>
              )}
            </div>
            <ReceiptView receipt={receiptData} onClose={handleReceiptDone} showPrintButton />
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <p className="text-muted-foreground text-sm">Grand total</p>
              <p className={cn('text-4xl font-bold gold-text tabular-nums')}>R{grandTotal.toFixed(2)}</p>
            </div>

            {step === 'method' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStep('cash')}
                  className="p-4 rounded-lg bg-secondary hover:bg-sidebar-accent transition-colors flex flex-col items-center gap-2"
                >
                  <Banknote className="w-8 h-8 text-success" />
                  <span className="text-sm font-medium text-foreground">Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCardOrEft('card')}
                  className="p-4 rounded-lg bg-secondary hover:bg-sidebar-accent transition-colors flex flex-col items-center gap-2"
                >
                  <CreditCard className="w-8 h-8 text-primary" />
                  <span className="text-sm font-medium text-foreground">Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCardOrEft('eft')}
                  className="p-4 rounded-lg bg-secondary hover:bg-sidebar-accent transition-colors flex flex-col items-center gap-2"
                >
                  <Building2 className="w-8 h-8 text-primary" />
                  <span className="text-sm font-medium text-foreground">EFT</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCardOrEft('card')}
                  className="p-4 rounded-lg bg-secondary hover:bg-sidebar-accent transition-colors flex flex-col items-center gap-2"
                >
                  <Receipt className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Split</span>
                </button>
              </div>
            )}

            {step === 'cash' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {QUICK_CASH.map((r) => (
                    <Button
                      key={r}
                      variant="outline"
                      size="sm"
                      onClick={() => setCashReceived(String(r))}
                    >
                      R{r}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCashReceived('')}
                  >
                    Custom
                  </Button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Cash received
                  </label>
                  <Input
                    type="number"
                    min={grandTotal}
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="text-xl text-center font-semibold tabular-nums"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                {cashNum >= grandTotal && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm text-muted-foreground">Change due</p>
                    <p className="text-2xl font-bold text-success tabular-nums">
                      R{change.toFixed(2)}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('method')} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleCashConfirm}
                    disabled={cashNum < grandTotal}
                    className="flex-1 gold-gradient text-primary-foreground"
                  >
                    Complete cash payment
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
