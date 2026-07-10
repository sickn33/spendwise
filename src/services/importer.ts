// Card Excel importer
import { readSheet } from 'read-excel-file/browser';
import writeXlsxFile, { type SheetData as XlsxSheetData } from 'write-excel-file/browser';
import { db, getCategories, bulkAddTransactions, updateTransaction } from '../db/database';
import { classifyTransaction } from './classifier';
import { hasLikelyExistingDuplicate } from './gmailSync';
import type { Transaction } from '../types';
import { format } from 'date-fns';

interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    updated: number;
    errors: string[];
}

// Preview result for showing user what will be imported
export interface ImportPreviewItem {
    date: Date;
    description: string;
    details: string;
    amount: number;
    currency: string;
    account: string;
    categoryId: number;
    status: 'new' | 'duplicate' | 'modified';
    existingId?: number; // ID of existing transaction if duplicate/modified
}

export interface ImportPreviewResult {
    success: boolean;
    items: ImportPreviewItem[];
    newCount: number;
    duplicateCount: number;
    modifiedCount: number;
    errors: string[];
}

// Generate a robust hash for duplicate detection
function generateTransactionHash(date: Date, amount: number, description: string, details: string): string {
    const dateStr = format(date, 'yyyy-MM-dd');
    const normalizedDesc = description.toLowerCase().trim();
    const normalizedDetails = (details || '').toLowerCase().trim();
    return `${dateStr}|${amount}|${normalizedDesc}|${normalizedDetails}`;
}

function generateTransactionPartialHash(date: Date, description: string, details: string): string {
    return `${format(date, 'yyyy-MM-dd')}|${description.toLowerCase().trim()}|${(details || '').toLowerCase().trim()}`;
}

type ExcelCellPrimitive = string | number | boolean | Date | null;

function normalizeReadCell(value: unknown): ExcelCellPrimitive {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value instanceof Date
    ) {
        return value;
    }

    return null;
}

async function readFirstWorksheetRows(file: File): Promise<ExcelCellPrimitive[][]> {
    const rows = await readSheet(file);
    return rows.map(row => row.map(normalizeReadCell));
}

function parseExcelAmount(value: ExcelCellPrimitive): number | null {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;

    const normalized = value
        .replace(/[€\s]/g, '')
        .replace(/\.(?=\d{3}(?:\D|$))/g, '')
        .replace(',', '.');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
}

function readColumn(
    row: ExcelCellPrimitive[],
    columnMap: Record<string, number>,
    names: string[]
): ExcelCellPrimitive {
    for (const name of names) {
        const index = columnMap[name];
        if (index !== undefined) return row[index];
    }

    return null;
}

function downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// Parse Card Excel file
export async function importCardExcel(file: File, updateExisting: boolean = false): Promise<ImportResult> {
    const result: ImportResult = {
        success: false,
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: []
    };

    try {
        const rawData = await readFirstWorksheetRows(file);

        // Find the header row (contains "Date", "Operazione", etc.)
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
            const row = rawData[i] as string[];
            if (row && row.some(cell => cell === 'Date' || cell === 'Operazione')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            result.errors.push('Could not find header row in Excel file');
            return result;
        }

        const headers = rawData[headerRowIndex] as string[];
        const dataRows = rawData.slice(headerRowIndex + 1);

        // Map column indices
        const columnMap: Record<string, number> = {};
        headers.forEach((header, index) => {
            if (header) {
                columnMap[header.trim()] = index;
            }
        });

        // Get categories for mapping (used by classifyTransaction)
        await getCategories();

        // Get existing transactions to check for duplicates
        const existingTransactions = await db.transactions.toArray();
        const existingForImportDedup = existingTransactions.map(transaction => ({
            date: transaction.date,
            amount: transaction.amount,
            description: transaction.description,
            details: transaction.details
        }));
        const existingHashMap = new Map<string, number>();
        const existingPartialHashMap = new Map<string, Array<{ id: number; amount: number }>>();
        for (const t of existingTransactions) {
            const hash = generateTransactionHash(t.date, t.amount, t.description, t.details);
            existingHashMap.set(hash, t.id!);
            const partialHash = generateTransactionPartialHash(t.date, t.description, t.details);
            const matches = existingPartialHashMap.get(partialHash) ?? [];
            matches.push({ id: t.id!, amount: t.amount });
            existingPartialHashMap.set(partialHash, matches);
        }

        const transactionsToAdd: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];
        const transactionsToUpdate: Array<{ id: number; updates: Partial<Transaction> }> = [];
        const stagedUpdateKeys = new Set<string>();
        let hasAmbiguousMatches = false;

        for (const row of dataRows) {
            if (!row || !row.length) continue;

            const dateVal = readColumn(row, columnMap, ['Date', 'Data']);
            const operazione = readColumn(row, columnMap, ['Operazione']) as string;
            const dettagli = readColumn(row, columnMap, ['Details', 'Dettagli']) as string;
            const conto = readColumn(row, columnMap, ['Conto o carta']) as string;
            const contabilizzazione = readColumn(row, columnMap, ['Contabilizzazione']) as string;
            const categoria = readColumn(row, columnMap, ['Category', 'Categoria']) as string;
            const valuta = readColumn(row, columnMap, ['Valuta']) as string;
            const importo = parseExcelAmount(readColumn(row, columnMap, ['Amount', 'Importo']));

            // Skip rows without essential data
            if (!dateVal || !operazione || importo === null) {
                continue;
            }

            // Parse date
            let date: Date;
            if (dateVal instanceof Date) {
                date = dateVal;
            } else if (typeof dateVal === 'string') {
                date = new Date(dateVal);
            } else if (typeof dateVal === 'number') {
                // Excel serial date
                date = new Date((dateVal - 25569) * 86400 * 1000);
            } else {
                result.errors.push(`Invalid date format for transaction: ${operazione}`);
                continue;
            }

            if (isNaN(date.getTime())) {
                result.errors.push(`Could not parse date for transaction: ${operazione}`);
                continue;
            }

            // Check for duplicates using improved hash
            const hash = generateTransactionHash(date, importo, operazione || '', dettagli || '');
            if (existingHashMap.has(hash)) {
                result.skipped++;
                continue;
            }

            const partialHash = generateTransactionPartialHash(date, operazione || '', dettagli || '');
            const partialMatches = existingPartialHashMap.get(partialHash) ?? [];
            if (partialMatches.length > 1 || stagedUpdateKeys.has(partialHash)) {
                result.errors.push(`Ambiguous modified transaction match: ${operazione} on ${format(date, 'yyyy-MM-dd')}`);
                hasAmbiguousMatches = true;
                result.skipped++;
                continue;
            }
            const modifiedExisting = partialMatches[0];
            if (modifiedExisting) {
                if (!updateExisting) {
                    result.skipped++;
                    continue;
                }

                const classification = await classifyTransaction(
                    operazione || '',
                    dettagli || '',
                    importo,
                    categoria
                );
                transactionsToUpdate.push({
                    id: modifiedExisting.id,
                    updates: {
                        date,
                        description: operazione || '',
                        details: dettagli || '',
                        amount: importo,
                        currency: valuta || 'EUR',
                        categoryId: classification.categoryId,
                        account: conto || '',
                        isContabilized: contabilizzazione === 'SI'
                    }
                });
                stagedUpdateKeys.add(partialHash);
                existingHashMap.set(hash, modifiedExisting.id);
                continue;
            }

            if (hasLikelyExistingDuplicate(date, importo, operazione || '', existingForImportDedup)) {
                result.skipped++;
                continue;
            }
            existingHashMap.set(hash, -1); // Mark as pending
            existingForImportDedup.push({
                date,
                amount: importo,
                description: operazione || '',
                details: dettagli || ''
            });

            // Classify transaction
            const classification = await classifyTransaction(
                operazione || '',
                dettagli || '',
                importo,
                categoria
            );

            transactionsToAdd.push({
                date,
                description: operazione || '',
                details: dettagli || '',
                amount: importo,
                currency: valuta || 'EUR',
                categoryId: classification.categoryId,
                account: conto || '',
                isContabilized: contabilizzazione === 'SI',
                isRecurring: false,
                tags: []
            });
        }

        if (hasAmbiguousMatches) {
            return result;
        }

        if (transactionsToAdd.length > 0 || transactionsToUpdate.length > 0) {
            await db.transaction('rw', db.transactions, async () => {
                for (const transaction of transactionsToUpdate) {
                    await updateTransaction(transaction.id, transaction.updates);
                }
                if (transactionsToAdd.length > 0) {
                    await bulkAddTransactions(transactionsToAdd);
                }
            });
        }

        result.imported = transactionsToAdd.length;
        result.updated = transactionsToUpdate.length;
        result.success = true;
        return result;
    } catch (error) {
        result.errors.push(`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return result;
    }
}

// Preview import without actually importing - returns what would be imported
export async function previewCardExcel(file: File): Promise<ImportPreviewResult> {
    const result: ImportPreviewResult = {
        success: false,
        items: [],
        newCount: 0,
        duplicateCount: 0,
        modifiedCount: 0,
        errors: []
    };

    try {
        const rawData = await readFirstWorksheetRows(file);

        // Find header row
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
            const row = rawData[i] as string[];
            if (row && row.some(cell => cell === 'Date' || cell === 'Operazione')) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            result.errors.push('Could not find header row in Excel file');
            return result;
        }

        const headers = rawData[headerRowIndex] as string[];
        const dataRows = rawData.slice(headerRowIndex + 1);

        const columnMap: Record<string, number> = {};
        headers.forEach((header, index) => {
            if (header) columnMap[header.trim()] = index;
        });

        await getCategories();

        // Build hash map of existing transactions
        const existingTransactions = await db.transactions.toArray();
        const existingForImportDedup = existingTransactions.map(transaction => ({
            date: transaction.date,
            amount: transaction.amount,
            description: transaction.description,
            details: transaction.details
        }));
        const existingHashMap = new Map<string, Array<{ id: number; amount: number }>>();
        for (const t of existingTransactions) {
            // Use date + description + details (without amount) for detecting modifications
            const partialHash = generateTransactionPartialHash(t.date, t.description, t.details);
            const matches = existingHashMap.get(partialHash) ?? [];
            matches.push({ id: t.id!, amount: t.amount });
            existingHashMap.set(partialHash, matches);
        }

        let hasAmbiguousMatches = false;

        for (const row of dataRows) {
            if (!row || !row.length) continue;

            const dateVal = readColumn(row, columnMap, ['Date', 'Data']);
            const operazione = readColumn(row, columnMap, ['Operazione']) as string;
            const dettagli = readColumn(row, columnMap, ['Details', 'Dettagli']) as string;
            const conto = readColumn(row, columnMap, ['Conto o carta']) as string;
            const categoria = readColumn(row, columnMap, ['Category', 'Categoria']) as string;
            const valuta = readColumn(row, columnMap, ['Valuta']) as string;
            const importo = parseExcelAmount(readColumn(row, columnMap, ['Amount', 'Importo']));

            if (!dateVal || !operazione || importo === null) {
                continue;
            }

            let date: Date;
            if (dateVal instanceof Date) {
                date = dateVal;
            } else if (typeof dateVal === 'string') {
                date = new Date(dateVal);
            } else if (typeof dateVal === 'number') {
                date = new Date((dateVal - 25569) * 86400 * 1000);
            } else {
                result.errors.push(`Invalid date format for: ${operazione}`);
                continue;
            }

            if (isNaN(date.getTime())) {
                result.errors.push(`Could not parse date for: ${operazione}`);
                continue;
            }

            const classification = await classifyTransaction(operazione || '', dettagli || '', importo, categoria);

            const partialHash = generateTransactionPartialHash(date, operazione || '', dettagli || '');
            const existingMatches = existingHashMap.get(partialHash) ?? [];
            if (existingMatches.length > 1) {
                result.errors.push(`Ambiguous modified transaction match: ${operazione} on ${format(date, 'yyyy-MM-dd')}`);
                result.duplicateCount++;
                hasAmbiguousMatches = true;
                result.items.push({
                    date,
                    description: operazione || '',
                    details: dettagli || '',
                    amount: importo,
                    currency: valuta || 'EUR',
                    account: conto || '',
                    categoryId: classification.categoryId,
                    status: 'duplicate'
                });
                continue;
            }
            const existing = existingMatches[0];

            let status: 'new' | 'duplicate' | 'modified' = 'new';
            let existingId: number | undefined = undefined;

            if (existing) {
                if (existing.amount === importo) {
                    status = 'duplicate';
                    result.duplicateCount++;
                } else {
                    status = 'modified';
                    result.modifiedCount++;
                    existingId = existing.id;
                }
            } else if (hasLikelyExistingDuplicate(date, importo, operazione || '', existingForImportDedup)) {
                status = 'duplicate';
                result.duplicateCount++;
            } else {
                result.newCount++;
            }

            result.items.push({
                date,
                description: operazione || '',
                details: dettagli || '',
                amount: importo,
                currency: valuta || 'EUR',
                account: conto || '',
                categoryId: classification.categoryId,
                status,
                existingId
            });
        }

        result.success = !hasAmbiguousMatches;
        return result;
    } catch (error) {
        result.errors.push(`Preview error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return result;
    }
}

// Export transactions to Excel
export async function exportToExcel(transactions: Transaction[], filename: string = 'spendwise_export.xlsx'): Promise<void> {
    const data = transactions.map(t => ({
        'Date': t.date.toLocaleDateString('en-US'),
        'Description': t.description,
        'Details': t.details,
        'Amount': t.amount,
        'Currency': t.currency,
        'Category': t.categoryId, // Will be resolved to name in the component
        'Account': t.account
    }));

    const rows: XlsxSheetData = [
        ['Date', 'Description', 'Details', 'Amount', 'Currency', 'Category', 'Account'],
        ...data.map(row => [
            row.Date,
            row.Description,
            row.Details,
            row.Amount,
            row.Currency,
            row.Category,
            row.Account
        ])
    ];

    const file = writeXlsxFile(rows, { sheet: 'Transactions' });
    downloadBlob(await file.toBlob(), filename);
}

// Export transactions to CSV
export function exportToCSV(transactions: Transaction[], filename: string = 'spendwise_export.csv'): void {
    const data = transactions.map(t => ({
        'Date': t.date.toLocaleDateString('en-US'),
        'Description': t.description,
        'Details': t.details,
        'Amount': t.amount,
        'Currency': t.currency,
        'Account': t.account
    }));

    const headers = ['Date', 'Description', 'Details', 'Amount', 'Currency', 'Account'];
    const csv = [
        headers,
        ...data.map(row => headers.map(header => row[header as keyof typeof row]))
    ]
        .map(row => row.map(value => {
            const text = String(value ?? '');
            return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(','))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
}
