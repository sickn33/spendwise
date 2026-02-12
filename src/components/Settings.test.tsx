import { render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from './Settings';

expect.extend(matchers);

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

        // Check for technical version tag (sub-header)
        expect(screen.getByText('CONTROL_PANEL')).toBeInTheDocument();
        expect(screen.getByText('v1.0.0_STABLE')).toBeInTheDocument();

        // Check sections
        expect(screen.getByText('IMPORTAZIONE_DATI')).toBeInTheDocument();
        expect(screen.getByText('GMAIL_SYNCHRONIZER')).toBeInTheDocument();
        expect(screen.getByText('DATA_EXTRACTION')).toBeInTheDocument();
        expect(screen.getByText('SYSTEM_OVERRIDE')).toBeInTheDocument();
        
        // Check for specific labels that should use mono font
        expect(screen.getByText('CLIENT_ID_GMAIL')).toBeInTheDocument();
        expect(screen.getByText('BANCA_SENDER_EMAIL')).toBeInTheDocument();
        expect(screen.getByText('MAX_RECORDS')).toBeInTheDocument();
        
        // Check for specific functional labels
        expect(screen.getByText('STATUS: READY_FOR_INPUT')).toBeInTheDocument();
        expect(screen.getByText('AUTHORIZE_GMAIL')).toBeInTheDocument();
    });
});
