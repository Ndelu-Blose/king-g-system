import { describe, expect, it } from 'vitest';
import { normalizeBarcode } from './barcode';

describe('normalizeBarcode', () => {
  it('keeps leading zeros', () => {
    expect(normalizeBarcode('0082184090466')).toBe('0082184090466');
  });

  it('strips the carriage return and group separator scanners append', () => {
    expect(normalizeBarcode('6001078012001\r')).toBe('6001078012001');
    expect(normalizeBarcode('6001078012001\u001d')).toBe('6001078012001');
  });

  it('returns empty for a suffix-only scan', () => {
    expect(normalizeBarcode('\r\n')).toBe('');
  });
});
