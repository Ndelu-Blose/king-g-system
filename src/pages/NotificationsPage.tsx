import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, AlertTriangle, Package, TrendingDown, Phone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getHelpRequests,
  getLocalHelpRequests,
  acknowledgeHelpRequest,
  getTransactionsFromApi,
  type HelpRequest,
} from '@/lib/pos-api';
import { useAuth } from '@/lib/auth-context';
import { useInventory } from '@/contexts/InventoryContext';
import { BackButton } from '@/components/BackButton';
import { getDiscrepancies } from '@/lib/ops-store';

const SYSTEM_SETTINGS_KEY = 'kingg-system-settings';
const ALERT_READ_IDS_KEY = 'kingg_alert_read_ids';
const VOID_REFUND_ALERT_THRESHOLD = 2;

type AlertType = 'low_stock' | 'variance' | 'unusual';

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

function getLowStockThreshold(): number {
  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.lowStockThreshold === 'number' && s.lowStockThreshold >= 0) return s.lowStockThreshold;
    }
  } catch {
    // ignore
  }
  return 5;
}

function loadReadAlertIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ALERT_READ_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveReadAlertIds(ids: Set<string>): void {
  try {
    localStorage.setItem(ALERT_READ_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

function IconForType({ type }: { type: AlertType }) {
  if (type === 'low_stock') return <Package className="h-4 w-4" />;
  if (type === 'variance') return <AlertTriangle className="h-4 w-4" />;
  return <TrendingDown className="h-4 w-4" />;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour(s) ago`;
  return d.toLocaleString();
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { inventory } = useInventory();
  const [readIds, setReadIds] = useState<Set<string>>(loadReadAlertIds);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const threshold = getLowStockThreshold();

  const { data: helpRequestsData } = useQuery({
    queryKey: ['help-requests'],
    queryFn: async () => {
      const api = (await getHelpRequests(null)) ?? [];
      const local = getLocalHelpRequests();
      const merged = [...local, ...api].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return merged;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['transactions', 'alerts'],
    queryFn: () => getTransactionsFromApi(null),
    staleTime: 60_000,
  });

  const transactions = Array.isArray(transactionsData) ? transactionsData : [];
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const todayVoidRefundCount = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (t.status === 'void' || t.status === 'refunded') && new Date(t.createdAt).getTime() >= todayStart
      ).length,
    [transactions, todayStart]
  );

  const discrepancies = useMemo(() => getDiscrepancies().filter((r) => !r.resolved), []);

  const alerts = useMemo((): Alert[] => {
    const list: Alert[] = [];
    const readSet = readIds;

    // Low stock: from inventory (lounge or warehouse below threshold)
    inventory
      .filter((i) => i.loungeQty < threshold || i.warehouseQty < threshold)
      .slice(0, 10)
      .forEach((i) => {
        const loungeLow = i.loungeQty < threshold;
        const warehouseLow = i.warehouseQty < threshold;
        const loc = loungeLow && warehouseLow ? 'both' : loungeLow ? 'Lounge' : 'Warehouse';
        const qty = loungeLow ? i.loungeQty : i.warehouseQty;
        list.push({
          id: `low_${i.productId}`,
          type: 'low_stock',
          title: 'Low stock',
          message: `${i.productName} — ${qty} unit${qty !== 1 ? 's' : ''} in ${loc}`,
          time: 'Current',
          read: readSet.has(`low_${i.productId}`),
        });
      });

    // Variance: open discrepancies (cash or stock)
    discrepancies.forEach((r) => {
      list.push({
        id: `var_${r.id}`,
        type: 'variance',
        title: r.type === 'cash' ? 'Cash variance' : 'Stock variance',
        message: r.description || r.amountOrQty,
        time: formatTime(r.reportedAt),
        read: readSet.has(`var_${r.id}`),
      });
    });

    // Unusual: high void/refund count today
    if (todayVoidRefundCount >= VOID_REFUND_ALERT_THRESHOLD) {
      list.push({
        id: 'unusual_voids_today',
        type: 'unusual',
        title: 'Unusual activity',
        message: `${todayVoidRefundCount} void/refund${todayVoidRefundCount !== 1 ? 's' : ''} today. Review if needed.`,
        time: 'Today',
        read: readSet.has('unusual_voids_today'),
      });
    }

    return list.sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));
  }, [inventory, threshold, discrepancies, todayVoidRefundCount, readIds]);

  const helpRequests = Array.isArray(helpRequestsData) ? helpRequestsData : [];
  const pendingHelp = helpRequests.filter((r) => r.status === 'pending');
  const hasLocal = helpRequests.some((r) => r.id.startsWith('local-'));

  const handleAcknowledge = async (req: HelpRequest) => {
    setAcknowledgingId(req.id);
    try {
      const ok = await acknowledgeHelpRequest(req.id, user?.name ?? user?.id ?? 'manager');
      if (ok) void queryClient.invalidateQueries({ queryKey: ['help-requests'] });
    } finally {
      setAcknowledgingId(null);
    }
  };

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadAlertIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      saveReadAlertIds(next);
      return next;
    });
  }, [alerts]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications / Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cashier help requests, variances, low stock, and unusual activity.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {/* Help requests from cashiers — managers see these immediately */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          Help requests
          {pendingHelp.length > 0 && (
            <span className="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-medium">
              {pendingHelp.length} pending
            </span>
          )}
        </h2>
        {hasLocal && (
          <p className="text-xs text-muted-foreground mb-2">
            Some requests were saved on this device while the server was offline.
          </p>
        )}
        {helpRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 rounded-lg border border-dashed border-border">
            No help requests. When a cashier taps &quot;Call Manager&quot;, they appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {helpRequests.map((req) => (
              <div
                key={req.id}
                className={cn(
                  'flex items-start gap-4 rounded-lg border p-4 transition-colors',
                  req.status === 'pending'
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border bg-muted/20'
                )}
              >
                <div className="rounded-full bg-muted p-2 shrink-0">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {req.cashierName || req.cashierId} requested help
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {req.message || 'Assistance needed at terminal.'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(req.createdAt)}
                    {req.status === 'acknowledged' && req.acknowledgedBy && (
                      <span className="ml-2">— Acknowledged by {req.acknowledgedBy}</span>
                    )}
                  </p>
                </div>
                {req.status === 'pending' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => handleAcknowledge(req)}
                    disabled={acknowledgingId === req.id}
                  >
                    <Check className="h-4 w-4" />
                    {acknowledgingId === req.id ? '…' : 'Acknowledge'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* System alerts: low stock, variances, unusual activity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          System alerts
        </h2>
        <p className="text-xs text-muted-foreground">
          Low stock (from inventory), open discrepancies, and high void/refund activity today.
        </p>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 rounded-lg border border-dashed border-border">
            No alerts. When stock is below the threshold, discrepancies are logged, or there are multiple voids/refunds today, they appear here.
          </p>
        ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={cn(
                'flex items-start gap-4 rounded-lg border p-4 transition-colors',
                a.read ? 'border-border bg-card' : 'border-primary/30 bg-primary/5'
              )}
            >
              <div className="rounded-full bg-muted p-2">
                <IconForType type={a.type} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.time}</p>
              </div>
              {!a.read && (
                <Button variant="ghost" size="sm" onClick={() => markRead(a.id)}>
                  Mark read
                </Button>
              )}
            </div>
          ))}
        </div>
        )}
      </section>
    </div>
  );
}
