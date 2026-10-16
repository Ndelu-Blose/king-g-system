import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileWarning, Plus, Loader2 } from 'lucide-react';
import { getIncidents } from '@/lib/ops-store';
import { getIncidentReports, resolveIncidentReport, saveIncidentReport } from '@/lib/pos-api';
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
import { validateUploadFile, uploadIncidentAttachment, getIncidentAttachmentUrl } from '@/lib/file-upload';

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
  const queryClient = useQueryClient();
  const { data: list = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const remote = await getIncidentReports();
      const known = new Set(remote.map((row) => row.id));
      const local = getIncidents();
      for (const row of local) {
        if (known.has(row.id)) continue;
        const saved = await saveIncidentReport({
          id: row.id,
          type: row.type,
          title: row.title,
          description: row.description,
          location: row.location,
          reportedAt: row.reportedAt,
          reportedBy: row.reportedBy,
          attachmentName: row.attachmentName,
          attachmentStoragePath: row.attachmentStoragePath,
        });
        remote.push(saved);
        known.add(saved.id);
      }
      if (local.length) localStorage.removeItem('kingg_incidents');
      return remote;
    },
  });
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required.');
      return;
    }
    if (attachmentFile) {
      const check = validateUploadFile(attachmentFile, 'Attachment', { required: false });
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
    }

    setSubmitting(true);
    try {
      const incidentId = `inc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      let attachmentName: string | undefined;
      let attachmentStoragePath: string | undefined;

      if (attachmentFile) {
        const uploaded = await uploadIncidentAttachment(attachmentFile, incidentId);
        attachmentName = uploaded.fileName;
        attachmentStoragePath = uploaded.storagePath;
      }

      await saveIncidentReport({
        id: incidentId,
        type,
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        attachmentName,
        attachmentStoragePath,
      });
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setShowForm(false);
      setTitle('');
      setDescription('');
      setLocation('');
      setAttachmentFile(null);
      toast.success('Incident report saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save incident report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveIncidentReport(id);
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Marked as resolved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resolve the incident.');
    }
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
          <div className="space-y-2">
            <Label>Attachment (optional)</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <FileWarning className="w-4 h-4 mr-2" />
                Save report
              </>
            )}
          </Button>
        </form>
      )}

      <div className="glass-card overflow-hidden rounded-xl">
        <h2 className="font-display text-lg font-semibold text-foreground px-5 py-3 border-b border-border">
          Open ({open.length})
        </h2>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading incidents…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            Could not load incidents.
            <Button variant="link" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : open.length === 0 ? (
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
                  {r.attachmentName && r.attachmentStoragePath ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs mt-1"
                      onClick={async () => {
                        try {
                          const url = await getIncidentAttachmentUrl(r.attachmentStoragePath!);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed to open attachment');
                        }
                      }}
                    >
                      View attachment: {r.attachmentName}
                    </Button>
                  ) : null}
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
