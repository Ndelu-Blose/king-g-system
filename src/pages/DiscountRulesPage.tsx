import { useState, useEffect } from 'react';
import { Percent, Clock, Shield, Save, Package } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useHappyHour } from '@/contexts/HappyHourContext';
import { mockProducts } from '@/lib/mock-data';
import {
  loadDiscountRules,
  saveDiscountRules,
  defaultDiscountRules,
  type DiscountRulesConfig,
} from '@/lib/discount-rules-storage';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export type { DiscountRulesConfig };

export default function DiscountRulesPage() {
  const { discountPercent, setDiscountPercent } = useHappyHour();
  const [config, setConfig] = useState<DiscountRulesConfig>(loadDiscountRules);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(loadDiscountRules());
  }, []);

  const handleSave = () => {
    const max = Math.max(0, Math.min(100, config.maxPercent));
    const defaultP = Math.max(0, Math.min(max, config.defaultPercent));
    const approval = Math.max(0, Math.min(100, config.approvalThresholdPercent));
    const next = {
      ...config,
      defaultPercent: defaultP,
      maxPercent: max,
      approvalThresholdPercent: approval,
    };
    setConfig(next);
    saveDiscountRules(next);
    setDiscountPercent(defaultP);
    setSaved(true);
    toast.success('Discount rules saved.');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Percent className="h-6 w-6 text-primary" />
          Discount Rules
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Time-based discounts, limits, and approval rules for the POS.
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time-based discount (happy hour)
            </CardTitle>
            <CardDescription>
              When enabled, the default discount applies only to the items you select below, and only during the set time window.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="time-based">Enable time-based discount</Label>
              <Switch
                id="time-based"
                checked={config.timeBasedEnabled}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, timeBasedEnabled: v }))}
              />
            </div>
            {config.timeBasedEnabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Start time</Label>
                    <Input
                      id="start"
                      type="time"
                      value={config.startTime}
                      onChange={(e) => setConfig((c) => ({ ...c, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">End time</Label>
                    <Input
                      id="end"
                      type="time"
                      value={config.endTime}
                      onChange={(e) => setConfig((c) => ({ ...c, endTime: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Select items for happy hour discount
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only these products will get the default discount % during the time window. Leave all unchecked to apply to no items.
                  </p>
                  <ScrollArea className="h-[220px] rounded-md border border-border p-3">
                    <div className="space-y-2">
                      {mockProducts.map((product) => {
                        const checked = config.happyHourProductIds.includes(product.id);
                        return (
                          <label
                            key={product.id}
                            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(checked) => {
                                setConfig((c) => ({
                                  ...c,
                                  happyHourProductIds: checked
                                    ? [...c.happyHourProductIds, product.id]
                                    : c.happyHourProductIds.filter((id) => id !== product.id),
                                }));
                              }}
                            />
                            <span className="text-sm font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground">{product.category}</span>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {config.happyHourProductIds.length > 0 && (
                    <p className="text-xs text-primary">
                      {config.happyHourProductIds.length} item{config.happyHourProductIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discount limits</CardTitle>
            <CardDescription>
              Default discount applied at POS. Maximum discount caps what cashiers can set without approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default">Default discount (%)</Label>
              <Input
                id="default"
                type="number"
                min={0}
                max={100}
                value={config.defaultPercent}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, defaultPercent: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Maximum discount (%)</Label>
              <Input
                id="max"
                type="number"
                min={0}
                max={100}
                value={config.maxPercent}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, maxPercent: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Approval rules
            </CardTitle>
            <CardDescription>
              Discounts above this percentage require manager or owner approval before applying.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="approval">Require approval above (%)</Label>
              <Input
                id="approval"
                type="number"
                min={0}
                max={100}
                value={config.approvalThresholdPercent}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    approvalThresholdPercent: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="gap-2" disabled={saved}>
          <Save className="h-4 w-4" />
          {saved ? 'Saved' : 'Save rules'}
        </Button>
      </div>
    </div>
  );
}
