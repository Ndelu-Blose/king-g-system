import { Shield, Filter } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

const logs = [
  { id: 1, user: 'Sipho N.', action: 'SALE_COMPLETED', entity: 'Transaction TXN-001', details: 'R140.00 - Cash payment', timestamp: '2026-02-17 14:32:15' },
  { id: 2, user: 'Sipho N.', action: 'SALE_COMPLETED', entity: 'Transaction TXN-002', details: 'R120.00 - Card payment', timestamp: '2026-02-17 14:15:33' },
  { id: 3, user: 'Lerato K.', action: 'STOCK_TRANSFER', entity: 'Hennessy VS (x12)', details: 'Warehouse → Lounge', timestamp: '2026-02-17 13:45:00' },
  { id: 4, user: 'Thabo M.', action: 'DELIVERY_RECORDED', entity: 'PO-2026-015', details: 'SA Breweries - 48 units received', timestamp: '2026-02-17 11:20:00' },
  { id: 5, user: 'King G', action: 'VARIANCE_APPROVED', entity: 'Stock Take ST-042', details: 'Approved 3 variances', timestamp: '2026-02-17 10:00:00' },
  { id: 6, user: 'King G', action: 'USER_CREATED', entity: 'User: new.cashier@kingg.co.za', details: 'Role: Cashier', timestamp: '2026-02-16 16:30:00' },
  { id: 7, user: 'Sipho N.', action: 'LOGIN', entity: 'Session', details: 'POS Terminal 1', timestamp: '2026-02-17 08:00:00' },
];

const actionColors: Record<string, string> = {
  SALE_COMPLETED: 'text-success bg-success/10',
  STOCK_TRANSFER: 'text-primary bg-primary/10',
  DELIVERY_RECORDED: 'text-primary bg-primary/10',
  VARIANCE_APPROVED: 'text-warning bg-warning/10',
  USER_CREATED: 'text-foreground bg-secondary',
  LOGIN: 'text-muted-foreground bg-secondary',
};

export default function AuditLogs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Immutable record of all system activities</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-sidebar-accent transition-colors">
          <Filter className="w-4 h-4" />
          Filter Logs
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="space-y-0">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-4 px-5 py-4 border-b border-border/50 hover:bg-secondary/20 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{log.user}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${actionColors[log.action] || 'text-muted-foreground bg-secondary'}`}>
                    {log.action}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-1">{log.entity}</p>
                <p className="text-xs text-muted-foreground">{log.details}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
