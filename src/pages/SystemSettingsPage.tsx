import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { BackButton } from '@/components/BackButton';

const STORAGE_KEY = 'kingg-system-settings';

interface SystemSettings {
  taxRate: number;
  businessName: string;
  receiptFooter: string;
  lowStockThreshold: number;
}

const defaults: SystemSettings = {
  taxRate: 15,
  businessName: 'King G Lifestyle & Lounge',
  receiptFooter: 'Thank you for your visit.',
  lowStockThreshold: 5,
};

function load(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return defaults;
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(load);

  useEffect(() => {
    setSettings(load());
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast.success('Settings saved.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          System Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tax, locations, receipt settings, and thresholds.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tax & business</CardTitle>
            <CardDescription>VAT rate and business name shown on receipts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tax">VAT rate (%)</Label>
              <Input
                id="tax"
                type="number"
                min={0}
                max={100}
                value={settings.taxRate}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, taxRate: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business">Business name</Label>
              <Input
                id="business"
                value={settings.businessName}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, businessName: e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
            <CardDescription>Footer text printed on receipts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="footer">Receipt footer</Label>
              <Input
                id="footer"
                value={settings.receiptFooter}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, receiptFooter: e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Alert when stock falls below this level.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="low">Low stock threshold (units)</Label>
              <Input
                id="low"
                type="number"
                min={0}
                value={settings.lowStockThreshold}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    lowStockThreshold: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save settings
        </Button>
      </div>
    </div>
  );
}
