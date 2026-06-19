import { describe, expect, it } from 'vitest';
import { parseCardEmailText } from './cardEmailParser';

describe('parseCardEmailText', () => {
  it('parses an expense email with amount, merchant and date', () => {
    const text = 'Hai effettuato una spesa di € 12,34 presso AMAZON MARKETPLACE il 10/02/2026 alle 14:21.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(-12.34);
    expect(parsed?.merchant).toBe('AMAZON MARKETPLACE');
    expect(parsed?.date.getFullYear()).toBe(2026);
    expect(parsed?.date.getMonth()).toBe(1);
    expect(parsed?.date.getDate()).toBe(10);
    expect(parsed?.date.getHours()).toBe(14);
    expect(parsed?.date.getMinutes()).toBe(21);
  });

  it('parses a refund as positive amount', () => {
    const text = 'Rimborso di EUR 5,00 da PAYPAL in data 11/02/2026 ore 09:10.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(5);
    expect(parsed?.merchant).toBe('PAYPAL');
  });

  it('uses fallback date when date is not in the email text', () => {
    const text = 'Pagamento carta di 42,90 EUR presso SUPERMERCATO COOP.';
    const fallbackDate = new Date('2026-02-01T19:45:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.date.toISOString()).toBe(fallbackDate.toISOString());
  });

  it('returns null when no amount is found', () => {
    const text = 'Notifica di sicurezza Card senza dettagli di spesa.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).toBeNull();
  });

  it('parses merchant when template uses a colon', () => {
    const text = 'Spesa carta di EUR 2,50. Esercente: City Parking Terminal in data 07/02/2026.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.merchant).toBe('CITY PARKING TERMINAL');
  });

  it('extracts merchant from short subject-like payment format', () => {
    const text = 'Pagamento carta PAYPAL *FLIXBUS 30300137300 di EUR 7,28 il 03/02/2026.';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.merchant).toBe('PAYPAL *FLIXBUS 30300137300');
  });

  it('parses real card template with no year in date', () => {
    const text = 'Ciao, hai pagato 7,28 EUR con la carta virtuale *9283 rif. carta *1741 il 03/02 alle ore 21:11 da PAYPAL *FLIXBUS, .';
    const fallbackDate = new Date('2026-02-12T09:00:00.000Z');

    const parsed = parseCardEmailText(text, fallbackDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(-7.28);
    expect(parsed?.merchant).toBe('PAYPAL *FLIXBUS');
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
});
