import { Shield, Filter } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

const actionColors: Record<string, string> = {
  SALE_COMPLETED: 'text-success bg-success/10',
  STOCK_TRANSFER: 'text-primary bg-primary/10',
  DELIVERY_RECORDED: 'text-primary bg-primary/10',
  VARIANCE_APPROVED: 'text-warning bg-warning/10',
  USER_CREATED: 'text-foreground bg-secondary',
  LOGIN: 'text-muted-foreground bg-secondary',
};

export default function AuditLogs() {
  const logs: { id: number; user: string; action: string; entity: string; details: string; timestamp: string }[] = [];

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
        {logs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No audit entries yet. Activity will appear here as users work in the system.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{log.user}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] ?? 'bg-secondary text-muted-foreground'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{log.entity}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{log.details}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
