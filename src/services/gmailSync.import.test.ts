import { describe, expect, it, vi } from 'vitest';

const bulkAddTransactions = vi.fn();

vi.mock('../db/database', () => ({
  bulkAddTransactions,
  db: {
    transactions: {
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      update: vi.fn(),
      bulkDelete: vi.fn()
    }
  }
}));

vi.mock('./classifier', () => ({
  classifyTransaction: vi.fn().mockResolvedValue({ categoryId: 99, confidence: 1, method: 'keyword' })
}));

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('syncCardTransactionsFromGmail import', () => {
  it('imports a parseable personal-mail Gmail message as a tagged transaction', async () => {
    const { syncCardTransactionsFromGmail } = await import('./gmailSync');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-1' }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg-1',
          internalDate: String(new Date('2026-02-12T09:00:00.000Z').getTime()),
          payload: {
            headers: [{ name: 'Subject', value: 'Card payment' }],
            mimeType: 'text/plain',
            body: {
              data: toBase64Url('Hai effettuato una spesa di EUR 12,34 presso AMAZON MARKETPLACE il 10/02/2026 alle 14:21.')
            }
          }
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await syncCardTransactionsFromGmail({
      accessToken: 'token-abc',
      senderEmail: 'alerts@example.com',
      searchQuery: 'subject:card-payment newer_than:90d',
      maxResults: 1
    });

    expect(result.imported).toBe(1);
    expect(bulkAddTransactions).toHaveBeenCalledWith([
      expect.objectContaining({
        amount: -12.34,
        description: 'AMAZON MARKETPLACE',
        categoryId: 99,
        tags: ['gmail', 'bank-card', 'gmail-msg:msg-1']
      })
    ]);

    vi.unstubAllGlobals();
  });
});
