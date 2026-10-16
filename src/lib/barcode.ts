/** Strip scanner control characters (CR, Tab, GS) and surrounding spaces. Leading zeros stay. */
export function normalizeBarcode(raw: string): string {
  // Built from a string so ESLint does not flag control characters in a regex literal.
  const ctrlRe = new RegExp('[\\x00-\\x1F\\x7F]', 'g');
  return String(raw ?? '').replace(ctrlRe, '').trim();
}
