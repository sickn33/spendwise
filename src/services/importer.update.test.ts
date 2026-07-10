import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSheet = vi.hoisted(() => vi.fn());
const toArray = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn(async (_mode, _table, callback: () => Promise<void>) => callback()));
const updateTransaction = vi.hoisted(() => vi.fn());
const bulkAddTransactions = vi.hoisted(() => vi.fn());
const hasLikelyExistingDuplicate = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock('read-excel-file/browser', () => ({ readSheet }));
vi.mock('../db/database', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  updateTransaction,
  bulkAddTransactions,
  db: { transactions: { toArray }, transaction },
}));
vi.mock('./classifier', () => ({
  classifyTransaction: vi.fn().mockResolvedValue({ categoryId: 7, confidence: 1, method: 'keyword' }),
}));
vi.mock('./gmailSync', () => ({ hasLikelyExistingDuplicate }));

import { importCardExcel, previewCardExcel } from './importer';

const header = ['Data', 'Operazione', 'Dettagli', 'Conto o carta', 'Contabilizzazione', 'Categoria', 'Valuta', 'Importo'];
const sourceDate = new Date(2026, 5, 12);
const sourceRow = [sourceDate, 'Merchant', 'Card detail', 'Account', 'SI', 'Food', 'EUR', -20];
const existing = {
  id: 1,
  date: sourceDate,
  amount: -10,
  description: 'Merchant',
  details: 'Card detail',
  currency: 'EUR',
  categoryId: 7,
  account: 'Account',
  isContabilized: true,
  isRecurring: false,
  tags: [],
};

describe('importCardExcel modified-row safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSheet.mockResolvedValue([header, sourceRow]);
    toArray.mockResolvedValue([existing]);
    hasLikelyExistingDuplicate.mockReturnValue(false);
  });

  it('stages an unambiguous update and commits it inside one database transaction', async () => {
    const result = await importCardExcel(new File([], 'card.xlsx'), true);

    expect(result).toMatchObject({ success: true, imported: 0, updated: 1 });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateTransaction).toHaveBeenCalledWith(1, expect.objectContaining({ amount: -20, description: 'Merchant' }));
    expect(bulkAddTransactions).not.toHaveBeenCalled();
  });

  it('refuses ambiguous existing matches before mutating the ledger', async () => {
    toArray.mockResolvedValue([existing, { ...existing, id: 2, amount: -15 }]);

    const preview = await previewCardExcel(new File([], 'card.xlsx'));
    const result = await importCardExcel(new File([], 'card.xlsx'), true);

    expect(preview.success).toBe(false);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([expect.stringContaining('Ambiguous modified transaction match')]);
    expect(transaction).not.toHaveBeenCalled();
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(bulkAddTransactions).not.toHaveBeenCalled();
  });

  it('skips exact duplicates and modified rows when updates are disabled', async () => {
    readSheet.mockResolvedValue([
      header,
      [sourceDate, 'Merchant', 'Card detail', 'Account', 'SI', 'Food', 'EUR', -10],
      sourceRow,
    ]);

    const result = await importCardExcel(new File([], 'card.xlsx'), false);

    expect(result).toMatchObject({ success: true, imported: 0, updated: 0, skipped: 2 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('commits staged updates and new rows together', async () => {
    readSheet.mockResolvedValue([
      header,
      sourceRow,
      ['2026-06-13', 'New merchant', '', 'Account', 'NO', 'Food', '', '-5,50'],
    ]);

    const result = await importCardExcel(new File([], 'card.xlsx'), true);

    expect(result).toMatchObject({ success: true, imported: 1, updated: 1 });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateTransaction).toHaveBeenCalledTimes(1);
    expect(bulkAddTransactions).toHaveBeenCalledWith([
      expect.objectContaining({ description: 'New merchant', amount: -5.5, currency: 'EUR', isContabilized: false }),
    ]);
  });

  it('handles missing headers, invalid rows, serial dates, and likely duplicates', async () => {
    readSheet.mockResolvedValueOnce([['not', 'a', 'statement']]);
    expect(await importCardExcel(new File([], 'bad.xlsx'))).toMatchObject({ success: false, imported: 0 });

    toArray.mockResolvedValue([]);
    hasLikelyExistingDuplicate.mockReturnValueOnce(true).mockReturnValue(false);
    readSheet.mockResolvedValue([
      header,
      [null, 'Missing date', '', '', 'SI', '', 'EUR', -1],
      ['not-a-date', 'Bad date', '', '', 'SI', '', 'EUR', -2],
      [sourceDate, 'Likely duplicate', '', '', 'SI', '', 'EUR', -3],
      [45000, 'Serial date', '', '', 'SI', '', 'EUR', -4],
    ]);

    const result = await importCardExcel(new File([], 'mixed.xlsx'));

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([expect.stringContaining('Could not parse date')]);
    expect(bulkAddTransactions).toHaveBeenCalledWith([
      expect.objectContaining({ description: 'Serial date', amount: -4 }),
    ]);
  });
});
