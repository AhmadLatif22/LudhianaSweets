/**
 * Normalizes a Pakistani phone number to E.164 format (e.g. "+923001234567")
 * as required by the WhatsApp Cloud API's "to" field.
 *
 * Accepts common formats customers actually type at checkout:
 *   "03001234567"   -> "+923001234567"
 *   "3001234567"    -> "+923001234567"
 *   "0092 300 123 4567" -> "+923001234567"
 *   "+92 300 1234567"   -> "+923001234567"
 */
export function normalizePakistaniPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith("0092")) normalized = normalized.slice(2);
  if (normalized.startsWith("92")) {
    // already has country code
  } else if (normalized.startsWith("0")) {
    normalized = "92" + normalized.slice(1);
  } else if (normalized.length === 10) {
    // bare "3001234567" with no leading 0 or country code
    normalized = "92" + normalized;
  } else {
    return null;
  }

  // A valid Pakistani mobile number is 92 + 10 digits = 12 digits total.
  if (normalized.length !== 12) return null;
  return "+" + normalized;
}
