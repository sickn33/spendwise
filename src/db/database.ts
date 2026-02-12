import Dexie, { type EntityTable } from 'dexie';
import type { Transaction, Category, UserSettings, Budget, QuickAddPreset, SavingsGoal, FileHandleRecord } from '../types';

// Default categories based on Isybank data
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
    { name: 'Generi alimentari e supermercato', icon: '🛒', color: '#4CAF50', keywords: ['eurospin', 'coop', 'lidl', 'carrefour', 'conad', 'esselunga', 'pam', 'supermercato', 'alimentari', 'penny'], isDefault: true, isIncome: false },
    { name: 'Ristoranti e bar', icon: '🍕', color: '#FF5722', keywords: ['pizzeria', 'gelateria', 'bar', 'ristorante', 'trattoria', 'osteria', 'pub', 'mcdonalds', 'burger'], isDefault: true, isIncome: false },
    { name: 'Trasporti, noleggi, taxi e parcheggi', icon: '🚕', color: '#2196F3', keywords: ['taxi', 'uber', 'noleggio', 'parcheggio', 'rent', 'autonoleggio'], isDefault: true, isIncome: false },
    { name: 'Treno, aereo, nave', icon: '✈️', color: '#673AB7', keywords: ['trenitalia', 'italo', 'ryanair', 'easyjet', 'alitalia', 'aereo', 'treno', 'nave', 'traghetto'], isDefault: true, isIncome: false },
    { name: 'Carburanti', icon: '⛽', color: '#795548', keywords: ['eni', 'q8', 'ip', 'tamoil', 'benzina', 'diesel', 'carburante', 'distributore'], isDefault: true, isIncome: false },
    { name: 'Pedaggi e Telepass', icon: '🛣️', color: '#607D8B', keywords: ['telepass', 'pedaggio', 'autostrada'], isDefault: true, isIncome: false },
    { name: 'Trasporti varie', icon: '🚌', color: '#00BCD4', keywords: ['atac', 'metro', 'bus', 'tram', 'cotral'], isDefault: true, isIncome: false },
    { name: 'Pagamento affitti', icon: '🏠', color: '#E91E63', keywords: ['affitto', 'canone', 'locazione'], isDefault: true, isIncome: false },
    { name: 'Riscaldamento', icon: '🔥', color: '#FF9800', keywords: ['riscaldamento', 'gas', 'caldaia'], isDefault: true, isIncome: false },
    { name: 'Domiciliazioni e Utenze', icon: '💡', color: '#FFEB3B', keywords: ['enel', 'eni', 'acea', 'luce', 'acqua', 'utenze', 'bolletta'], isDefault: true, isIncome: false },
    { name: 'Casa varie', icon: '🏡', color: '#9C27B0', keywords: ['ikea', 'leroy', 'brico', 'casa', 'arredamento'], isDefault: true, isIncome: false },
    { name: 'Farmacia', icon: '💊', color: '#F44336', keywords: ['farmacia', 'parafarmacia', 'medicina'], isDefault: true, isIncome: false },
    { name: 'Cura della persona', icon: '💅', color: '#E91E63', keywords: ['parrucchiere', 'barbiere', 'estetista', 'beauty', 'salone'], isDefault: true, isIncome: false },
    { name: 'Abbigliamento e accessori', icon: '👕', color: '#9C27B0', keywords: ['zara', 'h&m', 'nike', 'adidas', 'abbigliamento', 'scarpe', 'vestiti'], isDefault: true, isIncome: false },
    { name: 'Tempo libero varie', icon: '🎮', color: '#3F51B5', keywords: ['hobby', 'giochi', 'svago'], isDefault: true, isIncome: false },
    { name: 'Spettacoli e musei', icon: '🎭', color: '#673AB7', keywords: ['cinema', 'teatro', 'museo', 'concerto', 'biglietto'], isDefault: true, isIncome: false },
    { name: 'Corsi e sport', icon: '🏋️', color: '#009688', keywords: ['palestra', 'corso', 'sport', 'fitness', 'yoga'], isDefault: true, isIncome: false },
    { name: 'Libri, film e musica', icon: '📚', color: '#795548', keywords: ['feltrinelli', 'mondadori', 'libro', 'amazon', 'spotify', 'netflix'], isDefault: true, isIncome: false },
    { name: 'Hi-tech e informatica', icon: '💻', color: '#607D8B', keywords: ['apple', 'mediaworld', 'unieuro', 'tech', 'elettronica', 'computer'], isDefault: true, isIncome: false },
    { name: 'Cellulare', icon: '📱', color: '#00BCD4', keywords: ['tim', 'vodafone', 'wind', 'iliad', 'telefono', 'cellulare', 'ricarica'], isDefault: true, isIncome: false },
    { name: 'Regali', icon: '🎁', color: '#E91E63', keywords: ['regalo', 'gift'], isDefault: true, isIncome: false },
    { name: 'Donazioni', icon: '❤️', color: '#F44336', keywords: ['donazione', 'charity', 'beneficenza'], isDefault: true, isIncome: false },
    { name: 'Associazioni', icon: '🤝', color: '#9E9E9E', keywords: ['associazione', 'iscrizione', 'tessera'], isDefault: true, isIncome: false },
    { name: 'Tabaccai e simili', icon: '🚬', color: '#795548', keywords: ['tabacchi', 'tabaccaio', 'edicola'], isDefault: true, isIncome: false },
    { name: 'Investimenti, BDR e Salvadanaio', icon: '📈', color: '#4CAF50', keywords: ['investimento', 'salvadanaio', 'bdr', 'arrotondamento', 'eurizon'], isDefault: true, isIncome: false },
    { name: 'Bonifici in uscita', icon: '💸', color: '#FF5722', keywords: ['bonifico', 'trasferimento'], isDefault: true, isIncome: false },
    { name: 'Bonifici ricevuti', icon: '💰', color: '#4CAF50', keywords: ['bonifico', 'stipendio', 'accredito'], isDefault: true, isIncome: true },
    { name: 'Rimborsi spese e storni', icon: '↩️', color: '#8BC34A', keywords: ['rimborso', 'storno', 'reso'], isDefault: true, isIncome: true },
    { name: 'Disinvestimenti, BDR e Salvadanaio', icon: '📉', color: '#FF9800', keywords: ['disinvestimento', 'prelievo', 'salvadanaio'], isDefault: true, isIncome: true },
    { name: 'Addebiti vari', icon: '📋', color: '#9E9E9E', keywords: ['addebito', 'commissione', 'canone'], isDefault: true, isIncome: false },
    { name: 'Altre uscite', icon: '📦', color: '#757575', keywords: [], isDefault: true, isIncome: false },
];

class SpendWiseDB extends Dexie {
    transactions!: EntityTable<Transaction, 'id'>;
    categories!: EntityTable<Category, 'id'>;
    settings!: EntityTable<UserSettings, 'id'>;
    budgets!: EntityTable<Budget, 'id'>;
    quickAddPresets!: EntityTable<QuickAddPreset, 'id'>;
    savingsGoals!: EntityTable<SavingsGoal, 'id'>;
    fileHandles!: EntityTable<FileHandleRecord, 'id'>;

    constructor() {
        super('SpendWiseDB');

        this.version(1).stores({
            transactions: '++id, date, categoryId, amount, description, [date+categoryId]',
            categories: '++id, name, parentId, isDefault',
            settings: '++id'
        });

        this.version(2).stores({
            transactions: '++id, date, categoryId, amount, description, [date+categoryId]',
            categories: '++id, name, parentId, isDefault',
            settings: '++id',
            budgets: '++id, categoryId',
            quickAddPresets: '++id, categoryId'
        });

        this.version(3).stores({
            transactions: '++id, date, categoryId, amount, description, [date+categoryId]',
            categories: '++id, name, parentId, isDefault',
            settings: '++id',
            budgets: '++id, categoryId',
            quickAddPresets: '++id, categoryId',
            savingsGoals: '++id, name'
        });

        this.version(4).stores({
            transactions: '++id, date, categoryId, amount, description, [date+categoryId]',
            categories: '++id, name, parentId, isDefault',
            settings: '++id',
            budgets: '++id, categoryId',
            quickAddPresets: '++id, categoryId',
            savingsGoals: '++id, name',
            fileHandles: '++id, name'
        });
    }
}

export const db = new SpendWiseDB();

// Initialize database with default categories if empty
export async function initializeDatabase(): Promise<void> {
    const categoryCount = await db.categories.count();

    if (categoryCount === 0) {
        console.log('Initializing database with default categories...');
        await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[]);
    }

    const settingsCount = await db.settings.count();

    if (settingsCount === 0) {
        console.log('Initializing default settings...');
        await db.settings.add({
            currency: 'EUR',
            theme: 'dark',
            categoryBudgets: {},
            pinEnabled: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
}

// Transaction operations
export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const id = await db.transactions.add({
        ...transaction,
        createdAt: new Date(),
        updatedAt: new Date()
    } as Transaction);
    return id as number;
}

export async function updateTransaction(id: number, updates: Partial<Transaction>): Promise<void> {
    await db.transactions.update(id, {
        ...updates,
        updatedAt: new Date()
    });
}

export async function deleteTransaction(id: number): Promise<void> {
    await db.transactions.delete(id);
}

export async function getTransactions(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    categoryId?: number;
    limit?: number;
}): Promise<Transaction[]> {
    let collection = db.transactions.orderBy('date').reverse();

    if (filters?.dateFrom || filters?.dateTo) {
        collection = db.transactions.where('date').between(
            filters.dateFrom || new Date(0),
            filters.dateTo || new Date(),
            true,
            true
        ).reverse();
    }

    let results = await collection.toArray();

    if (filters?.categoryId) {
        results = results.filter(t => t.categoryId === filters.categoryId);
    }

    if (filters?.limit) {
        results = results.slice(0, filters.limit);
    }

    return results;
}

// Category operations
export async function getCategories(): Promise<Category[]> {
    return db.categories.toArray();
}

export async function getCategoryById(id: number): Promise<Category | undefined> {
    return db.categories.get(id);
}

export async function addCategory(category: Omit<Category, 'id'>): Promise<number> {
    const id = await db.categories.add(category as Category);
    return id as number;
}

export async function updateCategory(id: number, updates: Partial<Category>): Promise<void> {
    await db.categories.update(id, updates);
}

export async function deleteCategory(id: number): Promise<void> {
    // Don't delete if it's a default category
    const category = await db.categories.get(id);
    if (category?.isDefault) {
        throw new Error('Cannot delete default categories');
    }
    await db.categories.delete(id);
}

// Settings operations
export async function getSettings(): Promise<UserSettings | undefined> {
    return db.settings.toCollection().first();
}

export async function updateSettings(updates: Partial<UserSettings>): Promise<void> {
    const settings = await getSettings();
    if (settings?.id) {
        await db.settings.update(settings.id, {
            ...updates,
            updatedAt: new Date()
        });
    }
}

// Bulk operations
export async function bulkAddTransactions(transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const now = new Date();
    const preparedTransactions = transactions.map(t => ({
        ...t,
        createdAt: now,
        updatedAt: now
    })) as Transaction[];

    await db.transactions.bulkAdd(preparedTransactions);
}

export async function clearAllTransactions(): Promise<void> {
    await db.transactions.clear();
}

export async function getTransactionCount(): Promise<number> {
    return db.transactions.count();
}

// Budget operations
export async function getBudgets(): Promise<Budget[]> {
    return db.budgets.toArray();
}

export async function addBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const id = await db.budgets.add({
        ...budget,
        createdAt: new Date(),
        updatedAt: new Date()
    } as Budget);
    return id as number;
}

export async function updateBudget(id: number, updates: Partial<Budget>): Promise<void> {
    await db.budgets.update(id, {
        ...updates,
        updatedAt: new Date()
    });
}

export async function deleteBudget(id: number): Promise<void> {
    await db.budgets.delete(id);
}

export async function getBudgetByCategory(categoryId: number): Promise<Budget | undefined> {
    return db.budgets.where('categoryId').equals(categoryId).first();
}

// Quick Add Preset operations
export async function getQuickAddPresets(): Promise<QuickAddPreset[]> {
    return db.quickAddPresets.toArray();
}

export async function addQuickAddPreset(preset: Omit<QuickAddPreset, 'id'>): Promise<number> {
    const id = await db.quickAddPresets.add(preset as QuickAddPreset);
    return id as number;
}

export async function updateQuickAddPreset(id: number, updates: Partial<QuickAddPreset>): Promise<void> {
    await db.quickAddPresets.update(id, updates);
}

export async function deleteQuickAddPreset(id: number): Promise<void> {
    await db.quickAddPresets.delete(id);
}

// Default quick add presets
export const DEFAULT_QUICK_ADD_PRESETS: Omit<QuickAddPreset, 'id'>[] = [
    { name: 'Caffè', amount: 1.50, categoryId: 2, icon: '☕' },
    { name: 'Pranzo', amount: 10, categoryId: 2, icon: '🍝' },
    { name: 'Metro', amount: 1.50, categoryId: 7, icon: '🚇' },
    { name: 'Spesa', amount: 30, categoryId: 1, icon: '🛒' },
];

export async function initializeQuickAddPresets(): Promise<void> {
    const count = await db.quickAddPresets.count();
    if (count === 0) {
        // Get category IDs for presets
        const categories = await getCategories();
        const ristorantiCat = categories.find(c => c.name === 'Ristoranti e bar');
        const trasportiCat = categories.find(c => c.name === 'Trasporti varie');
        const alimentariCat = categories.find(c => c.name === 'Generi alimentari e supermercato');

        const presets = [
            { name: 'Caffè', amount: 1.50, categoryId: ristorantiCat?.id || 2, icon: '☕' },
            { name: 'Pranzo', amount: 10, categoryId: ristorantiCat?.id || 2, icon: '🍝' },
            { name: 'Metro', amount: 1.50, categoryId: trasportiCat?.id || 7, icon: '🚇' },
            { name: 'Spesa', amount: 30, categoryId: alimentariCat?.id || 1, icon: '🛒' },
        ];

        await db.quickAddPresets.bulkAdd(presets as QuickAddPreset[]);
    }
}

// Savings Goals operations
export async function getSavingsGoals(): Promise<SavingsGoal[]> {
    return db.savingsGoals.toArray();
}

export async function addSavingsGoal(goal: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const id = await db.savingsGoals.add({
        ...goal,
        createdAt: new Date(),
        updatedAt: new Date()
    } as SavingsGoal);
    return id as number;
}

export async function updateSavingsGoal(id: number, updates: Partial<SavingsGoal>): Promise<void> {
    await db.savingsGoals.update(id, {
        ...updates,
        updatedAt: new Date()
    });
}

export async function deleteSavingsGoal(id: number): Promise<void> {
    await db.savingsGoals.delete(id);
}

export async function addToSavingsGoal(id: number, amount: number): Promise<void> {
    const goal = await db.savingsGoals.get(id);
    if (goal) {
        await db.savingsGoals.update(id, {
            currentAmount: goal.currentAmount + amount,
            updatedAt: new Date()
        });
    }
}

export async function withdrawFromSavingsGoal(id: number, amount: number): Promise<void> {
    const goal = await db.savingsGoals.get(id);
    if (goal) {
        await db.savingsGoals.update(id, {
            currentAmount: Math.max(0, goal.currentAmount - amount),
            updatedAt: new Date()
        });
    }
}

// File Handle operations
export async function saveFileHandle(handle: FileSystemFileHandle): Promise<void> {
    // Clear existing handles first, we only support one backup file for now
    await db.fileHandles.clear();
    await db.fileHandles.add({
        handle,
        name: handle.name,
        kind: 'file',
        updatedAt: new Date()
    });
}

export async function getFileHandle(): Promise<FileSystemFileHandle | undefined> {
    const record = await db.fileHandles.toCollection().first();
    return record?.handle;
}

export async function deleteFileHandle(): Promise<void> {
    await db.fileHandles.clear();
}


