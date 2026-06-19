import { describe, expect, it, vi } from 'vitest';
import {
  buildGmailSearchQuery,
  resolveGmailSearchQuery,
  syncCardTransactionsFromGmail,
  extractMessageBody,
  extractMessageBodyFromMessage,
  generateTransactionHash,
  buildDateAmountKey,
  isLikelyDuplicateByDateAmount,
  findLikelyDuplicateTransactionIds,
  hasLikelyExistingDuplicate
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
    expect(buildGmailSearchQuery('alerts@example.com')).toBe('from:alerts@example.com');
  });

  it('uses a custom personal-mail query when configured', () => {
    expect(resolveGmailSearchQuery({
      senderEmail: 'alerts@example.com',
      searchQuery: 'subject:card-payment newer_than:90d'
    })).toBe('subject:card-payment newer_than:90d');
  });

  it('passes custom personal-mail query to Gmail list API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [] })
    });

    vi.stubGlobal('fetch', fetchMock);

    await syncCardTransactionsFromGmail({
      accessToken: 'token-abc',
      senderEmail: 'alerts@example.com',
      searchQuery: 'subject:card-payment newer_than:90d',
      maxResults: 7
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('q')).toBe('subject:card-payment newer_than:90d');
    expect(url.searchParams.get('maxResults')).toBe('7');

    vi.unstubAllGlobals();
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

  it('loads text body from attachmentId when inline data is missing', async () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/plain',
          body: { attachmentId: 'att-1' }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: toBase64Url('Esercente: City Parking Terminal') })
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await extractMessageBodyFromMessage('token-abc', 'msg-123', payload);

    expect(result).toContain('Esercente: City Parking Terminal');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/messages/msg-123/attachments/att-1?');

    vi.unstubAllGlobals();
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
      [key, [{ description: 'City Parking Terminal', details: 'Parking POS payment' }]]
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
      { id: 11, date: new Date('2026-02-07'), amount: -2.5, description: 'CITY PARKING TERMINAL', tags: [] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([10]);
  });

  it('finds generic duplicates even without gmail tag when specific counterpart exists', () => {
    const txs = [
      { id: 30, date: new Date('2026-02-07'), amount: -2.5, description: 'Transazione carta', tags: [] },
      { id: 31, date: new Date('2026-02-07'), amount: -2.5, description: 'CITY PARKING TERMINAL', tags: [] }
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

  it('removes shorter gmail merchant when csv has richer but equivalent merchant name', () => {
    const txs = [
      { id: 50, date: new Date('2026-02-07'), amount: -2.5, description: 'CITY PARKING', tags: ['gmail', 'gmail-msg:msg-50'] },
      { id: 51, date: new Date('2026-02-07'), amount: -2.5, description: 'City Parking Terminal', tags: [] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([50]);
  });

  it('removes gmail merchant with missing reference suffix when csv has same base merchant', () => {
    const txs = [
      { id: 60, date: new Date('2026-02-03'), amount: -7.28, description: 'PAYPAL *FLIXBUS', tags: ['gmail', 'gmail-msg:msg-60'] },
      { id: 61, date: new Date('2026-02-03'), amount: -7.28, description: 'Paypal *flixbus 30300137300', tags: [] }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([60]);
  });

  it('removes real Card mail duplicate when XLSX has richer merchant details', () => {
    const txs = [
      {
        id: 70,
        date: new Date('2026-06-12T10:05:00.000Z'),
        amount: -1.6,
        description: 'ACME HEALTH CENTER',
        tags: ['gmail', 'gmail-msg:msg-70']
      },
      {
        id: 71,
        date: new Date('2026-06-12T00:00:00.000Z'),
        amount: -1.6,
        description: 'Acme Health Center City',
        details: 'Card payment on 12/06/2026 at 10:05 at Acme Health Center City',
        tags: []
      }
    ];

    expect(findLikelyDuplicateTransactionIds(txs)).toEqual([70]);
  });

  it('sync dedupe skips generic merchant if same amount exists within one day', () => {
    const shouldSkip = hasLikelyExistingDuplicate(
      new Date('2026-02-07T22:30:00.000Z'),
      -2.5,
      'Transazione carta',
      [
        {
          date: new Date('2026-02-07T09:00:00.000Z'),
          amount: -2.5,
          description: 'City Parking Terminal',
          details: 'CSV'
        }
      ]
    );

    expect(shouldSkip).toBe(true);
  });

  it('sync dedupe skips specific merchant when equivalent merchant already exists', () => {
    const shouldSkip = hasLikelyExistingDuplicate(
      new Date('2026-02-03T21:11:00.000Z'),
      -7.28,
      'PAYPAL *FLIXBUS',
      [
        {
          date: new Date('2026-02-03T08:00:00.000Z'),
          amount: -7.28,
          description: 'Paypal *flixbus 30300137300',
          details: 'CSV'
        }
      ]
    );

    expect(shouldSkip).toBe(true);
  });

  it('sync dedupe matches real Card mail merchant against XLSX merchant', () => {
    const shouldSkip = hasLikelyExistingDuplicate(
      new Date('2026-06-12T10:05:00.000Z'),
      -1.6,
      'ACME HEALTH CENTER',
      [
        {
          date: new Date('2026-06-12T00:00:00.000Z'),
          amount: -1.6,
          description: 'Acme Health Center City',
          details: 'Card payment on 12/06/2026 at 10:05 at Acme Health Center City'
        }
      ]
    );

    expect(shouldSkip).toBe(true);
  });
});
