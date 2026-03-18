import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { CenterConsole, type LastScanned } from '@/components/pos/CenterConsole';
import { CartPanel } from '@/components/pos/CartPanel';
import { ProductGridSearch } from '@/components/pos/ProductGridSearch';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/lib/auth-context';
import { BackButton } from '@/components/BackButton';

function playBeep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // ignore
  }
}

export default function POS() {
  const {
    cart,
    clearCart,
    selectedLineId,
    updateQty,
    removeItem,
    focusScanInput,
    addByBarcode,
    lastScanned,
    setScanInputRef,
  } = useCart();
  const { user } = useAuth();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [scanValue, setScanValue] = useState('');
  const [scanError, setScanError] = useState(false);
  const [manualQuery, setManualQuery] = useState('');

  const isCashier = user?.role === 'cashier';
  const isManager =
    user?.role === 'manager' ||
    user?.role === 'senior_manager' ||
    user?.role === 'owner';

  const lastScannedForConsole: LastScanned | null = useMemo(() => {
    if (!lastScanned) return null;
    const line = cart.find((c) => c.product.name === lastScanned.name);
    return {
      name: lastScanned.name,
      price: lastScanned.unitPrice,
      qtyAdded: lastScanned.qty,
      totalQtyInCart: line?.qty,
    };
  }, [lastScanned, cart]);

  const onScanSubmit = useCallback(async () => {
    const code = scanValue.trim();
    if (!code) return;

    setScanError(false);

    const result = await addByBarcode(code);

    if (result.success) {
      playBeep();
      toast.success('Added', { duration: 800 });
      setScanValue('');
    } else if (result.reason === 'not_found') {
      setScanError(true);
      setScanValue('');
    } else {
      toast.error('Item is out of stock');
      setScanValue('');
    }
  }, [scanValue, addByBarcode]);

  const onManualAddClickFromError = useCallback(() => {
    setMode('manual');
    setScanError(false);
  }, []);

  const onBackToScan = useCallback(() => {
    setMode('scan');
    setManualQuery('');
    focusScanInput();
  }, [focusScanInput]);

  const handleProceedToPayment = useCallback(() => {
    if (cart.length > 0) setPaymentModalOpen(true);
  }, [cart.length]);

  const handlePaymentSuccess = useCallback(() => {
    setPaymentModalOpen(false);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        focusScanInput();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setMode('manual');
        setScanError(false);
        return;
      }
      if (e.key === 'Escape') {
        if (mode === 'manual') {
          setMode('scan');
          setManualQuery('');
          focusScanInput();
        } else {
          setPaymentModalOpen(false);
          setScanError(false);
        }
        return;
      }
      if (paymentModalOpen) return;
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (isInput) return;
        if (cart.length > 0) {
          e.preventDefault();
          handleProceedToPayment();
        }
        return;
      }
      if (e.key === 'Delete' && selectedLineId) {
        e.preventDefault();
        removeItem(selectedLineId);
        return;
      }
      if ((e.key === '+' || e.key === '=') && selectedLineId) {
        e.preventDefault();
        updateQty(selectedLineId, 1);
        return;
      }
      if (e.key === '-' && selectedLineId) {
        e.preventDefault();
        updateQty(selectedLineId, -1);
        return;
      }
      if (e.ctrlKey && e.key === 'Backspace') {
        e.preventDefault();
        if (cart.length > 0 && (isManager || confirm('Clear current sale?'))) {
          clearCart();
          toast.info('Sale cleared');
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    paymentModalOpen,
    mode,
    cart.length,
    selectedLineId,
    removeItem,
    updateQty,
    clearCart,
    isManager,
    handleProceedToPayment,
    focusScanInput,
  ]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 shrink-0">
        <BackButton to="/dashboard" label="Back to Dashboard" />
      </div>
      <div className="flex gap-4 h-[calc(100vh-96px)] flex-col md:flex-row bg-background">
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-auto">
        <CenterConsole
          mode={mode}
          scanValue={scanValue}
          onScanValueChange={setScanValue}
          onScanSubmit={onScanSubmit}
          scannerConnected={true}
          scanError={scanError}
          onManualAddClickFromError={onManualAddClickFromError}
          lastScanned={lastScannedForConsole}
          manualQuery={manualQuery}
          onManualQueryChange={setManualQuery}
          onBackToScan={onBackToScan}
          showShortcuts={!isCashier}
          setScanInputRef={setScanInputRef}
        />

        {mode === 'manual' ? (
          <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
            <ProductGridSearch
              manualMode={true}
              onOpenManualMode={() => setMode('manual')}
              onCloseManualMode={onBackToScan}
              searchInputRef={{ current: null }}
              controlledQuery={manualQuery}
              onControlledQueryChange={setManualQuery}
            />
          </div>
        ) : null}
      </div>

      <CartPanel
        onProceedToPayment={handleProceedToPayment}
        disabled={paymentModalOpen}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
      </div>
    </div>
  );
}
