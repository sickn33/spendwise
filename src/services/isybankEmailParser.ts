export interface ParsedIsybankEmailText {
  amount: number;
  merchant: string;
  date: Date;
  currency: string;
  details: string;
}

const INCOME_KEYWORDS = [
  'rimborso',
  'storno',
  'riaccredito',
  'accredito',
  'bonifico ricevuto'
];

const AMOUNT_PATTERNS = [
  /(?:spesa|pagamento|acquisto|addebito|rimborso|storno|accredito)[^0-9€]{0,30}(?:€|eur)?\s*(-?[0-9]{1,3}(?:[.\s][0-9]{3})*(?:[.,][0-9]{2})?)/i,
  /(?:€|eur)\s*(-?[0-9]{1,3}(?:[.\s][0-9]{3})*(?:[.,][0-9]{2})?)/i,
  /(-?[0-9]{1,3}(?:[.\s][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:€|eur)/i
];

const MERCHANT_PATTERNS = [
  /presso\s*:?\s*([a-z0-9à-ÿ&' .\-/*#]{2,100}?)(?=\s*(?:il|in data|alle|ore|con carta|con la carta|su carta|,|\.|$))/i,
  /esercente\s*:?\s*([a-z0-9à-ÿ&' .\-/*#]{2,100}?)(?=\s*(?:il|in data|alle|ore|con carta|con la carta|su carta|,|\.|$))/i,
  /a favore di\s*:?\s*([a-z0-9à-ÿ&' .\-/*#]{2,100}?)(?=\s*(?:il|in data|alle|ore|con carta|con la carta|su carta|,|\.|$))/i,
  /da\s+([a-z0-9à-ÿ&' .\-/*#]{2,100}?)(?=\s*(?:il|in data|alle|ore|con carta|con la carta|su carta|,|\.|$))/i,
  /(?:pagamento|spesa|acquisto)\s+carta\s+([a-z0-9à-ÿ&' .\-/*#]{2,100}?)(?=\s+(?:di|da|il|in data|alle|ore|,|\.|$))/i
];

const GENERIC_MERCHANT_WORDS = new Set([
  'TRANSAZIONE',
  'CARTA',
  'PAGAMENTO',
  'OPERAZIONE',
  'SPESA',
  'ACQUISTO',
  'ISYBANK',
  'EUR',
  'EURO'
]);

function normalizeText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLocalizedAmount(rawAmount: string): number {
  const compact = rawAmount.replace(/\s/g, '');
  if (compact.includes(',') && compact.includes('.')) {
    return Number.parseFloat(compact.replace(/\./g, '').replace(',', '.'));
  }

  if (compact.includes(',')) {
    return Number.parseFloat(compact.replace(',', '.'));
  }

  return Number.parseFloat(compact);
}

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const parsed = parseLocalizedAmount(match[1]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function extractMerchant(text: string): string {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const cleaned = sanitizeMerchantCandidate(match[1]);
    if (cleaned) return cleaned;
  }

  return 'Transazione carta';
}

function sanitizeMerchantCandidate(candidate: string): string | null {
  let normalized = candidate
    .replace(/^[\s:;,-]+/, '')
    .replace(/[\s:;,-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  normalized = normalized.replace(/^l['’]\s*/i, '');
  normalized = normalized.replace(/^(?:esercente|merchant)\s*:?\s*/i, '');

  const upper = normalized.toUpperCase();
  const words = upper.split(' ').filter(Boolean);
  if (words.length === 0) return null;

  const hasMeaningfulWord = words.some(word => !GENERIC_MERCHANT_WORDS.has(word));
  if (!hasMeaningfulWord) return null;

  return upper;
}

function extractDate(text: string, fallbackDate: Date): Date {
  const dateMatch = text.match(
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(?:alle(?:\s+ore)?|ore)?\s*(\d{1,2}):(\d{2}))?/i
  );

  if (!dateMatch) return fallbackDate;

  const day = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10);
  const yearPart = dateMatch[3];
  const year = yearPart
    ? (Number.parseInt(yearPart, 10) < 100
      ? 2000 + Number.parseInt(yearPart, 10)
      : Number.parseInt(yearPart, 10))
    : fallbackDate.getFullYear();
  const hours = Number.parseInt(dateMatch[4] ?? '0', 10);
  const minutes = Number.parseInt(dateMatch[5] ?? '0', 10);

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(parsed.getTime())) return fallbackDate;
  return parsed;
}

function isIncomeNotification(text: string): boolean {
  const lower = text.toLowerCase();
  return INCOME_KEYWORDS.some(keyword => lower.includes(keyword));
}

export function parseIsybankEmailText(text: string, fallbackDate: Date): ParsedIsybankEmailText | null {
  const normalizedText = normalizeText(text);
  const amount = extractAmount(normalizedText);

  if (amount === null) return null;

  const signedAmount = isIncomeNotification(normalizedText)
    ? Math.abs(amount)
    : -Math.abs(amount);

  return {
    amount: signedAmount,
    merchant: extractMerchant(normalizedText),
    date: extractDate(normalizedText, fallbackDate),
    currency: 'EUR',
    details: normalizedText
  };
}
