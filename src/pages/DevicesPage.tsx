import { useState, useEffect } from 'react';
import { Monitor, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BackButton } from '@/components/BackButton';

const STORAGE_KEY = 'kingg-devices';

interface Terminal {
  id: string;
  name: string;
  terminalId: string;
  location: string;
  registeredAt: string;
  active: boolean;
}

function loadDevices(): Terminal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [
    { id: '1', name: 'POS 1', terminalId: 'T-001', location: 'Main bar', registeredAt: '2026-01-15', active: true },
    { id: '2', name: 'POS 2', terminalId: 'T-002', location: 'Lounge', registeredAt: '2026-01-15', active: true },
  ];
}

function saveDevices(devices: Terminal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Terminal[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    setDevices(loadDevices());
  }, []);

  const handleRegister = () => {
    if (!name.trim() || !terminalId.trim()) {
      toast.error('Name and Terminal ID are required.');
      return;
    }
    const newDevice: Terminal = {
      id: String(Date.now()),
      name: name.trim(),
      terminalId: terminalId.trim().toUpperCase(),
      location: location.trim() || '—',
      registeredAt: new Date().toISOString().slice(0, 10),
      active: true,
    };
    const next = [...devices, newDevice];
    setDevices(next);
    saveDevices(next);
    setOpen(false);
    setName('');
    setTerminalId('');
    setLocation('');
    toast.success('Terminal registered.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" />
            Devices & Terminals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register terminals and manage terminal IDs.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Register terminal
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Terminal ID</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Location</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Registered</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-5 py-3 font-medium text-foreground">{d.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{d.terminalId}</td>
                <td className="px-5 py-3 text-muted-foreground">{d.location}</td>
                <td className="px-5 py-3 text-muted-foreground">{d.registeredAt}</td>
                <td className="px-5 py-3">
                  {d.active ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register terminal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. POS 3"
              />
            </div>
            <div className="space-y-2">
              <Label>Terminal ID</Label>
              <Input
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                placeholder="e.g. T-003"
              />
            </div>
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Patio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleRegister}>Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
