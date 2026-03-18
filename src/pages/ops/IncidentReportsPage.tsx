import { useState } from 'react';
import { FileWarning, Plus } from 'lucide-react';
import {
  getIncidents,
  addIncident,
  resolveIncident,
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

const INCIDENT_TYPES = [
  'Security',
  'Safety',
  'Customer complaint',
  'Staff',
  'Equipment',
  'Theft / loss',
  'Other',
];

export default function IncidentReportsPage() {
  const { user } = useAuth();
  const [list, setList] = useState(() => getIncidents());
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const refresh = () => setList(getIncidents());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    addIncident({
      type,
      title: title.trim(),
      description: description.trim(),
      location: location.trim() || undefined,
      reportedBy: user?.name,
    });
    refresh();
    setShowForm(false);
    setTitle('');
    setDescription('');
    setLocation('');
    toast.success('Incident report saved.');
  };

  const handleResolve = (id: string) => {
    resolveIncident(id, 'Resolved by manager');
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
          <h1 className="font-display text-2xl font-bold text-foreground">Incident reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Log security, safety, or customer issues. One place to record and resolve them.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          {showForm ? 'Cancel' : 'Report an incident'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 max-w-md space-y-4 rounded-xl">
          <p className="text-sm text-muted-foreground mb-1">What do you need to log?</p>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short title"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>What happened?</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description — who, what, when"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional — e.g. Main bar, VIP"
            />
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            <FileWarning className="w-4 h-4 mr-2" />
            Save report
          </Button>
        </form>
      )}

      <div className="glass-card overflow-hidden rounded-xl">
        <h2 className="font-display text-lg font-semibold text-foreground px-5 py-3 border-b border-border">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nothing open. Use “Report an incident” when something needs to be logged.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {open.map((r) => (
              <li key={r.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                    {r.type}
                  </span>
                  <p className="font-medium text-foreground mt-1">{r.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>
                  {r.location && (
                    <p className="text-xs text-muted-foreground mt-1">Location: {r.location}</p>
                  )}
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
                  <span className="text-xs text-muted-foreground">{r.type}</span>
                  <span className="text-sm text-muted-foreground line-through">{r.title}</span>
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
