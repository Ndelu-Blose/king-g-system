import { useState, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { getReportBySlug } from '@/lib/report-config';
import { exportReportAsCSV } from '@/lib/export-report';
import { getAllProducts, getTransactionsFromApi } from '@/lib/pos-api';
import { summarizeTransactions, transactionsInDateRange } from '@/lib/sales-stats';
import { useInventory } from '@/contexts/InventoryContext';
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
  Legend,
} from 'recharts';
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

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'This month' },
] as const;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const CHART_COLORS = ['hsl(32, 45%, 58%)', 'hsl(38, 60%, 65%)', 'hsl(220, 15%, 40%)', 'hsl(142, 71%, 45%)', 'hsl(220, 10%, 55%)', 'hsl(220, 15%, 30%)'];

const tooltipStyle = {
  backgroundColor: 'hsl(220 18% 13%)',
  border: '1px solid hsl(220 15% 20%)',
  borderRadius: '8px',
  color: 'hsl(40 20% 92%)',
};

export default function ReportDetail() {
  const { reportSlug } = useParams<{ reportSlug: string }>();
  const report = reportSlug ? getReportBySlug(reportSlug) : null;

  const today = useMemo(() => toDateStr(new Date()), []);
  const defaultFrom = useMemo(() => toDateStr(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)), []);

  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d');
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [category, setCategory] = useState<string>('all');
  const [location, setLocation] = useState<'all' | 'lounge' | 'warehouse'>('all');

  const setPeriodAndDates = (p: 'today' | '7d' | '30d') => {
    setPeriod(p);
    const now = new Date();
    const to = toDateStr(now);
    if (p === 'today') {
      setDateFrom(to);
      setDateTo(to);
    } else if (p === '7d') {
      setDateFrom(toDateStr(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)));
      setDateTo(to);
    } else {
      setDateFrom(toDateStr(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)));
      setDateTo(to);
    }
  };

  const { inventory } = useInventory();
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['transactions', 'reports'],
    queryFn: () => getTransactionsFromApi(null),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products', 'reports'],
    queryFn: getAllProducts,
  });

  const categories = useMemo(() => ['all', ...new Set(products.map((p) => p.category))], [products]);

  const transactionsInRange = useMemo(
    () => transactionsInDateRange(allTransactions, dateFrom, dateTo),
    [allTransactions, dateFrom, dateTo]
  );

  const filteredSummary = useMemo(() => {
    const base = summarizeTransactions(transactionsInRange);
    return {
      totalSales: base.totalSales,
      transactionCount: base.transactionCount,
      cashSales: base.cashSales,
      cardSales: base.cardSales,
    };
  }, [transactionsInRange]);

  const salesBarData = useMemo(() => {
    if (transactionsInRange.length === 0) return [];
    const byDay = new Map<string, number>();
    transactionsInRange.forEach((t) => {
      const day = t.createdAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + t.total);
    });
    const sorted = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([day, sales]) => ({ day: day.slice(5) || day, sales }));
  }, [transactionsInRange]);

  const paymentPieData = [
    { name: 'Cash', value: filteredSummary.cashSales, fill: 'hsl(142, 71%, 45%)' },
    { name: 'Card', value: filteredSummary.cardSales, fill: 'hsl(220, 15%, 40%)' },
  ].filter((d) => d.value > 0);

  const cashierData = useMemo(() => {
    const byCashier = new Map<string, { sales: number; count: number }>();
    transactionsInRange.forEach((t) => {
      const cur = byCashier.get(t.cashierName) ?? { sales: 0, count: 0 };
      cur.sales += t.total;
      cur.count += 1;
      byCashier.set(t.cashierName, cur);
    });
    return Array.from(byCashier.entries()).map(([name, d]) => ({ name, sales: d.sales, transactions: d.count }));
  }, [transactionsInRange]);

  const productSalesData = useMemo(() => {
    const byProduct = new Map<string, number>();
    transactionsInRange.forEach((t) => {
      t.items.forEach((i) => {
        byProduct.set(i.productName, (byProduct.get(i.productName) ?? 0) + i.qty * i.price);
      });
    });
    return products
      .map((p) => ({ name: p.name, sales: byProduct.get(p.name) ?? 0, category: p.category }))
      .filter((r) => category === 'all' || r.category === category)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [category, transactionsInRange, products]);

  const categoryPieData = useMemo(() => {
    const byCat = new Map<string, number>();
    productSalesData.forEach((r) => {
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.sales);
    });
    return Array.from(byCat.entries()).map(([category, value], i) => ({
      category,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [productSalesData]);

  const stockLevelData = useMemo(() => {
    const filtered =
      location === 'all'
        ? inventory
        : location === 'lounge'
          ? inventory.filter((i) => i.loungeQty > 0)
          : inventory.filter((i) => i.warehouseQty > 0);
    return filtered
      .map((i) => ({
        name: i.productName.length > 15 ? i.productName.slice(0, 15) + '…' : i.productName,
        lounge: i.loungeQty,
        warehouse: i.warehouseQty,
        total: i.totalQty,
      }))
      .slice(0, 12);
  }, [location]);

  const reconciliationData = [
    { name: 'Expected', cash: filteredSummary.cashSales },
    { name: 'Actual', cash: filteredSummary.cashSales },
  ];

  if (!report) return <Navigate to="/reports" replace />;

  const ReportIcon = report.icon;
  const showCategoryFilter = ['product-performance', 'stock-level'].includes(report.slug);
  const showLocationFilter = ['stock-level', 'stock-movement'].includes(report.slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <BackButton to="/reports" label="Back to Reports" />
      </div>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ReportIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{report.title}</h1>
            <p className="text-sm text-muted-foreground">{report.description}</p>
          </div>
        </div>
        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
          {report.category}
        </span>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Period</span>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodAndDates(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="report-date-from" className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            id="report-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPeriod('7d'); }}
            className="h-9 w-[130px]"
          />
          <Label htmlFor="report-date-to" className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            id="report-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPeriod('7d'); }}
            className="h-9 w-[130px]"
          />
        </div>
        {showCategoryFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Category</span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === 'all' ? 'All' : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {showLocationFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Location</span>
            <Select value={location} onValueChange={(v) => setLocation(v as typeof location)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="lounge">Lounge</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Showing: {dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`}
          {showCategoryFilter && category !== 'all' && ` · ${category}`}
          {showLocationFilter && location !== 'all' && ` · ${location}`}
        </span>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportReportAsCSV(report.slug, report.title)}
          className="gap-1.5"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Report content: charts per slug */}
      <div className="space-y-6">
        {report.slug === 'daily-sales' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground">Total sales</p>
                <p className="text-xl font-bold text-foreground">R{filteredSummary.totalSales.toLocaleString()}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-xl font-bold text-foreground">{filteredSummary.transactionCount}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground">Cash</p>
                <p className="text-xl font-bold text-foreground">R{filteredSummary.cashSales.toLocaleString()}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground">Card</p>
                <p className="text-xl font-bold text-foreground">R{filteredSummary.cardSales.toLocaleString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-5">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">Sales trend</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={salesBarData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R${v.toLocaleString()}`, 'Sales']} />
                    <Bar dataKey="sales" fill="hsl(32, 45%, 58%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-5">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">Payment breakdown</h3>
                {paymentPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={paymentPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {paymentPieData.map((_, i) => (
                          <Cell key={i} fill={paymentPieData[i].fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R${v.toLocaleString()}`]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment data for selected period.</p>
                )}
              </div>
            </div>
          </>
        )}

        {report.slug === 'cashier-performance' && (
          <>
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Sales by cashier</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cashierData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R${v.toLocaleString()}`, 'Sales']} />
                  <Bar dataKey="sales" fill="hsl(32, 45%, 58%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Transactions per cashier</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cashierData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="transactions" fill="hsl(220, 15%, 40%)" radius={[6, 6, 0, 0]} name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {report.slug === 'product-performance' && (
          <>
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Top products by sales</h3>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={productSalesData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R${v.toLocaleString()}`, 'Sales']} />
                  <Bar dataKey="sales" fill="hsl(32, 45%, 58%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Sales by category</h3>
              {categoryPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      dataKey="value"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {categoryPieData.map((_, i) => (
                        <Cell key={i} fill={categoryPieData[i].fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R${v.toLocaleString()}`]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data for selected category.</p>
              )}
            </div>
          </>
        )}

        {report.slug === 'stock-level' && (
          <>
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Stock by product (Lounge vs Warehouse)</h3>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={stockLevelData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="lounge" fill="hsl(32, 45%, 58%)" stackId="a" name="Lounge" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="warehouse" fill="hsl(220, 15%, 40%)" stackId="a" name="Warehouse" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {report.slug === 'stock-movement' && (
          <div className="glass-card p-5">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">Stock movements</h3>
            <p className="text-sm text-muted-foreground">No movement history recorded for the selected period.</p>
          </div>
        )}

        {report.slug === 'cash-reconciliation' && (
          <>
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Expected vs actual cash</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={reconciliationData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R${v.toLocaleString()}`, 'Amount']} />
                  <Bar dataKey="cash" fill="hsl(32, 45%, 58%)" radius={[6, 6, 0, 0]} name="Cash" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Variance trend</h3>
              <p className="text-sm text-muted-foreground">No reconciliation variance data for the selected period.</p>
            </div>
          </>
        )}

        {report.slug === 'void-refund' && (
          <div className="glass-card p-5">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">Void & refund summary</h3>
            <p className="text-sm text-muted-foreground">
              {transactionsInRange.filter((t) => t.status === 'void' || t.status === 'refunded').length === 0
                ? 'No void or refund transactions in the selected period.'
                : `${transactionsInRange.filter((t) => t.status === 'void').length} voided, ${transactionsInRange.filter((t) => t.status === 'refunded').length} refunded.`}
            </p>
          </div>
        )}

        {report.slug === 'supplier-variance' && (
          <div className="glass-card p-5">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">Delivery variance trend</h3>
            <p className="text-sm text-muted-foreground">No supplier delivery variance data for the selected period.</p>
          </div>
        )}
      </div>
    </div>
  );
}
