/** VAT rate (e.g. 0.15 = 15%). Applied to subtotal to get grand total. */
export const VAT_RATE = 0.15;

/** VAT for a sale. Zero when the cashier has turned VAT off. */
export function saleVat(subtotal: number, includeVat: boolean): number {
  if (!includeVat) return 0;
  return Math.round(subtotal * VAT_RATE * 100) / 100;
}

/** Instant placeholder thumbnail (data URL) when product has no image. */
export function getPlaceholderImageUrl(name: string): string {
  const letter = (name || '?').charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect fill="#2a2d36" width="80" height="80"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="system-ui,sans-serif" font-size="32" font-weight="600">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
