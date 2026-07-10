import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from './Sidebar';

vi.mock('./QuickAddWidget', () => ({
    QuickAddWidget: () => <div data-testid="quick-add-mock" />
}));

// Mock QuickAddWidget dependencies since it's now embedded in Sidebar
vi.mock('../db/database', () => ({
    getQuickAddPresets: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    addTransaction: vi.fn(),
    initializeQuickAddPresets: vi.fn().mockResolvedValue(undefined),
    addQuickAddPreset: vi.fn(),
    deleteQuickAddPreset: vi.fn(),
}));

describe('Sidebar Component', () => {
    it('renders all navigation items with Technical Editorial labels', () => {
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={() => {}} 
                onTransactionAdded={() => {}}
            />
        );

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Transactions')).toBeInTheDocument();
        expect(screen.getByText('Budgets')).toBeInTheDocument();
        expect(screen.getByText('Savings')).toBeInTheDocument();
        expect(screen.getByText('Reports')).toBeInTheDocument();
        expect(screen.getByText('Comparison')).toBeInTheDocument();
        expect(screen.getByText('Categories')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('highlights the active page', () => {
        render(
            <Sidebar 
                currentPage="transactions" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={() => {}} 
                onTransactionAdded={() => {}}
            />
        );

        const activeItem = screen.getByText('Transactions').closest('a');
        // Check for specific active class
        expect(activeItem?.className).toContain('active');
        
        const inactiveItem = screen.getByText('Dashboard').closest('a');
        expect(inactiveItem?.className).not.toContain('active');
    });

    it('displays the logo and version', () => {
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={() => {}} 
                onTransactionAdded={() => {}}
            />
        );
        expect(screen.getByText('SPENDWISE')).toBeInTheDocument();
        expect(screen.getByText('v1.0.1')).toBeInTheDocument();
        expect(screen.getByText('STABLE')).toBeInTheDocument();
    });

    it('calls onNavigate when an item is clicked', () => {
        const handleNavigate = vi.fn();
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={handleNavigate} 
                theme="dark" 
                onThemeToggle={() => {}} 
                onTransactionAdded={() => {}}
            />
        );

        fireEvent.click(screen.getByText('Transactions'));
        expect(handleNavigate).toHaveBeenCalledWith('transactions');
    });

    it('keeps a real destination and does not intercept modified clicks', () => {
        const handleNavigate = vi.fn();
        render(<Sidebar currentPage="dashboard" onNavigate={handleNavigate} hrefFor={page => `/spendwise/?page=${page}`} theme="dark" onThemeToggle={() => {}} onTransactionAdded={() => {}} />);
        const link = screen.getByRole('link', { name: 'Reports' });
        expect(link).toHaveAttribute('href', '/spendwise/?page=reports');
        fireEvent.click(link, { ctrlKey: true });
        expect(handleNavigate).not.toHaveBeenCalled();
    });

    it('calls onThemeToggle when theme switch is clicked', () => {
        const handleThemeToggle = vi.fn();
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={handleThemeToggle} 
                onTransactionAdded={() => {}}
            />
        );

        fireEvent.click(screen.getByText('DARK MODE'));
        expect(handleThemeToggle).toHaveBeenCalled();
    });
});
