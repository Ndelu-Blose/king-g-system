import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockMovementsTable } from './StockMovementsTable';
import type { StockMovement } from '@/lib/pos-api';

const transfer: StockMovement = {
  id: '1',
  createdAt: '2026-10-15T08:00:00.000Z',
  type: 'TRANSFER',
  productId: 'p1',
  productName: 'Castle Lite',
  qty: 4,
  fromLocation: 'warehouse',
  toLocation: 'lounge',
  reference: null,
  supplier: null,
  reason: null,
  actorId: 'u1',
  actorName: 'Owner',
  deliveryRecordId: null,
};

describe('StockMovementsTable', () => {
  it('shows a transfer as warehouse to lounge', () => {
    render(<StockMovementsTable movements={[transfer]} />);
    expect(screen.getByText('Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Lounge')).toBeInTheDocument();
    expect(screen.getByText('Castle Lite')).toBeInTheDocument();
  });
});
