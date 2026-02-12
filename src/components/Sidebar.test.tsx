import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from './Sidebar';

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

        expect(screen.getByText('Riepilogo')).toBeInTheDocument();
        expect(screen.getByText('Registro')).toBeInTheDocument();
        expect(screen.getByText('Report')).toBeInTheDocument();
        expect(screen.getByText('Categorie')).toBeInTheDocument();
        expect(screen.getByText('Configurazione')).toBeInTheDocument();
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

        // Find the button that contains 'Registro'
        const activeItem = screen.getByText('Registro').closest('button');
        // Check for specific active class
        expect(activeItem?.className).toContain('active');
        
        const inactiveItem = screen.getByText('Riepilogo').closest('button');
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
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
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

        fireEvent.click(screen.getByText('Registro'));
        expect(handleNavigate).toHaveBeenCalledWith('transactions');
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

        fireEvent.click(screen.getByText('MODO SCURO'));
        expect(handleThemeToggle).toHaveBeenCalled();
    });
});
