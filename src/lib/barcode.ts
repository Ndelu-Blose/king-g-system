/** Strip scanner control characters (CR, Tab, GS) and surrounding spaces. Leading zeros stay. */
export function normalizeBarcode(raw: string): string {
  const s = String(raw ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 0x1f && code !== 0x7f) out += s[i];
  }
  return out.trim();
}
