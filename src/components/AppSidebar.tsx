import { useAuth } from '@/lib/auth-context';
import { useShift } from '@/contexts/ShiftContext';
import { roleLabels } from '@/lib/mock-data';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  FileText,
  Users,
  Shield,
  LogOut,
  History,
  SlidersHorizontal,
  Ban,
  AlertTriangle,
  Bell,
  ArrowLeftRight,
  ClipboardCheck,
  Landmark,
  Banknote,
  BarChart3,
  FileSearch,
  Activity,
  Settings,
  Percent,
  Monitor,
  ChevronRight,
  LucideIcon,
  LogIn,
  HelpCircle,
  FileWarning,
  ListChecks,
} from 'lucide-react';
import { OpenShiftDialog } from '@/components/cashier/OpenShiftDialog';
import { CloseShiftDialog } from '@/components/cashier/CloseShiftDialog';
import { HelpSupportDialog } from '@/components/cashier/HelpSupportDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHelpRequests, getLocalHelpRequests } from '@/lib/pos-api';

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ownerMainSections: NavSection[] = [
  {
    title: 'Sales',
    items: [
      { label: 'Transactions', path: '/transactions', icon: History },
      { label: 'Voids & Refunds', path: '/voids-refunds', icon: Ban },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Stock Overview', path: '/inventory', icon: Boxes },
      { label: 'Movements', path: '/inventory/movements', icon: ArrowLeftRight },
      { label: 'Stock Takes', path: '/inventory/stock-take', icon: ClipboardCheck },
      { label: 'Adjustments', path: '/inventory/stock-adjustments', icon: SlidersHorizontal },
    ],
  },
  {
    title: 'Suppliers',
    items: [
      { label: 'Suppliers', path: '/suppliers', icon: Truck },
      { label: 'Purchase Orders', path: '/suppliers/purchase-orders', icon: FileText },
      { label: 'Deliveries & Invoices', path: '/suppliers/deliveries', icon: Package },
      { label: 'Variance Cases', path: '/variance-approvals', icon: AlertTriangle },
    ],
  },
  {
    title: 'Cash',
    items: [
      { label: 'Reconciliation', path: '/cash/reconciliation', icon: Banknote },
      { label: 'Bank Deposits', path: '/cash/bank-deposits', icon: Landmark },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Sales', path: '/reports', icon: BarChart3 },
      { label: 'Inventory', path: '/reports/inventory', icon: Boxes },
      { label: 'Financial', path: '/reports/financial', icon: FileText },
      { label: 'Audit', path: '/reports/audit', icon: FileSearch },
    ],
  },
  {
    title: 'Security & Audit',
    items: [
      { label: 'Audit Log', path: '/audit', icon: Shield },
      { label: 'User Activity', path: '/audit/user-activity', icon: Activity },
    ],
  },
];

const ownerOnlyItems: NavItem[] = [
  { label: 'Users & Roles', path: '/users', icon: Users },
  { label: 'System Settings', path: '/admin/settings', icon: Settings },
  { label: 'Discount Rules', path: '/admin/discount-rules', icon: Percent },
  { label: 'Devices & Terminals', path: '/admin/devices', icon: Monitor },
];

function isPathInSection(pathname: string, section: NavSection): boolean {
  return section.items.some(
    (item) => pathname === item.path || (item.path.length > 1 && pathname.startsWith(item.path + '/'))
  );
}

function NavLinkStyle({
  to,
  icon: Icon,
  children,
  isActive,
  subtle,
  badge,
}: {
  to: string;
  icon: LucideIcon;
  children: React.ReactNode;
  isActive: boolean;
  subtle?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors px-3 py-2',
        subtle ? 'text-muted-foreground hover:text-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-primary gold-glow'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span className="flex-1 min-w-0">{children}</span>
      {typeof badge === 'number' && (
        <span
          className={cn(
            'flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
            badge > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
          aria-label={`${badge} unread notification${badge !== 1 ? 's' : ''}`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

export default function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const shift = useShift();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ownerMainSections.forEach((s) => {
      initial[s.title] = isPathInSection(pathname, s);
    });
    return initial;
  });

  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [helpSupportOpen, setHelpSupportOpen] = useState(false);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  if (!user) return null;

  const isOwner = user.role === 'owner';
  const isCashier = user.role === 'cashier';
  const isManager = user.role === 'manager' || user.role === 'senior_manager';

  const { data: helpRequestsData } = useQuery({
    queryKey: ['help-requests', 'count'],
    queryFn: async () => {
      const api = (await getHelpRequests('pending')) ?? [];
      const local = getLocalHelpRequests().filter((r) => r.status === 'pending');
      return [...local, ...api];
    },
    refetchInterval: 5000,
    staleTime: 2000,
    enabled: isOwner || isManager,
  });
  const unreadNotificationCount = Array.isArray(helpRequestsData) ? helpRequestsData.length : 0;

  useEffect(() => {
    if (isCashier && !shift.isOpen && (pathname === '/pos' || pathname.startsWith('/pos/'))) {
      setOpenShiftOpen(true);
    }
  }, [isCashier, shift.isOpen, pathname]);

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="King G" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          <div className="min-w-0">
            <h1 className="font-display text-base font-semibold tracking-wide text-foreground">KING G</h1>
            <p className="text-xs text-muted-foreground">Lifestyle & Lounge</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {isOwner ? (
          <div className="flex flex-col gap-1">
            <div className="mb-2 flex flex-col gap-0.5">
              <NavLinkStyle to="/dashboard" icon={LayoutDashboard} isActive={pathname === '/dashboard'}>
                Dashboard
              </NavLinkStyle>
              <NavLinkStyle
                to="/notifications"
                icon={Bell}
                isActive={pathname === '/notifications'}
                badge={unreadNotificationCount}
              >
                Alerts & Help
              </NavLinkStyle>
            </div>
            {ownerMainSections.map((section) => {
              const isOpen = openSections[section.title] ?? isPathInSection(pathname, section);
              return (
                <Collapsible
                  key={section.title}
                  open={isOpen}
                  onOpenChange={() => toggleSection(section.title)}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                    <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                    {section.title}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="ml-1 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                      {section.items.map((item) => {
                        const isActive =
                          pathname === item.path || (item.path.length > 1 && pathname.startsWith(item.path + '/'));
                        return (
                          <li key={item.path}>
                            <NavLinkStyle to={item.path} icon={item.icon} isActive={!!isActive} subtle>
                              {item.label}
                            </NavLinkStyle>
                          </li>
                        );
                      })}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            <div className="mt-4 border-t border-sidebar-border pt-4">
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Owner</p>
              <ul className="space-y-0.5">
                {ownerOnlyItems.map((item) => {
                  const isActive =
                    pathname === item.path || (item.path.length > 1 && pathname.startsWith(item.path + '/'));
                  return (
                    <li key={item.path}>
                      <NavLinkStyle to={item.path} icon={item.icon} isActive={!!isActive}>
                        {item.label}
                      </NavLinkStyle>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : isCashier ? (
          <div className="flex flex-col gap-1">
            <NavLinkStyle to="/pos" icon={ShoppingCart} isActive={pathname === '/pos'}>
              POS Terminal
            </NavLinkStyle>
            <NavLinkStyle to="/pos/sales-history" icon={History} isActive={pathname.startsWith('/pos/sales-history')}>
              Sales History
            </NavLinkStyle>
            <div className="my-1 border-t border-sidebar-border pt-2" />
            <button
              type="button"
              onClick={() => setHelpSupportOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <HelpCircle className="h-4 w-4 shrink-0 opacity-80" />
              Help / Support
            </button>
            <HelpSupportDialog open={helpSupportOpen} onOpenChange={setHelpSupportOpen} />
          </div>
        ) : isManager ? (
          <div className="flex flex-col gap-1">
            {/* Overview */}
            <p className="px-3 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</p>
            <div className="flex flex-col gap-0.5">
              <NavLinkStyle to="/dashboard" icon={LayoutDashboard} isActive={pathname === '/dashboard'}>
                Dashboard
              </NavLinkStyle>
              <NavLinkStyle to="/ops/approvals" icon={ListChecks} isActive={pathname === '/ops/approvals'}>
                Approvals
              </NavLinkStyle>
              <NavLinkStyle
                to="/notifications"
                icon={Bell}
                isActive={pathname === '/notifications'}
                badge={unreadNotificationCount}
              >
                Alerts & Help
              </NavLinkStyle>
            </div>

            {/* Orders & deliveries — Senior Manager only */}
            {user.role === 'senior_manager' && (
              <>
                <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orders & deliveries</p>
                <div className="flex flex-col gap-0.5">
                  <NavLinkStyle to="/suppliers/purchase-orders" icon={FileText} isActive={pathname === '/suppliers/purchase-orders' || pathname.startsWith('/suppliers/purchase-orders')}>
                    Purchase orders
                  </NavLinkStyle>
                  <NavLinkStyle to="/suppliers/deliveries" icon={Package} isActive={pathname === '/suppliers/deliveries' || pathname.startsWith('/suppliers/deliveries')}>
                    Deliveries & invoices
                  </NavLinkStyle>
                  <NavLinkStyle to="/inventory" icon={Boxes} isActive={pathname === '/inventory' || pathname.startsWith('/inventory')}>
                    Lounge & warehouse overview
                  </NavLinkStyle>
                </div>
              </>
            )}

            {/* Operations */}
            <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operations</p>
            <div className="flex flex-col gap-0.5">
              <NavLinkStyle to="/ops/discrepancies" icon={AlertTriangle} isActive={pathname === '/ops/discrepancies'}>
                Discrepancies
              </NavLinkStyle>
              <NavLinkStyle to="/ops/incidents" icon={FileWarning} isActive={pathname === '/ops/incidents'}>
                Incident Log
              </NavLinkStyle>
            </div>

            {/* Reports & promos — Senior Manager only */}
            {user.role === 'senior_manager' && (
              <>
                <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reports & promos</p>
                <div className="flex flex-col gap-0.5">
                  <NavLinkStyle to="/reports" icon={BarChart3} isActive={pathname === '/reports' || pathname.startsWith('/reports/')}>
                    Reports
                  </NavLinkStyle>
                  <NavLinkStyle to="/ops/promotions" icon={Percent} isActive={pathname === '/ops/promotions'}>
                    Promotions
                  </NavLinkStyle>
                </div>
              </>
            )}
          </div>
        ) : null}
      </nav>

      {/* Shift: open/end + shift history — cashiers only */}
      {isCashier && (
        <>
          <div className="border-t border-sidebar-border px-3 py-2">
            {shift.isOpen && (
              <div className="mx-0 mb-2 rounded-md bg-success/15 border border-success/30 px-2 py-1.5 text-xs font-medium text-success">
                Shift open
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpenShiftOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogIn className="h-4 w-4 shrink-0 opacity-80" />
              Open shift
            </button>
            <button
              type="button"
              onClick={() => setCloseShiftOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-80" />
              End shift / Cash-up
            </button>
            <NavLinkStyle
              to="/shift-history"
              icon={History}
              isActive={pathname.startsWith('/shift-history')}
            >
              Shift history
            </NavLinkStyle>
          </div>
          <OpenShiftDialog open={openShiftOpen} onOpenChange={setOpenShiftOpen} />
          <CloseShiftDialog open={closeShiftOpen} onOpenChange={setCloseShiftOpen} />
        </>
      )}

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-primary">{roleLabels[user.role]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
