import { describe, expect, it, vi } from 'vitest';

const bulkAddTransactions = vi.fn();

vi.mock('read-excel-file/browser', () => ({
  readSheet: vi.fn().mockResolvedValue([
    ['Data', 'Operazione', 'Dettagli', 'Conto o carta', 'Contabilizzazione', 'Categoria', 'Valuta', 'Importo'],
    [
      new Date('2026-06-12T00:00:00.000Z'),
      'Acme Health Center City',
      'Card payment on 12/06/2026 at 10:05 at Acme Health Center City',
      'Account TEST',
      'SI',
      'Transport and parking',
      'EUR',
      -1.6
    ]
  ])
}));

vi.mock('../db/database', () => ({
  bulkAddTransactions,
  getCategories: vi.fn().mockResolvedValue([]),
  db: {
    transactions: {
      toArray: vi.fn().mockResolvedValue([
        {
          id: 1,
          date: new Date('2026-06-12T10:05:00.000Z'),
          amount: -1.6,
          description: 'ACME HEALTH CENTER',
          details: 'Gmail card notification',
          tags: ['gmail', 'bank-card', 'gmail-msg:abc']
        }
      ])
    }
  }
}));

vi.mock('./classifier', () => ({
  classifyTransaction: vi.fn().mockResolvedValue({ categoryId: 7, confidence: 1, method: 'keyword' })
}));

describe('importCardExcel duplicate safety', () => {
  it('skips an XLSX row that already exists from Gmail with equivalent date, amount and merchant', async () => {
    const { importCardExcel } = await import('./importer');

    const result = await importCardExcel(new File([], 'card.xlsx'));

    expect(result.errors).toEqual([]);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(bulkAddTransactions).not.toHaveBeenCalled();
  });
});
