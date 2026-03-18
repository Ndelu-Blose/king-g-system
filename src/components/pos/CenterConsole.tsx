import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type PosMode = 'scan' | 'manual';

export type LastScanned = {
  name: string;
  price: number;
  qtyAdded: number;
  totalQtyInCart?: number;
};

type Props = {
  mode: PosMode;

  scanValue: string;
  onScanValueChange: (v: string) => void;
  onScanSubmit: () => void;

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
  scanValue,
  onScanValueChange,
  onScanSubmit,
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
  const scanRef = React.useRef<HTMLInputElement>(null);
  const manualRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setScanInputRef?.(scanRef);
    return () => setScanInputRef?.({ current: null });
  }, [setScanInputRef]);

  React.useEffect(() => {
    if (mode === 'scan') {
      scanRef.current?.focus({ preventScroll: true });
    } else {
      scanRef.current?.blur();
      manualRef.current?.focus({ preventScroll: true });
      manualRef.current?.select();
    }
  }, [mode]);

  return (
    <div className="px-6 pt-6">
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
                value={scanValue}
                onChange={(e) => onScanValueChange(e.target.value)}
                placeholder="Scan barcode…"
                className="h-14 rounded-2xl border-border/60 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onScanSubmit();
                  }
                }}
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

      <div className="min-h-[8rem]" />
    </div>
  );
}
