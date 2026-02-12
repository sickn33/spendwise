import { describe, expect, it } from 'vitest';
import {
  buildGmailSearchQuery,
  extractMessageBody,
  generateTransactionHash,
  buildDateAmountKey,
  isLikelyDuplicateByDateAmount,
  findLikelyDuplicateTransactionIds
} from './gmailSync';

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('gmailSync utilities', () => {
  it('builds query filtering by sender', () => {
    expect(buildGmailSearchQuery('comunicazioni@isybank.com')).toBe('from:comunicazioni@isybank.com');
  });

  it('extracts plain text body from nested payload', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/html',
          body: { data: toBase64Url('<p>HTML fallback</p>') }
        },
        {
          mimeType: 'text/plain',
          body: { data: toBase64Url('Hai effettuato una spesa di € 12,34 presso TEST SHOP') }
        }
      ]
    };

    expect(extractMessageBody(payload)).toContain('spesa di € 12,34');
  });

  it('creates stable hash regardless of case and spaces', () => {
    const date = new Date('2026-02-12T10:00:00.000Z');
    const hashA = generateTransactionHash(date, -12.34, ' Amazon ', '  Pagamento Carta ');
    const hashB = generateTransactionHash(date, -12.34, 'amazon', 'pagamento carta');

    expect(hashA).toBe(hashB);
  });

  it('treats generic merchant as duplicate when same day/amount already exists', () => {
    const date = new Date('2026-02-07T10:00:00.000Z');
    const key = buildDateAmountKey(date, -2.5);
    const existing = new Map([
      [key, [{ description: 'Careggi Firenze Parche Vial', details: 'Pagamento POS parcheggio' }]]
    ]);

    expect(isLikelyDuplicateByDateAmount(date, -2.5, 'Transazione carta', existing)).toBe(true);
  });

  it('does not mark as duplicate when merchant is specific and different', () => {
    const date = new Date('2026-02-07T10:00:00.000Z');
    const key = buildDateAmountKey(date, -2.5);
    const existing = new Map([
      [key, [{ description: 'CAFFE ROMA', details: 'Pagamento POS' }]]
    ]);

    expect(isLikelyDuplicateByDateAmount(date, -2.5, 'PIZZERIA NAPOLI', existing)).toBe(false);
  });

  it('marks as duplicate when same merchant exists on same day and amount', () => {
    const date = new Date('2026-02-03T10:00:00.000Z');
    const key = buildDateAmountKey(date, -7.28);
    const existing = new Map([
      [key, [{ description: 'PAYPAL *FLIXBUS 30300137300', details: 'Pagamento carta' }]]
    ]);

    expect(isLikelyDuplicateByDateAmount(date, -7.28, 'PAYPAL *FLIXBUS 30300137300', existing)).toBe(true);
  });

  it('finds duplicate ids by gmail message id', () => {
    const txs = [
      { id: 1, date: new Date('2026-02-01'), amount: -10, description: 'SHOP A', tags: ['gmail', 'gmail-msg:abc'] },
      { id: 2, date: new Date('2026-02-01'), amount: -10, description: 'SHOP A', tags: ['gmail', 'gmail-msg:abc'] },
      { id: 3, date: new Date('2026-02-01'), amount: -10, description: 'SHOP A', tags: ['gmail', 'gmail-msg:def'] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([2]);
  });

  it('finds generic gmail duplicates when specific transaction exists on same day/amount', () => {
    const txs = [
      { id: 10, date: new Date('2026-02-07'), amount: -2.5, description: 'Transazione carta', tags: ['gmail'] },
      { id: 11, date: new Date('2026-02-07'), amount: -2.5, description: 'CAREGGI FIRENZE PARCHE VIAL', tags: [] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([10]);
  });

  it('finds generic duplicates even without gmail tag when specific counterpart exists', () => {
    const txs = [
      { id: 30, date: new Date('2026-02-07'), amount: -2.5, description: 'Transazione carta', tags: [] },
      { id: 31, date: new Date('2026-02-07'), amount: -2.5, description: 'CAREGGI FIRENZE PARCHE VIAL', tags: [] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([30]);
  });

  it('finds generic duplicates when specific counterpart is within one day (timezone drift)', () => {
    const txs = [
      { id: 40, date: new Date('2026-02-07T00:05:00.000Z'), amount: -7.28, description: 'Transazione carta', tags: ['gmail'] },
      { id: 41, date: new Date('2026-02-06T23:40:00.000Z'), amount: -7.28, description: 'PAYPAL *FLIXBUS 30300137300', tags: [] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([40]);
  });

  it('does not remove generic transactions when no specific counterpart exists', () => {
    const txs = [
      { id: 21, date: new Date('2026-02-07'), amount: -2.5, description: 'Transazione carta', tags: ['gmail'] },
      { id: 22, date: new Date('2026-02-07'), amount: -2.5, description: 'Transazione carta', tags: ['gmail'] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([]);
  });
});
