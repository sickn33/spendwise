import { describe, expect, it } from 'vitest';
import {
  buildGmailSearchQuery,
  extractMessageBody,
  generateTransactionHash
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
});
