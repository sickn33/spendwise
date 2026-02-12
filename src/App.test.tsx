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
    Sidebar: ({ theme, onThemeToggle }: { theme: string; onThemeToggle: () => void }) => (
        <div data-testid="sidebar-mock">
            <span data-testid="current-theme">{theme}</span>
            <button data-testid="theme-toggle-btn" onClick={onThemeToggle}>Toggle Theme</button>
        </div>
    )
}));

describe('App Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(initializeDatabase).mockResolvedValue(undefined);
    });

    it('toggles theme correctly', async () => {
        render(<App />);
        
        // Wait for app to load
        await screen.findByTestId('sidebar-mock');
        
        // Initial theme should be 'dark' (as per App.tsx state default)
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(screen.getByTestId('current-theme').textContent).toBe('dark');
        
        // Click toggle
        const toggleBtn = screen.getByTestId('theme-toggle-btn');
        fireEvent.click(toggleBtn);
        
        // Should toggle to 'light'
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(screen.getByTestId('current-theme').textContent).toBe('light');
        
        // Click toggle again
        fireEvent.click(toggleBtn);
        
        // Should toggle back to 'dark'
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    });
});
