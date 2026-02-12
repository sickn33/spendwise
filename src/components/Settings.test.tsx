import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from './Settings';

// Mock dependencies
vi.mock('../services/importer', () => ({
    importIsybankExcel: vi.fn(),
    previewIsybankExcel: vi.fn(),
    exportToExcel: vi.fn(),
    exportToCSV: vi.fn()
}));

vi.mock('../services/gmailSync', () => ({
    loadGmailSyncSettings: vi.fn().mockReturnValue({
        senderEmail: 'bank@example.com',
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
    requestGmailAccessToken: vi.fn()
}));

vi.mock('../db/database', () => ({
    getTransactions: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    clearAllTransactions: vi.fn()
}));

describe('Settings Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders settings with control panel styling', async () => {
        render(<Settings />);
        
        await waitFor(() => {
            expect(screen.getByText('IMPOSTAZIONI_SISTEMA')).toBeInTheDocument();
        });

        // Check sections
        expect(screen.getByText('IMPORTAZIONE_DATI')).toBeInTheDocument();
        expect(screen.getByText('SINCRONIZZAZIONE_GMAIL')).toBeInTheDocument();
        expect(screen.getByText('ESPORTAZIONE_DATI')).toBeInTheDocument();
        expect(screen.getByText('ZONA_PERICOLOSA')).toBeInTheDocument();
        
        // Check structural elements
        expect(screen.getByText('IMPORTA_DA_ISYBANK_XLS')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /COLLEGA_GMAIL/i })).toBeInTheDocument();
    });
});
