import { useState } from 'react';
import { Activity, LogIn, UserCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BackButton } from '@/components/BackButton';

type ActivityType = 'login' | 'approval' | 'action';

interface ActivityRecord {
  id: string;
  time: string;
  user: string;
  type: ActivityType;
  action: string;
  detail?: string;
}

const mockActivity: ActivityRecord[] = [
  { id: '1', time: '2026-02-26 14:35', user: 'King G', type: 'login', action: 'Login', detail: 'Owner' },
  { id: '2', time: '2026-02-26 14:20', user: 'Thabo M.', type: 'approval', action: 'Approved refund', detail: 'REF-001' },
  { id: '3', time: '2026-02-26 13:50', user: 'Sipho N.', type: 'action', action: 'Void transaction', detail: 'TXN-004' },
  { id: '4', time: '2026-02-26 12:00', user: 'Lerato K.', type: 'login', action: 'Login', detail: 'Manager' },
  { id: '5', time: '2026-02-26 11:45', user: 'Thabo M.', type: 'approval', action: 'Approved stock adjustment', detail: 'Adj-012' },
];

function IconForType({ type }: { type: ActivityType }) {
  if (type === 'login') return <LogIn className="h-4 w-4" />;
  if (type === 'approval') return <UserCheck className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

export default function UserActivityPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered =
    typeFilter === 'all'
      ? mockActivity
      : mockActivity.filter((a) => a.type === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            User Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Logins, actions, and approval chain.
          </p>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="login">Logins</SelectItem>
            <SelectItem value="approval">Approvals</SelectItem>
            <SelectItem value="action">Actions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Time</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">User</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 text-muted-foreground">{a.time}</td>
                <td className="px-5 py-3 font-medium text-foreground">{a.user}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    <IconForType type={a.type} className="text-muted-foreground" />
                    {a.type}
                  </span>
                </td>
                <td className="px-5 py-3 text-foreground">{a.action}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{a.detail || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
