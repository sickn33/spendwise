import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { initializeDatabase } from './db/database';

// Mock child components
vi.mock('./components/Dashboard', () => ({
    Dashboard: () => <div data-testid="dashboard-page">DASHBOARD_CONTENT</div>
}));

vi.mock('./components/TransactionList', () => ({
    TransactionList: () => <div data-testid="ledger-page">LEDGER_CONTENT</div>
}));

vi.mock('./components/Reports', () => ({
    Reports: () => <div data-testid="reports-page">REPORTS_CONTENT</div>
}));

vi.mock('./components/CategoryManager', () => ({
    CategoryManager: () => <div data-testid="categories-page">CATEGORIES_CONTENT</div>
}));

vi.mock('./components/Settings', () => ({
    Settings: () => <div data-testid="settings-page">SETTINGS_CONTENT</div>
}));

vi.mock('./db/database', () => ({
    initializeDatabase: vi.fn(),
    getTransactions: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getQuickAddPresets: vi.fn().mockResolvedValue([]),
    initializeQuickAddPresets: vi.fn().mockResolvedValue(undefined),
    addQuickAddPreset: vi.fn(),
    deleteQuickAddPreset: vi.fn(),
    addTransaction: vi.fn(),
}));

vi.mock('./services/classifier', () => ({
    buildMerchantCacheFromHistory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./components/Sidebar', () => ({
    Sidebar: () => <div data-testid="sidebar-mock">SIDEBAR_MOCK</div>
}));

describe('App Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(initializeDatabase).mockResolvedValue(undefined);
    });

    it('renders the app shell with sidebar', async () => {
        render(<App />);
        
        // Wait for loading to finish
        await screen.findByTestId('sidebar-mock');
        expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
        
        // Check main content area
        expect(screen.getByRole('main')).toBeInTheDocument();
    });
});
