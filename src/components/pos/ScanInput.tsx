import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useCart } from '@/contexts/CartContext';
import { useScanFocusLock } from '@/hooks/use-scan-focus-lock';
import { cn } from '@/lib/utils';

/** Play short beep for scan success (optional). */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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

interface ScanInputProps {
  onUnknownBarcode: (barcode: string) => void;
  onOutOfStock?: (barcode: string) => void;
  /** Called when user submits a scan (any result). Use to clear inline error on next scan. */
  onScanSubmit?: () => void;
  /** When true, focus lock does not steal focus (e.g. payment modal or manual add open). */
  isBlocked?: boolean;
  className?: string;
}

export function ScanInput({
  onUnknownBarcode,
  onOutOfStock,
  onScanSubmit,
  isBlocked = false,
  className,
}: ScanInputProps) {
  const { inputRef, focusScan } = useScanFocusLock({ enabled: true, isBlocked });
  const { addByBarcode, lastScanned, setScanInputRef } = useCart();

  useEffect(() => {
    setScanInputRef(inputRef);
    return () => setScanInputRef({ current: null });
  }, [inputRef, setScanInputRef]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const raw = (e.target as HTMLFormElement).barcode?.value ?? (inputRef.current?.value ?? '').trim();
      if (!raw) return;
      onScanSubmit?.();
      const result = await addByBarcode(raw);
      if (result.success) {
        playBeep();
        toast.success('Added', { duration: 800 });
        if (inputRef.current) inputRef.current.value = '';
        focusScan(); // refocus with preventScroll (scanner "just works")
      } else if (result.reason === 'not_found') {
        onUnknownBarcode(raw);
      } else {
        onOutOfStock?.(raw);
      }
    },
    [addByBarcode, onUnknownBarcode, onOutOfStock, onScanSubmit, focusScan]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <form onSubmit={handleSubmit} className="relative">
        <Input
          ref={inputRef}
          name="barcode"
          type="text"
          autoComplete="off"
          placeholder="Scan barcode…"
          className="h-14 text-lg px-4 rounded-xl border-2 border-primary/30 focus:border-primary bg-card placeholder:text-muted-foreground"
          aria-label="Scan barcode"
        />
      </form>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Ready to scan • Scanner connected</span>
        {lastScanned && (
          <span className="px-2 py-1 rounded-md bg-secondary text-foreground">
            Last: {lastScanned.name} x{lastScanned.qty} (R{lastScanned.unitPrice * lastScanned.qty})
          </span>
        )}
      </div>
    </div>
  );
}
