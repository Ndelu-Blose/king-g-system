import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote, Calculator, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useShift } from '@/contexts/ShiftContext';
import { useAuth } from '@/lib/auth-context';
import { addShiftRecord } from '@/lib/shift-history';

interface CloseShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Basic cash-up: expected cash (from sales), counted cash, variance. Cashier end-of-shift only. */
export function CloseShiftDialog({ open, onOpenChange }: CloseShiftDialogProps) {
  const { user } = useAuth();
  const { closeShift, openedAt, expectedCash } = useShift();
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<{
    counted: number;
    notes: string;
    endedAt: string;
  } | null>(null);

  const counted = parseFloat(countedCash) || 0;

  const handleEndShift = () => {
    const closedAt = new Date().toISOString();
    if (user && openedAt) {
      addShiftRecord({
        cashierId: user.id,
        cashierName: user.name,
        openedAt,
        closedAt,
        expectedCash,
        countedCash: counted,
        variance: counted - expectedCash,
        notes,
      });
    }
    closeShift(counted, notes);
    setSummary({
      counted,
      notes,
      endedAt: new Date().toLocaleTimeString('en-ZA', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
    toast.success('Shift ended. Cash-up recorded.');
  };

  const handleClose = () => {
    setCountedCash('');
    setNotes('');
    setSummary(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            End shift / Cash-up
          </DialogTitle>
          <DialogDescription>
            Count your till and record cash-up. Refunds and voids require manager approval—do not do them here.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-lg bg-success/10 border border-success/20 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-success shrink-0" />
              <div>
                <p className="font-medium text-foreground">Shift ended</p>
                <p className="text-sm text-muted-foreground">at {summary.endedAt}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Counted cash</span>
                <span className="font-semibold tabular-nums">R{summary.counted.toFixed(2)}</span>
              </div>
              {summary.notes && (
                <div className="pt-2 border-t border-border">
                  <span className="text-muted-foreground">Notes: </span>
                  <span className="text-foreground">{summary.notes}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="counted-cash" className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Counted cash (R)
                </Label>
                <Input
                  id="counted-cash"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="text-lg tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-up-notes">Notes (optional)</Label>
                <Input
                  id="cash-up-notes"
                  type="text"
                  placeholder="e.g. Float R500"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleEndShift}>End shift</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
