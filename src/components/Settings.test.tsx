import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from './Settings';

// Mock dependencies
vi.mock('../services/importer', () => ({
    importCardExcel: vi.fn(),
    previewCardExcel: vi.fn(),
    exportToExcel: vi.fn(),
    exportToCSV: vi.fn()
}));

vi.mock('../services/gmailSync', () => ({
    loadGmailSyncSettings: vi.fn().mockReturnValue({
        senderEmail: 'bank@example.com',
        searchQuery: '',
        maxResults: 25,
        pollingMinutes: 10,
        autoSync: false,
        googleClientId: ''
    }),
    loadGmailToken: vi.fn().mockReturnValue(null),
    saveGmailSyncSettings: vi.fn(),
    saveGmailToken: vi.fn(),
    clearGmailToken: vi.fn(),
    isGmailTokenValid: vi.fn(),
    requestGmailAccessToken: vi.fn(),
    syncCardTransactionsFromGmail: vi.fn(),
    cleanupLikelyGmailDuplicates: vi.fn()
}));

vi.mock('../db/database', () => ({
    getTransactions: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getBudgets: vi.fn().mockResolvedValue([]),
    getQuickAddPresets: vi.fn().mockResolvedValue([]),
    getSavingsGoals: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue(undefined),
    clearAllTransactions: vi.fn(),
    getFileHandle: vi.fn().mockResolvedValue(null),
    saveFileHandle: vi.fn().mockResolvedValue(undefined),
    deleteFileHandle: vi.fn().mockResolvedValue(undefined),
}));

describe('Settings Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders settings with control panel styling', async () => {
        render(<Settings />);
        
        await waitFor(() => {
            expect(screen.getByText('SYSTEM SETTINGS')).toBeInTheDocument();
        });

        // Check for technical version tag (sub-header)
        expect(screen.getByText('CONTROL PANEL')).toBeInTheDocument();
        expect(screen.getByText('v1.0.0_STABLE')).toBeInTheDocument();

        // Check sections
        expect(screen.getByText('DATA IMPORT')).toBeInTheDocument();
        expect(screen.getByText('GMAIL SYNCHRONIZER')).toBeInTheDocument();
        expect(screen.getByText('DATA EXPORT')).toBeInTheDocument();
        expect(screen.getByText('SYSTEM RESET')).toBeInTheDocument();
        
        // Check for specific labels that should use mono font
        expect(screen.getByText('GOOGLE CLIENT ID')).toBeInTheDocument();
        expect(screen.getByText('BANK SENDER EMAIL')).toBeInTheDocument();
        expect(screen.getByText('PERSONAL MAIL QUERY')).toBeInTheDocument();
        expect(screen.getByText('MAX RECORDS')).toBeInTheDocument();
        
        // Check for specific functional labels
        expect(screen.getByText('STATUS: READY_FOR_INPUT')).toBeInTheDocument();
        expect(screen.getByText('AUTHORIZE_GMAIL')).toBeInTheDocument();
    });

    it('executes import, export, Gmail, backup, and clear-data controls', async () => {
        const importer = await import('../services/importer');
        const gmail = await import('../services/gmailSync');
        const database = await import('../db/database');
        vi.mocked(importer.previewCardExcel).mockResolvedValue({ success: true, items: [], newCount: 0, duplicateCount: 0, modifiedCount: 0, errors: [] });
        vi.mocked(gmail.requestGmailAccessToken).mockResolvedValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 });
        vi.mocked(gmail.isGmailTokenValid).mockReturnValue(true);
        vi.mocked(gmail.cleanupLikelyGmailDuplicates).mockResolvedValue({ scanned: 2, removed: 1, removedIds: [1] });
        const connectBackup = vi.fn();
        const disconnectBackup = vi.fn();
        const requestPermission = vi.fn();
        const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
        const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

        const { container } = render(<Settings backupController={{
            fileHandle: null,
            permissionStatus: 'prompt',
            loading: false,
            error: null,
            connectBackup,
            disconnectBackup,
            requestPermission,
            saveToBackup: vi.fn(),
        } as never} />);
        await screen.findByText('SYSTEM SETTINGS');

        fireEvent.change(screen.getByLabelText('GOOGLE CLIENT ID'), { target: { value: 'client-id' } });
        fireEvent.change(screen.getByLabelText('BANK SENDER EMAIL'), { target: { value: 'sender@example.com' } });
        fireEvent.click(screen.getByText('AUTHORIZE_GMAIL'));
        await waitFor(() => expect(gmail.requestGmailAccessToken).toHaveBeenCalled());

        fireEvent.click(screen.getByText('REMOVE DUPLICATE RECORDS'));
        fireEvent.click(screen.getByRole('button', { name: 'Remove duplicates' }));
        await waitFor(() => expect(gmail.cleanupLikelyGmailDuplicates).toHaveBeenCalled());

        fireEvent.click(screen.getByText('EXPORT XLSX'));
        await waitFor(() => expect(importer.exportToExcel).toHaveBeenCalled());
        fireEvent.click(screen.getByText('EXPORT CSV'));
        await waitFor(() => expect(importer.exportToCSV).toHaveBeenCalled());
        fireEvent.click(screen.getByText('SYSTEM BACKUP JSON'));
        await waitFor(() => expect(createObjectUrl).toHaveBeenCalled());

        fireEvent.click(screen.getByText('SET UP BACKUP FILE'));
        expect(connectBackup).toHaveBeenCalled();

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['sheet'], 'transactions.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        fireEvent.change(fileInput, { target: { files: [file] } });
        await waitFor(() => expect(importer.previewCardExcel).toHaveBeenCalledWith(file));

        fireEvent.click(screen.getByText('CLEAR ALL TRANSACTIONS'));
        fireEvent.click(screen.getByText('CONFIRM DESTRUCTION'));
        await waitFor(() => expect(database.clearAllTransactions).toHaveBeenCalled());

        createObjectUrl.mockRestore();
        revokeObjectUrl.mockRestore();
        confirm.mockRestore();
    });

    it('notifies the app after an update-only import so automatic backup can run', async () => {
        const importer = await import('../services/importer');
        const onTransactionsImported = vi.fn();
        const item = {
            date: new Date(2026, 5, 12),
            description: 'Merchant',
            details: 'Card detail',
            amount: -20,
            currency: 'EUR',
            account: 'Account',
            categoryId: 7,
            status: 'modified' as const,
            existingId: 1,
        };
        vi.mocked(importer.previewCardExcel).mockResolvedValue({
            success: true,
            items: [item],
            newCount: 0,
            duplicateCount: 0,
            modifiedCount: 1,
            errors: [],
        });
        vi.mocked(importer.importCardExcel).mockResolvedValue({
            success: true,
            imported: 0,
            skipped: 0,
            updated: 1,
            errors: [],
        });

        const { container } = render(<Settings onTransactionsImported={onTransactionsImported} />);
        await screen.findByText('SYSTEM SETTINGS');
        const file = new File(['sheet'], 'transactions.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });

        fireEvent.click(await screen.findByRole('checkbox', { name: /update modified transactions/i }));
        fireEvent.click(screen.getByRole('button', { name: /update 1 existing/i }));

        await waitFor(() => expect(importer.importCardExcel).toHaveBeenCalledWith(file, true));
        expect(onTransactionsImported).toHaveBeenCalledTimes(1);
    });

    it('notifies the app after update-only or removal-only Gmail sync mutations', async () => {
        const gmail = await import('../services/gmailSync');
        const onTransactionsImported = vi.fn();
        vi.mocked(gmail.loadGmailToken).mockReturnValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 });
        vi.mocked(gmail.isGmailTokenValid).mockReturnValue(true);
        vi.mocked(gmail.syncCardTransactionsFromGmail).mockResolvedValue({
            success: true,
            scanned: 2,
            imported: 0,
            updated: 1,
            removed: 1,
            skipped: 0,
            errors: [],
        });

        render(<Settings onTransactionsImported={onTransactionsImported} />);
        fireEvent.click(await screen.findByRole('button', { name: /run manual sync/i }));

        await waitFor(() => expect(gmail.syncCardTransactionsFromGmail).toHaveBeenCalled());
        expect(onTransactionsImported).toHaveBeenCalledTimes(1);
    });
});
