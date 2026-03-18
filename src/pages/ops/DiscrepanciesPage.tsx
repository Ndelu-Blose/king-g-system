import { useState } from 'react';
import { Banknote, Package, Plus } from 'lucide-react';
import {
  getDiscrepancies,
  addDiscrepancy,
  resolveDiscrepancy,
  type DiscrepancyType,
} from '@/lib/ops-store';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { BackButton } from '@/components/BackButton';

export default function DiscrepanciesPage() {
  const { user } = useAuth();
  const [list, setList] = useState(() => getDiscrepancies());
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<DiscrepancyType>('cash');
  const [amountOrQty, setAmountOrQty] = useState('');
  const [description, setDescription] = useState('');

  const refresh = () => setList(getDiscrepancies());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountOrQty.trim() || !description.trim()) return;
    addDiscrepancy({
      type,
      amountOrQty: amountOrQty.trim(),
      description: description.trim(),
      reportedBy: user?.name,
    });
    refresh();
    setShowForm(false);
    setAmountOrQty('');
    setDescription('');
    toast.success('Discrepancy recorded.');
  };

  const handleResolve = (id: string) => {
    resolveDiscrepancy(id, 'Resolved by manager');
    refresh();
    toast.success('Marked as resolved.');
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });

  const open = list.filter((r) => !r.resolved);
  const resolved = list.filter((r) => r.resolved);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Discrepancies</h1>
          <p className="text-muted-foreground text-sm mt-1">
            When the till or stock doesn’t match, log it here. Resolve items when you’re done.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          {showForm ? 'Cancel' : 'Log a discrepancy'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 max-w-md space-y-4 rounded-xl">
          <p className="text-sm text-muted-foreground mb-1">What happened?</p>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DiscrepancyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{type === 'cash' ? 'Amount (R)' : 'Quantity or details'}</Label>
            <Input
              value={amountOrQty}
              onChange={(e) => setAmountOrQty(e.target.value)}
              placeholder={type === 'cash' ? '0.00' : 'e.g. 5 units short'}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief note so you can follow up"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto">Save</Button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cash discrepancies</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {list.filter((r) => r.type === 'cash').length}
            </p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stock discrepancies</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {list.filter((r) => r.type === 'stock').length}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-xl">
        <h2 className="font-display text-lg font-semibold text-foreground px-5 py-3 border-b border-border">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nothing open. Use “Log a discrepancy” when till or stock doesn’t match.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {open.map((r) => (
              <li key={r.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    {r.type}
                  </span>
                  <p className="font-medium text-foreground mt-1">{r.amountOrQty}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(r.reportedAt)}
                    {r.reportedBy && ` · ${r.reportedBy}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleResolve(r.id)}>
                  Mark resolved
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="glass-card overflow-hidden">
          <h2 className="font-display text-lg font-semibold text-foreground px-5 py-3 border-b border-border">
            Resolved ({resolved.length})
          </h2>
          <ul className="divide-y divide-border">
            {resolved.slice(-10).reverse().map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground line-through">{r.type}</span>
                  <span className="text-sm text-muted-foreground">{r.amountOrQty} — {r.description}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Resolved {r.resolvedAt && formatDate(r.resolvedAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
