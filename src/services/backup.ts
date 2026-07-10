import { db, getBudgets, getCategories, getQuickAddPresets, getSavingsGoals, getSettings, getTransactions } from '../db/database';
import type { Budget, Category, QuickAddPreset, SavingsGoal, Transaction, UserSettings } from '../types';

export const BACKUP_VERSION = '2.0' as const;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_RECORDS_PER_TABLE = 100_000;

export interface BackupSnapshotV2 {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  quickAddPresets: QuickAddPreset[];
  savingsGoals: SavingsGoal[];
  settings: UserSettings | null;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (value.length > MAX_RECORDS_PER_TABLE) throw new Error(`${label} exceeds ${MAX_RECORDS_PER_TABLE} records`);
  return value;
}

function text(value: unknown, label: string, maxLength = 4_000): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${label} must be a string of at most ${maxLength} characters`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

function positiveId(value: unknown, label: string): number {
  const id = finite(value, label);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} must be a positive integer`);
  return id;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function date(value: unknown, label: string): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(text(value, label, 100));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date`);
  return parsed;
}

function optionalId(value: unknown, label: string): number | undefined {
  return value === undefined || value === null ? undefined : positiveId(value, label);
}

function uniqueIds(records: Array<{ id?: number }>, label: string): void {
  const ids = new Set<number>();
  for (const record of records) {
    if (!record.id) continue;
    if (ids.has(record.id)) throw new Error(`${label} contains duplicate id ${record.id}`);
    ids.add(record.id);
  }
}

function parseCategory(value: unknown, index: number): Category {
  const item = object(value, `categories[${index}]`);
  return {
    id: positiveId(item.id, `categories[${index}].id`),
    name: text(item.name, `categories[${index}].name`, 200),
    icon: text(item.icon, `categories[${index}].icon`, 20),
    color: text(item.color, `categories[${index}].color`, 100),
    parentId: optionalId(item.parentId, `categories[${index}].parentId`),
    keywords: array(item.keywords ?? [], `categories[${index}].keywords`).map((keyword, keywordIndex) =>
      text(keyword, `categories[${index}].keywords[${keywordIndex}]`, 200)
    ),
    isDefault: boolean(item.isDefault ?? false, `categories[${index}].isDefault`),
    isIncome: boolean(item.isIncome ?? false, `categories[${index}].isIncome`),
  };
}

function parseTransaction(value: unknown, index: number, fallbackDate: string): Transaction {
  const item = object(value, `transactions[${index}]`);
  const amount = finite(item.amount, `transactions[${index}].amount`);
  if (amount === 0) throw new Error(`transactions[${index}].amount must be non-zero`);
  return {
    id: positiveId(item.id, `transactions[${index}].id`),
    date: date(item.date, `transactions[${index}].date`),
    description: text(item.description, `transactions[${index}].description`, 500),
    details: text(item.details ?? '', `transactions[${index}].details`, 4_000),
    amount,
    currency: text(item.currency ?? 'EUR', `transactions[${index}].currency`, 10),
    categoryId: positiveId(item.categoryId, `transactions[${index}].categoryId`),
    subcategoryId: optionalId(item.subcategoryId, `transactions[${index}].subcategoryId`),
    isRecurring: boolean(item.isRecurring ?? false, `transactions[${index}].isRecurring`),
    tags: array(item.tags ?? [], `transactions[${index}].tags`).map((tag, tagIndex) =>
      text(tag, `transactions[${index}].tags[${tagIndex}]`, 200)
    ),
    account: text(item.account ?? '', `transactions[${index}].account`, 500),
    isContabilized: boolean(item.isContabilized ?? false, `transactions[${index}].isContabilized`),
    createdAt: date(item.createdAt ?? fallbackDate, `transactions[${index}].createdAt`),
    updatedAt: date(item.updatedAt ?? fallbackDate, `transactions[${index}].updatedAt`),
  };
}

function parseBudget(value: unknown, index: number, fallbackDate: string): Budget {
  const item = object(value, `budgets[${index}]`);
  const amount = finite(item.amount, `budgets[${index}].amount`);
  if (amount <= 0) throw new Error(`budgets[${index}].amount must be positive`);
  const period = text(item.period, `budgets[${index}].period`, 20);
  if (period !== 'monthly' && period !== 'weekly') throw new Error(`budgets[${index}].period is unsupported`);
  return {
    id: positiveId(item.id, `budgets[${index}].id`),
    categoryId: positiveId(item.categoryId, `budgets[${index}].categoryId`),
    amount,
    period,
    createdAt: date(item.createdAt ?? fallbackDate, `budgets[${index}].createdAt`),
    updatedAt: date(item.updatedAt ?? fallbackDate, `budgets[${index}].updatedAt`),
  };
}

function parsePreset(value: unknown, index: number): QuickAddPreset {
  const item = object(value, `quickAddPresets[${index}]`);
  const amount = finite(item.amount, `quickAddPresets[${index}].amount`);
  if (amount <= 0) throw new Error(`quickAddPresets[${index}].amount must be positive`);
  return {
    id: positiveId(item.id, `quickAddPresets[${index}].id`),
    name: text(item.name, `quickAddPresets[${index}].name`, 200),
    amount,
    categoryId: positiveId(item.categoryId, `quickAddPresets[${index}].categoryId`),
    icon: text(item.icon, `quickAddPresets[${index}].icon`, 20),
  };
}

function parseGoal(value: unknown, index: number, fallbackDate: string): SavingsGoal {
  const item = object(value, `savingsGoals[${index}]`);
  const targetAmount = finite(item.targetAmount, `savingsGoals[${index}].targetAmount`);
  const currentAmount = finite(item.currentAmount, `savingsGoals[${index}].currentAmount`);
  if (targetAmount <= 0 || currentAmount < 0) throw new Error(`savingsGoals[${index}] contains invalid amounts`);
  return {
    id: positiveId(item.id, `savingsGoals[${index}].id`),
    name: text(item.name, `savingsGoals[${index}].name`, 200),
    targetAmount,
    currentAmount,
    icon: text(item.icon, `savingsGoals[${index}].icon`, 20),
    color: text(item.color, `savingsGoals[${index}].color`, 100),
    deadline: item.deadline === undefined || item.deadline === null ? undefined : date(item.deadline, `savingsGoals[${index}].deadline`),
    createdAt: date(item.createdAt ?? fallbackDate, `savingsGoals[${index}].createdAt`),
    updatedAt: date(item.updatedAt ?? fallbackDate, `savingsGoals[${index}].updatedAt`),
  };
}

function parseSettings(value: unknown, fallbackDate: string): UserSettings | null {
  if (value === undefined || value === null) return null;
  const item = object(value, 'settings');
  const theme = text(item.theme ?? 'dark', 'settings.theme', 20);
  if (theme !== 'dark' && theme !== 'light' && theme !== 'auto') throw new Error('settings.theme is unsupported');
  const rawBudgets = object(item.categoryBudgets ?? {}, 'settings.categoryBudgets');
  const categoryBudgets: Record<number, number> = {};
  for (const [categoryId, amountValue] of Object.entries(rawBudgets)) {
    const id = positiveId(Number(categoryId), `settings.categoryBudgets.${categoryId}`);
    const amount = finite(amountValue, `settings.categoryBudgets.${categoryId}`);
    if (amount <= 0) throw new Error(`settings.categoryBudgets.${categoryId} must be positive`);
    categoryBudgets[id] = amount;
  }
  const monthlyBudget = item.monthlyBudget === undefined ? undefined : finite(item.monthlyBudget, 'settings.monthlyBudget');
  if (monthlyBudget !== undefined && monthlyBudget <= 0) throw new Error('settings.monthlyBudget must be positive');
  return {
    id: item.id === undefined ? undefined : positiveId(item.id, 'settings.id'),
    currency: text(item.currency ?? 'EUR', 'settings.currency', 10),
    theme,
    monthlyBudget,
    categoryBudgets,
    pinEnabled: boolean(item.pinEnabled ?? false, 'settings.pinEnabled'),
    pinHash: item.pinHash === undefined ? undefined : text(item.pinHash, 'settings.pinHash', 500),
    createdAt: date(item.createdAt ?? fallbackDate, 'settings.createdAt'),
    updatedAt: date(item.updatedAt ?? fallbackDate, 'settings.updatedAt'),
  };
}

export async function createBackupSnapshot(): Promise<BackupSnapshotV2> {
  const [transactions, categories, budgets, quickAddPresets, savingsGoals, settings] = await Promise.all([
    getTransactions(), getCategories(), getBudgets(), getQuickAddPresets(), getSavingsGoals(), getSettings(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    transactions,
    categories,
    budgets,
    quickAddPresets,
    savingsGoals,
    settings: settings ?? null,
  };
}

export function parseBackupText(rawText: string): BackupSnapshotV2 {
  if (new Blob([rawText]).size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 10 MB safety limit');
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new Error('Backup is not valid JSON');
  }
  const root = object(raw, 'backup');
  const version = text(root.version, 'backup.version', 20);
  if (version !== '1.0' && version !== BACKUP_VERSION) throw new Error(`Unsupported backup version: ${version}`);
  const exportedAt = date(root.exportedAt, 'backup.exportedAt').toISOString();
  const categories = array(root.categories, 'categories').map(parseCategory);
  if (categories.length === 0) throw new Error('Backup must contain at least one category');
  const transactions = array(root.transactions, 'transactions').map((item, index) => parseTransaction(item, index, exportedAt));
  const budgets = array(root.budgets ?? [], 'budgets').map((item, index) => parseBudget(item, index, exportedAt));
  const quickAddPresets = array(root.quickAddPresets ?? [], 'quickAddPresets').map(parsePreset);
  const savingsGoals = array(root.savingsGoals ?? [], 'savingsGoals').map((item, index) => parseGoal(item, index, exportedAt));
  const settings = parseSettings(root.settings, exportedAt);

  uniqueIds(categories, 'categories');
  uniqueIds(transactions, 'transactions');
  uniqueIds(budgets, 'budgets');
  uniqueIds(quickAddPresets, 'quickAddPresets');
  uniqueIds(savingsGoals, 'savingsGoals');
  const categoryIds = new Set(categories.map(category => category.id!));
  for (const category of categories) {
    if (category.parentId === category.id) throw new Error(`Category ${category.id} cannot be its own parent`);
    if (category.parentId && !categoryIds.has(category.parentId)) throw new Error(`Category ${category.id} references missing parent ${category.parentId}`);
    const visited = new Set<number>([category.id!]);
    let parentId = category.parentId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error(`Category hierarchy contains a cycle at ${parentId}`);
      visited.add(parentId);
      parentId = categories.find(candidate => candidate.id === parentId)?.parentId;
    }
  }
  for (const transaction of transactions) {
    if (!categoryIds.has(transaction.categoryId)) throw new Error(`Transaction ${transaction.id} references missing category ${transaction.categoryId}`);
    if (transaction.subcategoryId && !categoryIds.has(transaction.subcategoryId)) throw new Error(`Transaction ${transaction.id} references missing subcategory ${transaction.subcategoryId}`);
  }
  for (const budget of budgets) if (!categoryIds.has(budget.categoryId)) throw new Error(`Budget ${budget.id} references missing category ${budget.categoryId}`);
  for (const preset of quickAddPresets) if (!categoryIds.has(preset.categoryId)) throw new Error(`Quick-add preset ${preset.id} references missing category ${preset.categoryId}`);
  if (settings) {
    for (const categoryId of Object.keys(settings.categoryBudgets).map(Number)) {
      if (!categoryIds.has(categoryId)) throw new Error(`Settings budget references missing category ${categoryId}`);
    }
  }

  return { version: BACKUP_VERSION, exportedAt, transactions, categories, budgets, quickAddPresets, savingsGoals, settings };
}

export async function restoreBackup(snapshot: BackupSnapshotV2): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.categories, db.budgets, db.quickAddPresets, db.savingsGoals, db.settings],
    async () => {
      await Promise.all([
        db.transactions.clear(), db.categories.clear(), db.budgets.clear(),
        db.quickAddPresets.clear(), db.savingsGoals.clear(), db.settings.clear(),
      ]);
      await db.categories.bulkAdd(snapshot.categories);
      if (snapshot.transactions.length) await db.transactions.bulkAdd(snapshot.transactions);
      if (snapshot.budgets.length) await db.budgets.bulkAdd(snapshot.budgets);
      if (snapshot.quickAddPresets.length) await db.quickAddPresets.bulkAdd(snapshot.quickAddPresets);
      if (snapshot.savingsGoals.length) await db.savingsGoals.bulkAdd(snapshot.savingsGoals);
      if (snapshot.settings) await db.settings.add(snapshot.settings);
      else await db.settings.add({
        currency: 'EUR', theme: 'dark', categoryBudgets: {}, pinEnabled: false,
        createdAt: new Date(snapshot.exportedAt), updatedAt: new Date(snapshot.exportedAt),
      });
    }
  );
}

export async function restoreBackupFromText(rawText: string): Promise<BackupSnapshotV2> {
  const snapshot = parseBackupText(rawText);
  await restoreBackup(snapshot);
  return snapshot;
}
