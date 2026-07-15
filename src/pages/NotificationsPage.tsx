import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  Package,
  TrendingDown,
  Phone,
  Check,
  MoreHorizontal,
  Inbox,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  getNotifications,
  getLocalHelpRequests,
  acknowledgeHelpRequest,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  type AppNotification,
  type NotificationType,
} from '@/lib/pos-api';
import { useAuth } from '@/lib/auth-context';
import { BackButton } from '@/components/BackButton';

type FilterTab = 'all' | 'unread' | 'help' | 'stock';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'help', label: 'Help Requests' },
  { id: 'stock', label: 'Stock Alerts' },
];

function localHelpToNotification(h: {
  id: string;
  cashierId: string;
  cashierName: string;
  message: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  isRead?: boolean;
  readAt?: string | null;
}): AppNotification {
  return {
    id: h.id,
    type: 'help_request',
    category: 'Help Requests',
    title: `${h.cashierName || h.cashierId} requested help`,
    description: h.message || 'Assistance needed at terminal.',
    href: '/notifications',
    isRead: Boolean(h.isRead),
    readAt: h.readAt ?? null,
    createdAt: h.createdAt,
    status: h.status || 'pending',
    acknowledgedAt: h.acknowledgedAt,
    acknowledgedBy: h.acknowledgedBy,
  };
}

function formatNotificationWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Today, ${time}`;
  if (isYesterday(d)) return `Yesterday, ${time}`;
  return format(d, 'd MMMM yyyy, HH:mm');
}

function groupLabel(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return 'Earlier';
}

function IconForType({ type }: { type: NotificationType }) {
  if (type === 'help_request') return <Phone className="h-4 w-4" />;
  if (type === 'low_stock') return <Package className="h-4 w-4" />;
  if (type === 'variance') return <AlertTriangle className="h-4 w-4" />;
  return <TrendingDown className="h-4 w-4" />;
}

function statusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'pending') return 'Pending';
  if (s === 'acknowledged') return 'Acknowledged';
  if (s === 'resolved' || s === 'closed') return 'Resolved';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = statusLabel(status);
  if (!label) return null;
  const tone =
    label === 'Pending'
      ? 'border-primary/40 bg-primary/15 text-primary'
      : label === 'Acknowledged'
        ? 'border-border bg-muted/40 text-muted-foreground'
        : 'border-border bg-muted/30 text-muted-foreground';
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium px-1.5 py-0 h-5', tone)}>
      {label}
    </Badge>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      let api: AppNotification[] = [];
      try {
        api = (await getNotifications()) ?? [];
      } catch {
        api = [];
      }
      const local = getLocalHelpRequests().map(localHelpToNotification);
      const seen = new Set(api.map((n) => n.id));
      const merged = [...local.filter((n) => !seen.has(n.id)), ...api];
      merged.sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return merged;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const notifications = Array.isArray(notificationsData) ? notificationsData : [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread':
        return notifications.filter((n) => !n.isRead);
      case 'help':
        return notifications.filter((n) => n.type === 'help_request');
      case 'stock':
        return notifications.filter((n) => n.type === 'low_stock' || n.type === 'variance');
      default:
        return notifications;
    }
  }, [notifications, filter]);

  const groups = useMemo(() => {
    const order: Array<'Today' | 'Yesterday' | 'Earlier'> = ['Today', 'Yesterday', 'Earlier'];
    const map: Record<string, AppNotification[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const n of filtered) {
      map[groupLabel(n.createdAt)].push(n);
    }
    return order
      .map((label) => ({ label, items: map[label] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['help-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  };

  const handleMarkRead = async (id: string) => {
    setBusyId(id);
    try {
      await markNotificationRead(id);
      invalidate();
    } catch {
      toast.error('Failed to mark as read.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkUnread = async (id: string) => {
    setBusyId(id);
    try {
      await markNotificationUnread(id);
      invalidate();
    } catch {
      toast.error('Failed to mark as unread.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      toast.success('All notifications marked as read.');
      invalidate();
    } catch {
      toast.error('Failed to mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleAcknowledge = async (n: AppNotification, e?: MouseEvent) => {
    e?.stopPropagation();
    if (busyId) return;
    setBusyId(n.id);
    try {
      const ok = await acknowledgeHelpRequest(n.id, user?.name ?? user?.id ?? 'manager');
      if (ok) {
        await markNotificationRead(n.id);
        toast.success('Help request acknowledged.');
        invalidate();
      } else {
        toast.error('Failed to acknowledge help request.');
      }
    } catch {
      toast.error('Failed to acknowledge help request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id);
        invalidate();
      } catch {
        // still navigate
      }
    }
    if (n.href && n.href !== '/notifications') {
      navigate(n.href);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Help requests, stock alerts, and operational notices.
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          className="shrink-0 self-start"
          onClick={() => void handleMarkAllRead()}
          disabled={unreadCount === 0 || markingAll}
        >
          {markingAll ? 'Marking…' : 'Mark all as read'}
        </Button>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading notifications…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 px-4 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">No notifications</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Nothing matches this filter. New help requests and stock alerts will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} className="space-y-1.5">
              <h2 className="text-xs font-medium text-muted-foreground px-1">{group.label}</h2>
              <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {group.items.map((n) => (
                  <li key={n.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleOpen(n)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleOpen(n);
                        }
                      }}
                      className={cn(
                        'group flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                        n.isRead
                          ? 'bg-card hover:bg-muted/20'
                          : 'bg-primary/[0.06] hover:bg-primary/[0.1] border-l-2 border-l-primary'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 rounded-md p-1.5 shrink-0',
                          n.isRead ? 'bg-muted/50 text-muted-foreground' : 'bg-muted text-foreground'
                        )}
                      >
                        <IconForType type={n.type} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p
                            className={cn(
                              'text-sm text-foreground truncate flex-1',
                              n.isRead ? 'font-normal text-muted-foreground' : 'font-semibold'
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span
                              className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.description}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[11px] text-muted-foreground/80">{n.category}</span>
                          <span className="text-[11px] text-muted-foreground/50">·</span>
                          <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                            {formatNotificationWhen(n.createdAt)}
                          </span>
                          {n.type === 'help_request' && <StatusBadge status={n.status} />}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {n.type === 'help_request' && n.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs hidden sm:inline-flex"
                            onClick={(e) => void handleAcknowledge(n, e)}
                            disabled={busyId === n.id}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              disabled={busyId === n.id}
                              aria-label="Notification actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {n.isRead ? (
                              <DropdownMenuItem onClick={() => void handleMarkUnread(n.id)}>
                                Mark as unread
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => void handleMarkRead(n.id)}>
                                Mark as read
                              </DropdownMenuItem>
                            )}
                            {n.type === 'help_request' && n.status === 'pending' && (
                              <DropdownMenuItem onClick={() => void handleAcknowledge(n)}>
                                Acknowledge
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
