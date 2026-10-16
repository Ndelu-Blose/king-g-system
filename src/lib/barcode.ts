/** Strip scanner control characters (CR, Tab, GS) and surrounding spaces. Leading zeros stay. */
export function normalizeBarcode(raw: string): string {
  return String(raw ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}
