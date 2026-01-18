// Isybank Excel importer
import * as XLSX from 'xlsx';
import { db, getCategories, bulkAddTransactions } from '../db/database';
import { classifyTransaction } from './classifier';
import type { Transaction } from '../types';

interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
}

// Parse Isybank Excel file
export async function importIsybankExcel(file: File): Promise<ImportResult> {
    const result: ImportResult = {
        success: false,
        imported: 0,
        skipped: 0,
        errors: []
    };

    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON, skipping header rows
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

        // Find the header row (contains "Data", "Operazione", etc.)
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
            const row = rawData[i] as string[];
            if (row && row.some(cell => cell === 'Data' || cell === 'Operazione')) {
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
        const existingHashes = new Set(
            existingTransactions.map(t =>
                `${t.date.toISOString().split('T')[0]}-${t.amount}-${t.description.substring(0, 20)}`
            )
        );

        const transactionsToAdd: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];

        for (const row of dataRows) {
            if (!row || !row.length) continue;

            const dateVal = row[columnMap['Data']];
            const operazione = row[columnMap['Operazione']] as string;
            const dettagli = row[columnMap['Dettagli']] as string;
            const conto = row[columnMap['Conto o carta']] as string;
            const contabilizzazione = row[columnMap['Contabilizzazione']] as string;
            const categoria = row[columnMap['Categoria']] as string;
            const valuta = row[columnMap['Valuta']] as string;
            const importo = row[columnMap['Importo']] as number;

            // Skip rows without essential data
            if (!dateVal || !operazione || importo === undefined || importo === null) {
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

            // Check for duplicates
            const hash = `${date.toISOString().split('T')[0]}-${importo}-${String(operazione).substring(0, 20)}`;
            if (existingHashes.has(hash)) {
                result.skipped++;
                continue;
            }
            existingHashes.add(hash);

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

        if (transactionsToAdd.length > 0) {
            await bulkAddTransactions(transactionsToAdd);
            result.imported = transactionsToAdd.length;
        }

        result.success = true;
        return result;
    } catch (error) {
        result.errors.push(`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return result;
    }
}

// Export transactions to Excel
export function exportToExcel(transactions: Transaction[], filename: string = 'spendwise_export.xlsx'): void {
    const data = transactions.map(t => ({
        'Data': t.date.toLocaleDateString('it-IT'),
        'Descrizione': t.description,
        'Dettagli': t.details,
        'Importo': t.amount,
        'Valuta': t.currency,
        'Categoria': t.categoryId, // Will be resolved to name in the component
        'Conto': t.account
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    XLSX.writeFile(workbook, filename);
}

// Export transactions to CSV
export function exportToCSV(transactions: Transaction[], filename: string = 'spendwise_export.csv'): void {
    const data = transactions.map(t => ({
        'Data': t.date.toLocaleDateString('it-IT'),
        'Descrizione': t.description,
        'Dettagli': t.details,
        'Importo': t.amount,
        'Valuta': t.currency,
        'Conto': t.account
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}
