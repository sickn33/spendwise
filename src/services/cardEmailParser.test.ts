import { describe, expect, it } from 'vitest';
import { parseCardEmailText } from './cardEmailParser';

describe('parseCardEmailText', () => {
  it('parses an expense email with amount, merchant and date', () => {
    const text = 'Hai effettuato una spesa di € 12,34 presso EXAMPLE MARKET il 10/02/2026 alle 14:21.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(-12.34);
    expect(parsed?.merchant).toBe('EXAMPLE MARKET');
    expect(parsed?.date.getFullYear()).toBe(2026);
    expect(parsed?.date.getMonth()).toBe(1);
    expect(parsed?.date.getDate()).toBe(10);
    expect(parsed?.date.getHours()).toBe(14);
    expect(parsed?.date.getMinutes()).toBe(21);
  });

  it('parses a refund as positive amount', () => {
    const text = 'Rimborso di EUR 5,00 da EXAMPLE PAY in data 11/02/2026 ore 09:10.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(5);
    expect(parsed?.merchant).toBe('EXAMPLE PAY');
  });

  it('uses fallback date when date is not in the email text', () => {
    const text = 'Pagamento carta di 42,90 EUR presso EXAMPLE SUPERMARKET.';
    const fallbackDate = new Date('2026-02-01T19:45:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.date.toISOString()).toBe(fallbackDate.toISOString());
  });

  it('uses the fallback for impossible calendar dates', () => {
    const fallback = new Date(2026, 1, 10, 12, 0);
    const parsed = parseCardEmailText('Pagamento di 12,50 EUR presso TEST il 31/02/2026', fallback);

    expect(parsed?.date).toEqual(fallback);
  });

  it('returns null when no amount is found', () => {
    const text = 'Notifica di sicurezza Card senza dettagli di spesa.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).toBeNull();
  });

  it('parses merchant when template uses a colon', () => {
    const text = 'Spesa carta di EUR 2,50. Esercente: Example Parking Terminal in data 07/02/2026.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.merchant).toBe('EXAMPLE PARKING TERMINAL');
  });

  it('extracts merchant from short subject-like payment format', () => {
    const text = 'Pagamento carta EXAMPLE PAY *EXAMPLE TRAVEL 00000000001 di EUR 7,28 il 03/02/2026.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.merchant).toBe('EXAMPLE PAY *EXAMPLE TRAVEL 00000000001');
  });

  it('parses real card template with no year in date', () => {
    const text = 'Ciao, hai pagato 7,28 EUR con la carta virtuale *0001 rif. carta *0002 il 03/02 alle ore 21:11 da EXAMPLE PAY *EXAMPLE TRAVEL, .';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(-7.28);
    expect(parsed?.merchant).toBe('EXAMPLE PAY *EXAMPLE TRAVEL');
    expect(parsed?.date.getFullYear()).toBe(2026);
    expect(parsed?.date.getMonth()).toBe(1);
    expect(parsed?.date.getDate()).toBe(3);
    expect(parsed?.date.getHours()).toBe(21);
    expect(parsed?.date.getMinutes()).toBe(11);
  });

  it('keeps dotted merchant names and parses dotted dates from real notification copy', () => {
    const text = 'Ciao, ti informiamo che in data 12.06 hai pagato 1,60 EUR con la carta XXXX presso ACME HEALTH CENTER .';
    const fallbackDate = new Date('2026-06-19T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(-1.6);
    expect(parsed?.merchant).toBe('ACME HEALTH CENTER');
    expect(parsed?.date.getFullYear()).toBe(2026);
    expect(parsed?.date.getMonth()).toBe(5);
    expect(parsed?.date.getDate()).toBe(12);
  });

  it('handles leap-year and year-boundary dates without rolling the calendar', () => {
    const leap = parseCardEmailText('Spesa di € 10,00 presso LEAP SHOP il 29/02/2024', new Date('2024-03-01T12:00:00Z'));
    const yearBoundary = parseCardEmailText('Spesa di € 5,00 presso NEW YEAR SHOP il 31/12', new Date('2026-01-01T12:00:00Z'));
    expect(leap?.date.getFullYear()).toBe(2024);
    expect(leap?.date.getMonth()).toBe(1);
    expect(yearBoundary?.date.getFullYear()).toBe(2025);
  });
});
