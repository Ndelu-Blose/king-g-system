import { Percent, Link2, Tag, Clock } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useHappyHour } from '@/contexts/HappyHourContext';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';

export default function PromotionsPage() {
  const {
    discountPercent,
    setDiscountPercent,
    isActive,
    isWithinHappyHourWindow,
    happyHourWindowLabel,
  } = useHappyHour();
  const [percentInput, setPercentInput] = useState(String(discountPercent));

  const handleApply = () => {
    const n = Number.parseFloat(percentInput);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      toast.error('Enter a discount between 0 and 100.');
      return;
    }
    setDiscountPercent(n);
    setPercentInput(String(n));
    toast.success(n > 0 ? `Promotion applied: ${n}% off at POS.` : 'Promotion cleared.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Percent className="h-6 w-6 text-primary" />
          Promotions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage promotions and special offers. Set a store-wide discount that applies at the POS and in sales.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Current promotion (store-wide discount)
          </CardTitle>
          <CardDescription>
            This discount applies to all products at the POS unless a product has its own discount set in Products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="promo-percent">Discount % (0 = no promotion)</Label>
              <Input
                id="promo-percent"
                type="number"
                min={0}
                max={100}
                step={1}
                value={percentInput}
                onChange={(e) => setPercentInput(e.target.value)}
                onBlur={() => {
                  const n = Number.parseFloat(percentInput);
                  if (!Number.isNaN(n)) setPercentInput(String(Math.max(0, Math.min(100, n))));
                }}
                className="w-24"
              />
            </div>
            <Button onClick={handleApply}>Apply</Button>
          </div>
          {isActive && (
            <p className="text-sm text-primary font-medium">
              Active: {discountPercent}% off is applied at the POS and in sales.
            </p>
          )}
        </CardContent>
      </Card>

      {happyHourWindowLabel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Happy hour (time-based discount)
            </CardTitle>
            <CardDescription>
              Configured in Discount Rules. The discount applies only to the items you selected there, and only during this time window.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">
              Window: <span className="text-primary">{happyHourWindowLabel}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {isWithinHappyHourWindow
                ? 'Currently within happy hour — discount is applied at the POS.'
                : 'Outside happy hour — store-wide discount is not applied (per-product discounts still apply).'}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/discount-rules">Change window in Discount Rules</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Discount rules
          </CardTitle>
          <CardDescription>
            Time-based discounts (e.g. happy hour), maximum discount limits, and approval rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/admin/discount-rules">Open Discount Rules</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
