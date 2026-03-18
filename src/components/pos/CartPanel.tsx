import { useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCart } from '@/contexts/CartContext';
import { VAT_RATE, getPlaceholderImageUrl } from '@/lib/pos-constants';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  onProceedToPayment: () => void;
  disabled?: boolean;
}

export function CartPanel({ onProceedToPayment, disabled }: CartPanelProps) {
  const {
    cart,
    selectedLineId,
    setSelectedLineId,
    updateQty,
    removeItem,
    total,
  } = useCart();
  const listRef = useRef<HTMLDivElement>(null);

  const subtotal = useMemo(() => cart.reduce((sum, c) => sum + c.unitPrice * c.qty, 0), [cart]);
  const vat = useMemo(() => Math.round(subtotal * VAT_RATE * 100) / 100, [subtotal]);
  const grandTotal = useMemo(() => Math.round((subtotal + vat) * 100) / 100, [subtotal, vat]);

  return (
    <div className="w-[420px] glass-card flex flex-col flex-shrink-0 h-[calc(100vh-48px)] min-h-0">
      <div className="p-4 border-b border-border flex-shrink-0">
        <h2 className="font-display text-lg font-semibold text-foreground">Current Sale</h2>
        <p className="text-xs text-muted-foreground">{cart.length} items</p>
      </div>

      {/* Main transaction panel: vertical list of scanned items */}
      <ScrollArea className="flex-1 min-h-0 p-3">
        <div ref={listRef} className="space-y-2" role="list">
          <AnimatePresence>
            {cart.map((item) => {
              const lineTotal = item.unitPrice * item.qty;
              const imgSrc = item.product.image || getPlaceholderImageUrl(item.product.name);
              return (
                <motion.div
                  key={item.product.id}
                  role="listitem"
                  tabIndex={0}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl transition-colors outline-none touch-manipulation',
                    selectedLineId === item.product.id
                      ? 'bg-primary/20 ring-2 ring-primary/50'
                      : 'bg-secondary/50 hover:bg-secondary/70'
                  )}
                  onClick={() => setSelectedLineId(item.product.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      removeItem(item.product.id);
                    }
                    if (e.key === '+' || e.key === '=') {
                      e.preventDefault();
                      updateQty(item.product.id, 1);
                    }
                    if (e.key === '-') {
                      e.preventDefault();
                      updateQty(item.product.id, -1);
                    }
                  }}
                >
                  {/* Product thumbnail - instant display */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img
                      src={imgSrc}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">R{item.unitPrice.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQty(item.product.id, -1);
                      }}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-9 text-center text-sm font-semibold text-foreground tabular-nums">
                      {item.qty}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQty(item.product.id, 1);
                      }}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm font-semibold text-foreground w-16 text-right tabular-nums">
                    R{lineTotal.toFixed(2)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.product.id);
                    }}
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {cart.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No items in cart</p>
              <p className="text-xs mt-1">Scan or search to add items</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Totals: Subtotal, VAT, Grand total */}
      <div className="p-4 border-t border-border space-y-2 flex-shrink-0">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums text-foreground">R{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">VAT (15%)</span>
          <span className="tabular-nums text-foreground">R{vat.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold pt-1 border-t border-border/50">
          <span className="text-foreground">Grand total</span>
          <span className="gold-text tabular-nums">R{grandTotal.toFixed(2)}</span>
        </div>
        <Button
          onClick={onProceedToPayment}
          disabled={cart.length === 0 || disabled}
          className="w-full py-4 rounded-xl gold-gradient text-primary-foreground font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity touch-manipulation"
        >
          Proceed to Payment
        </Button>
      </div>
    </div>
  );
}
