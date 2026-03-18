import { useSearchParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useShift, type ActivityEntry } from '@/contexts/ShiftContext';
import { mockTransactions } from '@/lib/mock-data';
import { getTransactionsFromApi } from '@/lib/pos-api';
import type { Transaction } from '@/lib/mock-data';
import {
  CreditCard,
  Banknote,
  Clock,
  LogIn,
  LogOut,
  Search,
  Filter,
  List,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Ban,
} from 'lucide-react';
import { AuthorizeVoidDialog } from '@/components/AuthorizeVoidDialog';
import { BackButton } from '@/components/BackButton';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useMemo } from 'react';

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const REFETCH_MS = 3000;
const PAGE_SIZES = [10, 25, 50];

export default function CashierSalesHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') ?? 'my-shift';
  const { user } = useAuth();
  const { activityLog, sessionSales, openedAt, isOpen } = useShift();
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voidedIds, setVoidedIds] = useState<Set<string>>(new Set());

  const { data: apiTransactions } = useQuery({
    queryKey: ['transactions', 'cashier', user?.id],
    queryFn: () => getTransactionsFromApi(user?.id ?? null),
    refetchInterval: REFETCH_MS,
    staleTime: 2000,
    enabled: !!user?.id,
  });

  const mockForUser = mockTransactions.filter((t) => t.cashierId === user?.id);
  // Always include session sales so transactions you just made show up even if API is empty or slow
  const fromApi = Array.isArray(apiTransactions) ? apiTransactions : [];
  const byId = new Map<string, Transaction>();
  for (const t of [...sessionSales, ...fromApi, ...mockForUser]) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  let merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  merged = merged.filter((t) => !voidedIds.has(t.id));

  const handleVoidConfirm = (_pin: string, _reason: string) => {
    if (!voidTarget) return;
    setVoidedIds((prev) => new Set(prev).add(voidTarget.id));
    setVoidTarget(null);
    toast.success(`Transaction ${voidTarget.id} voided. Supervisor authorization recorded.`);
  };

  // Today = all your sales from midnight to now
  const todayMerged = merged.filter((t) => t.createdAt >= todayStart());

  // My shift = only sales since you opened this shift (different from Today)
  const myShiftMerged =
    isOpen && openedAt
      ? merged.filter((t) => t.createdAt >= openedAt)
      : [];

  // Today = transaction list. My shift = shift start/end history (no transaction table).
  const todayFiltered = useMemo(() => {
    if (!search.trim()) return todayMerged;
    const q = search.trim().toLowerCase();
    return todayMerged.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.cashierName?.toLowerCase().includes(q) ||
        String(t.total).includes(q)
    );
  }, [todayMerged, search]);

  // Summary cards always show today's totals so money is consistent on both My shift and Today tabs
  const totalSales = todayMerged.reduce((sum, t) => sum + t.total, 0);
  const cashTotal = todayMerged.filter((t) => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.total, 0);
  const cardTotal = todayMerged.filter((t) => t.paymentMethod === 'card').reduce((sum, t) => sum + t.total, 0);
  const refundsTotal = todayMerged.filter((t) => t.status === 'refunded').reduce((sum, t) => sum + t.total, 0);

  const todayPaginated = todayFiltered.slice(page * pageSize, page * pageSize + pageSize);

  // Shift history: only open and close entries (when shift started / ended), newest first
  const shiftHistoryEntries = useMemo(
    () =>
      [...activityLog]
        .filter((e) => e.type === 'open' || e.type === 'close')
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [activityLog]
  );

  const resetPage = () => setPage(0);

  // Sales history is for cashiers only (they are the ones selling)
  if (user?.role !== 'cashier') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton to="/pos" label="Back to POS" />
      </div>
      {/* Header: title + search + filters (no export for cashier) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Sales History</h1>
          <p className="text-sm text-muted-foreground">Your sales for this shift or today</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search TXN, amount, cashier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              className="pl-9 bg-muted/30 border-border"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" title="Filters">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          {/* No Export button — cashiers cannot export */}
        </div>
      </div>

      {/* Summary cards — always today's totals so money is consistent on both tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total sales (today)
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">R{totalSales.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {todayMerged.length} transaction{todayMerged.length !== 1 ? 's' : ''}
          </p>
          <span className="inline-block w-2 h-2 rounded-full bg-success mt-1" aria-hidden />
        </div>
        <div className="glass-card p-4 rounded-xl border border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Banknote className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cash</p>
            <p className="text-xl font-bold text-foreground">R{cashTotal.toFixed(2)}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Card</p>
            <p className="text-xl font-bold text-foreground">R{cardTotal.toFixed(2)}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <RotateCcw className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Refunds</p>
            <p className="text-xl font-bold text-foreground">R{refundsTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* My Shift | Today */}
      <Tabs
        value={view}
        onValueChange={(v) => {
          setSearchParams({ view: v });
          resetPage();
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="my-shift">My shift</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
        </TabsList>

        <TabsContent value="my-shift" className="mt-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">When your shifts started and ended.</p>
          </div>
          <ShiftHistoryList entries={shiftHistoryEntries} />
        </TabsContent>
        <TabsContent value="today" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Transaction history for today.</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{todayFiltered.length} transaction{todayFiltered.length !== 1 ? 's' : ''}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="List view">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SalesTable
            transactions={todayPaginated}
            emptyMessage="No transactions today."
            onVoid={(txn) => setVoidTarget(txn)}
          />
          <Pagination
            total={todayFiltered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(v) => {
              setPageSize(v);
              resetPage();
            }}
          />
        </TabsContent>
      </Tabs>

      <AuthorizeVoidDialog
        open={!!voidTarget}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        transaction={voidTarget ? { id: voidTarget.id, total: voidTarget.total } : null}
        onConfirm={handleVoidConfirm}
      />
    </div>
  );
}

function ShiftHistoryList({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-muted-foreground">
        No shift history yet. Open a shift and end it to see when each shift started and ended.
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    {new Date(entry.at).toLocaleString('en-ZA', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {entry.type === 'open' && (
                      <>
                        <LogIn className="h-4 w-4 text-success shrink-0" />
                        <span className="font-medium text-foreground">Shift started</span>
                      </>
                    )}
                    {entry.type === 'close' && (
                      <>
                        <LogOut className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="font-medium text-foreground">Shift ended</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {entry.type === 'open' && <span className="text-muted-foreground">—</span>}
                  {entry.type === 'close' && entry.details && (
                    <span>
                      {entry.details.counted != null && (
                        <>Counted R{entry.details.counted.toFixed(2)}</>
                      )}
                      {entry.details.notes && (
                        <span className="ml-2">— {entry.details.notes}</span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesTable({
  transactions,
  emptyMessage = 'No transactions in this period.',
  onVoid,
}: {
  transactions: Transaction[];
  emptyMessage?: string;
  onVoid?: (txn: Transaction) => void;
}) {
  if (transactions.length === 0) {
    return (
      <div className="glass-card p-12 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">TXN ID</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
              {onVoid && <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>}
              {!onVoid && <th className="w-8" aria-hidden />}
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    {new Date(txn.createdAt).toLocaleTimeString('en-ZA', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{txn.id}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary">SALE</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{txn.items.length} item{txn.items.length !== 1 ? 's' : ''}</p>
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">R{txn.total.toFixed(2)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    {txn.paymentMethod === 'cash' ? (
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="capitalize">{txn.paymentMethod}</span>
                  </div>
                </td>
                {onVoid ? (
                  <td className="px-5 py-3 text-center">
                    {(txn.status ?? 'completed') === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                        onClick={() => onVoid(txn)}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Void
                      </Button>
                    )}
                  </td>
                ) : (
                  <td className="px-2 py-3 text-muted-foreground group-hover:text-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingCount = total === 0 ? 0 : Math.min(pageSize, total - page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Showing {showingCount} of {total} transaction{total !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page <= 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[2rem] text-center">{page + 1}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[100px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
