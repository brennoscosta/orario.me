/** Normalizes a phone number to E.164 (+5511999998888). Returns null when invalid. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    // Brazilian numbers typed without country code: DDD + number.
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}
