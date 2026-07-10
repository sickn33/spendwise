import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/database';
import { BACKUP_VERSION, createBackupSnapshot, parseBackupText, restoreBackup, restoreBackupFromText } from './backup';
import type { BackupSnapshotV2 } from './backup';

const exportedAt = '2026-07-10T10:00:00.000Z';

function validSnapshot(): BackupSnapshotV2 {
  const createdAt = new Date(exportedAt);
  return {
    version: BACKUP_VERSION,
    exportedAt,
    categories: [{ id: 1, name: 'Food', icon: 'F', color: '#123456', keywords: [], isDefault: false, isIncome: false }],
    transactions: [{
      id: 1, date: new Date('2026-07-09T12:00:00.000Z'), description: 'Lunch', details: '', amount: -12,
      currency: 'EUR', categoryId: 1, isRecurring: false, tags: [], account: '', isContabilized: true,
      createdAt, updatedAt: createdAt,
    }],
    budgets: [{ id: 1, categoryId: 1, amount: 300, period: 'monthly', createdAt, updatedAt: createdAt }],
    quickAddPresets: [{ id: 1, name: 'Coffee', amount: 1.5, categoryId: 1, icon: 'C' }],
    savingsGoals: [{ id: 1, name: 'Trip', targetAmount: 1_000, currentAmount: 100, icon: 'T', color: '#abcdef', createdAt, updatedAt: createdAt }],
    settings: { id: 1, currency: 'EUR', theme: 'dark', categoryBudgets: { 1: 300 }, pinEnabled: false, createdAt, updatedAt: createdAt },
  };
}

describe('versioned backup and restore', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.delete();
    db.close();
  });

  it('round-trips every persisted domain table and revives dates', async () => {
    await restoreBackup(validSnapshot());
    const exported = await createBackupSnapshot();
    await db.transactions.clear();
    await db.categories.clear();

    const restored = await restoreBackupFromText(JSON.stringify(exported));

    expect(restored.version).toBe(BACKUP_VERSION);
    expect(restored.transactions[0].date).toBeInstanceOf(Date);
    expect(await db.transactions.count()).toBe(1);
    expect(await db.categories.count()).toBe(1);
    expect(await db.budgets.count()).toBe(1);
    expect(await db.quickAddPresets.count()).toBe(1);
    expect(await db.savingsGoals.count()).toBe(1);
    expect(await db.settings.count()).toBe(1);
  });

  it('migrates a 1.0 backup by supplying the later collections and settings', () => {
    const snapshot = validSnapshot();
    const legacy = {
      version: '1.0', exportedAt,
      categories: snapshot.categories,
      transactions: snapshot.transactions,
    };

    const migrated = parseBackupText(JSON.stringify(legacy));

    expect(migrated).toMatchObject({ version: BACKUP_VERSION, budgets: [], quickAddPresets: [], savingsGoals: [], settings: null });
  });

  it('rejects malformed, unsupported, oversized, and dangling-reference backups before writes', async () => {
    await restoreBackup(validSnapshot());
    const initialDescription = (await db.transactions.get(1))?.description;
    expect(() => parseBackupText('{broken')).toThrow('not valid JSON');
    expect(() => parseBackupText(JSON.stringify({ ...validSnapshot(), version: '99.0' }))).toThrow('Unsupported backup version');
    expect(() => parseBackupText(' '.repeat(10 * 1024 * 1024 + 1))).toThrow('10 MB safety limit');
    const dangling = validSnapshot();
    dangling.transactions[0].categoryId = 99;
    await expect(restoreBackupFromText(JSON.stringify(dangling))).rejects.toThrow('references missing category');
    expect((await db.transactions.get(1))?.description).toBe(initialDescription);
  });

  it('rejects invalid settings and broken or cyclic category relationships', () => {
    const missingParent = validSnapshot();
    missingParent.categories[0].parentId = 99;
    expect(() => parseBackupText(JSON.stringify(missingParent))).toThrow('references missing parent');

    const cyclic = validSnapshot();
    cyclic.categories.push({ id: 2, name: 'Child', icon: 'C', color: '#123456', parentId: 1, keywords: [], isDefault: false, isIncome: false });
    cyclic.categories[0].parentId = 2;
    expect(() => parseBackupText(JSON.stringify(cyclic))).toThrow('contains a cycle');

    const invalidSettings = validSnapshot();
    invalidSettings.settings!.monthlyBudget = 0;
    expect(() => parseBackupText(JSON.stringify(invalidSettings))).toThrow('monthlyBudget must be positive');
  });

  it('rolls back all cleared and inserted tables when a restore write fails', async () => {
    await restoreBackup(validSnapshot());
    const replacement = validSnapshot();
    replacement.transactions[0].description = 'Replacement';
    vi.spyOn(db.budgets, 'bulkAdd').mockRejectedValueOnce(new Error('simulated write failure'));

    await expect(restoreBackup(replacement)).rejects.toThrow('simulated write failure');

    expect((await db.transactions.get(1))?.description).toBe('Lunch');
    expect((await db.categories.get(1))?.name).toBe('Food');
    expect(await db.budgets.count()).toBe(1);
  });
});
