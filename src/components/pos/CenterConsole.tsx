import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useScanFocusLock } from '@/hooks/use-scan-focus-lock';

export type PosMode = 'scan' | 'manual';

export type LastScanned = {
  name: string;
  price: number;
  qtyAdded: number;
  totalQtyInCart?: number;
};

type Props = {
  mode: PosMode;

  onScanSubmit: (code: string) => void;
  /** Payment modal (or similar) is open — do not steal keystrokes. */
  isScanBlocked?: boolean;

  scannerConnected: boolean;

  scanError: boolean;
  onManualAddClickFromError: () => void;

  lastScanned: LastScanned | null;

  manualQuery: string;
  onManualQueryChange: (v: string) => void;
  onBackToScan: () => void;

  showShortcuts?: boolean;
  setScanInputRef?: (ref: React.RefObject<HTMLInputElement | null>) => void;
};

function formatZar(v: number) {
  return `R${v.toFixed(2)}`;
}

export function CenterConsole({
  mode,
  onScanSubmit,
  isScanBlocked = false,
  scannerConnected,
  scanError,
  onManualAddClickFromError,
  lastScanned,
  manualQuery,
  onManualQueryChange,
  onBackToScan,
  showShortcuts = true,
  setScanInputRef,
}: Props) {
  const manualRef = React.useRef<HTMLInputElement>(null);
  const scanning = mode === 'scan' && !isScanBlocked;
  const { inputRef: scanRef, focusScan } = useScanFocusLock({
    enabled: scanning,
    isBlocked: !scanning,
  });
  const onScanSubmitRef = React.useRef(onScanSubmit);
  onScanSubmitRef.current = onScanSubmit;
  const lastSubmitRef = React.useRef({ code: '', at: 0 });

  React.useEffect(() => {
    setScanInputRef?.(scanRef);
    return () => setScanInputRef?.({ current: null });
  }, [setScanInputRef, scanRef]);

  React.useEffect(() => {
    if (mode !== 'scan') {
      scanRef.current?.blur();
      manualRef.current?.focus({ preventScroll: true });
      manualRef.current?.select();
    }
  }, [mode, scanRef]);

  React.useEffect(() => {
    if (!scanning) return;

    const submit = (code: string) => {
      const now = Date.now();
      if (code === lastSubmitRef.current.code && now - lastSubmitRef.current.at < 50) return;
      lastSubmitRef.current = { code, at: now };
      if (scanRef.current) scanRef.current.value = '';
      onScanSubmitRef.current(code);
      focusScan();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const active = document.activeElement;
      const tag = (active as HTMLElement | null)?.tagName?.toLowerCase();
      const inOtherField =
        !!active &&
        active !== scanRef.current &&
        (tag === 'input' || tag === 'textarea' || (active as HTMLElement).isContentEditable);
      if (inOtherField) return;

      const code = scanRef.current?.value ?? '';
      if (e.key === 'Enter' || (e.key === 'Tab' && code.trim())) {
        if (!code.trim()) return;
        e.preventDefault();
        e.stopPropagation();
        submit(code);
        return;
      }

      // Keep qty shortcuts (+, -) for the cart. Everything else a scanner types
      // goes into the scan box, even when focus was left on the page body.
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=' || e.key === '-') return;
      if (active === scanRef.current) return;

      e.preventDefault();
      e.stopPropagation();
      if (!scanRef.current) return;
      scanRef.current.focus({ preventScroll: true });
      scanRef.current.value += e.key;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [scanning, focusScan, scanRef]);

  return (
    <div className="h-full">
      <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-base">
              {mode === 'scan' ? 'Scan Items' : 'Manual Mode'}
            </div>

            {mode === 'manual' ? (
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={onBackToScan}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Scan
              </Button>
            ) : null}
          </div>

          <Separator className="opacity-60" />

          {mode === 'scan' ? (
            <div className="space-y-3">
              <Input
                ref={scanRef}
                name="barcode"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Scan barcode…"
                className="h-14 rounded-2xl border-border/60 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="Scan barcode"
              />

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Ready to scan</span>
                <span className="opacity-60">•</span>
                <span>
                  {scannerConnected ? 'Scanner connected' : 'Scanner disconnected'}
                </span>

                {showShortcuts ? (
                  <>
                    <span className="opacity-60">•</span>
                    <Badge variant="secondary" className="rounded-xl">
                      F3 Manual
                    </Badge>
                    <Badge variant="secondary" className="rounded-xl">
                      F2 Focus
                    </Badge>
                  </>
                ) : null}
              </div>

              {lastScanned ? (
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight">
                        {lastScanned.name}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatZar(lastScanned.price)}
                        {typeof lastScanned.totalQtyInCart === 'number'
                          ? ` • Qty: ${lastScanned.totalQtyInCart}`
                          : ''}
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-xl flex-shrink-0">
                      +{lastScanned.qtyAdded}
                    </Badge>
                  </div>
                </div>
              ) : null}

              {scanError ? (
                <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-sm font-medium">Item not found</span>
                    </div>

                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={onManualAddClickFromError}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Manual Add
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={manualRef}
                  value={manualQuery}
                  onChange={(e) => onManualQueryChange(e.target.value)}
                  placeholder="Search products…"
                  className="h-12 pl-9 rounded-2xl border-border/60"
                />
              </div>

              <div className="text-sm text-muted-foreground">
                Search by name or SKU, then tap a tile to add.
              </div>
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
