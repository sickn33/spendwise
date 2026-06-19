import { render, screen, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from './Settings';

expect.extend(matchers);

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
    requestGmailAccessToken: vi.fn()
}));

vi.mock('../db/database', () => ({
    getTransactions: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
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
});
