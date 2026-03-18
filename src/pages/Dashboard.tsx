import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { BackButton } from '@/components/BackButton';
import { dailyStats, weeklySalesData, categorySalesData, mockTransactions } from '@/lib/mock-data';
import { getDiscrepancies } from '@/lib/ops-store';
import { getShiftHistory } from '@/lib/shift-history';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Clock,
  CreditCard,
  Banknote,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const statCards = [
  { label: "Today's sales", value: `R${dailyStats.totalSales.toLocaleString()}`, icon: DollarSign },
  { label: 'Transactions', value: dailyStats.transactionCount.toString(), icon: ShoppingCart },
  { label: 'Avg. transaction', value: `R${dailyStats.avgTransaction.toFixed(0)}`, icon: TrendingUp },
  { label: 'Pending approvals', value: dailyStats.pendingApprovals.toString(), icon: AlertTriangle },
];

/** Operations dashboard for managers: at a glance and items needing attention. */
function ManagerOpsDashboard() {
  const openDiscrepancies = getDiscrepancies().filter((r) => !r.resolved).length;
  const shiftHistory = getShiftHistory();
  const shiftsWithVariance = shiftHistory.filter((s) => s.variance !== 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <section>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Today</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Sales</p>
            <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">R{dailyStats.totalSales.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Transactions</p>
            <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">{dailyStats.transactionCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Open discrepancies</p>
            <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">{openDiscrepancies}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Shifts with variance</p>
            <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">{shiftsWithVariance}</p>
            <p className="text-xs text-muted-foreground mt-0.5">of {shiftHistory.length} closed</p>
          </div>
        </div>
      </section>

      {(openDiscrepancies > 0 || shiftsWithVariance > 0) && (
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Needs attention</h2>
          <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap gap-6">
            {openDiscrepancies > 0 && (
              <Link to="/ops/discrepancies" className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium hover:underline">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {openDiscrepancies} open discrepancy{openDiscrepancies !== 1 ? 's' : ''}
              </Link>
            )}
            {shiftsWithVariance > 0 && (
              <Link to="/ops/shifts" className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium hover:underline">
                <CalendarClock className="w-4 h-4 shrink-0" />
                {shiftsWithVariance} shift{shiftsWithVariance !== 1 ? 's' : ''} with cash variance
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';
  const isManager = user?.role === 'manager' || user?.role === 'senior_manager';
  const isOwner = user?.role === 'owner';
  const showRecentTransactions = isOwner || user?.role === 'senior_manager';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      {/* Manager: simple ops dashboard */}
      {isManager && !isOwner ? (
        <ManagerOpsDashboard />
      ) : (
      <>
      {/* Header for non-manager (owner/cashier) */}
      {!isManager && (
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.name && <span className="text-foreground">{user.name}</span>}
          {' · '}
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      )}

      {isCashier ? (
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Today</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Your sales</p>
                  <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">R{dailyStats.totalSales.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Transactions</p>
                  <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">{dailyStats.transactionCount}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">{stat.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <stat.icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Sales</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-foreground mb-4">Weekly sales</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                  <XAxis dataKey="day" stroke="hsl(220 10% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(220 10% 55%)" fontSize={12} tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(220 18% 13%)', border: '1px solid hsl(220 15% 20%)', borderRadius: '8px', color: 'hsl(40 20% 92%)' }}
                    formatter={(value: number) => [`R${value.toLocaleString()}`, 'Sales']}
                  />
                  <Bar dataKey="sales" fill="hsl(32 45% 58%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Sales by category</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categorySalesData} dataKey="value" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {categorySalesData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(220 18% 13%)', border: '1px solid hsl(220 15% 20%)', borderRadius: '8px', color: 'hsl(40 20% 92%)' }}
                    formatter={(value: number) => [`R${value.toLocaleString()}`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {categorySalesData.map((c) => (
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
                    <span className="text-muted-foreground">{c.category}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </section>

          <section>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Payment & transactions</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Payment split</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Cash</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">R{dailyStats.cashSales.toLocaleString()}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">58%</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Card</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">R{dailyStats.cardSales.toLocaleString()}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">42%</span>
                </div>
              </div>
            </div>

            {showRecentTransactions ? (
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-foreground mb-4">Recent transactions</h3>
              <div className="space-y-3">
                {mockTransactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{txn.id}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {txn.items.map((i) => `${i.productName} × ${i.qty}`).join(', ')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Cashier: {txn.cashierName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-semibold text-foreground tabular-nums">R{txn.total}</p>
                      <p className="text-xs text-muted-foreground capitalize">{txn.paymentMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2 flex items-center justify-center min-h-[200px]">
              <p className="text-sm text-muted-foreground">Recent transactions are visible to Owner and Senior Manager.</p>
            </div>
          )}
            </div>
          </section>
        </>
      )}
      </>
    )}
    </div>
  );
}
