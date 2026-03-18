import { useState } from 'react';
import { Banknote, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BackButton } from '@/components/BackButton';

interface ReconciliationRecord {
  id: string;
  date: string;
  expected: number;
  actual: number;
  variance: number;
  notes: string;
}

const mockHistory: ReconciliationRecord[] = [
  { id: '1', date: '2026-02-26', expected: 5200, actual: 5180, variance: -20, notes: 'Short R20' },
  { id: '2', date: '2026-02-25', expected: 4800, actual: 4800, variance: 0, notes: '' },
  { id: '3', date: '2026-02-24', expected: 6100, actual: 6120, variance: 20, notes: 'Over R20' },
];

export default function CashReconciliationPage() {
  const [records, setRecords] = useState<ReconciliationRecord[]>(mockHistory);
  const [open, setOpen] = useState(false);
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const exp = Number(expected) || 0;
    const act = Number(actual) || 0;
    const variance = act - exp;
    const newRecord: ReconciliationRecord = {
      id: String(Date.now()),
      date: new Date().toISOString().slice(0, 10),
      expected: exp,
      actual: act,
      variance,
      notes: notes.trim(),
    };
    setRecords((prev) => [newRecord, ...prev]);
    setOpen(false);
    setExpected('');
    setActual('');
    setNotes('');
    toast.success('Reconciliation recorded.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" />
            Cash Reconciliation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Expected vs actual, variance history.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Record reconciliation
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Expected</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actual</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Variance</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 text-foreground">{r.date}</td>
                <td className="px-5 py-3 text-right text-muted-foreground">R{r.expected.toFixed(2)}</td>
                <td className="px-5 py-3 text-right text-foreground">R{r.actual.toFixed(2)}</td>
                <td className="px-5 py-3 text-right">
                  <span className={r.variance === 0 ? 'text-muted-foreground' : r.variance > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {r.variance >= 0 ? '+' : ''}R{r.variance.toFixed(2)}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record reconciliation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Expected (R)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Actual counted (R)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Short R20 - till 2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
