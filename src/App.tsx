import { useState, useEffect, useCallback } from 'react';
import { initializeDatabase } from './db/database';
import { buildMerchantCacheFromHistory } from './services/classifier';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { TransactionForm } from './components/TransactionForm';
import { CategoryManager } from './components/CategoryManager';
import { BudgetManager } from './components/BudgetManager';
import { SavingsGoals } from './components/SavingsGoals';
import { Reports } from './components/Reports';
import { MonthComparison } from './components/MonthComparison';
import { Settings } from './components/Settings';
import { QuickAddWidget } from './components/QuickAddWidget';
import { LayoutDashboard, List, Tag, FileText, Settings as SettingsIcon, Plus, Wallet, PiggyBank, Target, Sun, Moon, GitCompare, Keyboard } from 'lucide-react';
import './index.css';

type Page = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'savings' | 'reports' | 'comparison' | 'settings';

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const [announcement, setAnnouncement] = useState('');

    useEffect(() => {
        async function init() {
            try {
                await initializeDatabase();
                await buildMerchantCacheFromHistory();
            } catch (error) {
                console.error('Error initializing database:', error);
            } finally {
                setLoading(false);
            }
        }
        init();

        // Load saved theme
        const savedTheme = localStorage.getItem('spendwise-theme') as 'dark' | 'light' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }, []);

    function handleTransactionSaved() {
        setShowTransactionForm(false);
        setRefreshTrigger(prev => prev + 1);
    }

    function handleThemeToggle() {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('spendwise-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        announce(`Tema cambiato a ${newTheme === 'dark' ? 'scuro' : 'chiaro'}`);
    }

    // Screen reader announcement helper
    const announce = useCallback((message: string) => {
        setAnnouncement(message);
        setTimeout(() => setAnnouncement(''), 1000);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            // Don't trigger shortcuts when typing in inputs
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.key.toLowerCase()) {
                case 'n':
                    e.preventDefault();
                    setShowTransactionForm(true);
                    announce('Aperta finestra nuova transazione');
                    break;
                case 'd':
                    e.preventDefault();
                    setCurrentPage('dashboard');
                    announce('Dashboard');
                    break;
                case 't':
                    e.preventDefault();
                    setCurrentPage('transactions');
                    announce('Transazioni');
                    break;
                case 'b':
                    e.preventDefault();
                    setCurrentPage('budgets');
                    announce('Budget');
                    break;
                case 'c':
                    e.preventDefault();
                    setCurrentPage('comparison');
                    announce('Confronto mensile');
                    break;
                case 'r':
                    e.preventDefault();
                    setCurrentPage('reports');
                    announce('Report');
                    break;
                case 's':
                    e.preventDefault();
                    setCurrentPage('settings');
                    announce('Impostazioni');
                    break;
                case '?':
                    e.preventDefault();
                    setShowShortcutsHelp(prev => !prev);
                    break;
                case 'escape':
                    if (showTransactionForm) {
                        setShowTransactionForm(false);
                        announce('Finestra chiusa');
                    }
                    if (showShortcutsHelp) {
                        setShowShortcutsHelp(false);
                    }
                    break;
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showTransactionForm, showShortcutsHelp, announce]);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="logo">
                    <div className="logo-icon">
                        <Wallet size={24} />
                    </div>
                    <span>SpendWise</span>
                </div>
                <div className="spinner"></div>
                <p className="loading-text">Caricamento...</p>
            </div>
        );
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard onAddTransaction={() => setShowTransactionForm(true)} />;
            case 'transactions':
                return <TransactionList refreshTrigger={refreshTrigger} />;
            case 'categories':
                return <CategoryManager />;
            case 'budgets':
                return <BudgetManager />;
            case 'savings':
                return <SavingsGoals />;
            case 'reports':
                return <Reports />;
            case 'comparison':
                return <MonthComparison />;
            case 'settings':
                return <Settings onTransactionsImported={() => setRefreshTrigger(prev => prev + 1)} />;
            default:
                return <Dashboard onAddTransaction={() => setShowTransactionForm(true)} />;
        }
    };

    return (
        <div className="app">
            {/* Skip Link for keyboard navigation */}
            <a href="#main-content" className="skip-link">
                Salta al contenuto principale
            </a>

            {/* ARIA Live Region for screen reader announcements */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {announcement}
            </div>

            {/* Sidebar */}
            <aside className="sidebar">
                <div className="logo">
                    <div className="logo-icon">
                        <Wallet size={20} />
                    </div>
                    <span>SpendWise</span>
                </div>

                <nav className="nav">
                    <button
                        className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('dashboard')}
                    >
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'transactions' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('transactions')}
                    >
                        <List size={20} />
                        <span>Transazioni</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'budgets' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('budgets')}
                    >
                        <PiggyBank size={20} />
                        <span>Budget</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'categories' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('categories')}
                    >
                        <Tag size={20} />
                        <span>Categorie</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'savings' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('savings')}
                    >
                        <Target size={20} />
                        <span>Risparmi</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'reports' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('reports')}
                    >
                        <FileText size={20} />
                        <span>Report</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'comparison' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('comparison')}
                    >
                        <GitCompare size={20} />
                        <span>Confronto</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('settings')}
                    >
                        <SettingsIcon size={20} />
                        <span>Impostazioni</span>
                    </button>
                </nav>

                {/* Theme Toggle in Sidebar */}
                <div
                    className="theme-toggle theme-toggle-mt-auto"
                    onClick={handleThemeToggle}
                >
                    <div className={`theme-toggle-switch ${theme === 'light' ? 'active' : ''}`}>
                        <div className="theme-toggle-knob">
                            {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                        </div>
                    </div>
                    <span className="theme-toggle-label">
                        {theme === 'dark' ? 'Tema Scuro' : 'Tema Chiaro'}
                    </span>
                </div>
            </aside>

            {/* Main Content */}
            <main id="main-content" className="main-content" tabIndex={-1}>
                {renderPage()}
            </main>

            {/* FAB - Add Transaction */}
            <button
                className="fab"
                onClick={() => setShowTransactionForm(true)}
                aria-label="Aggiungi transazione"
            >
                <Plus size={24} />
            </button>

            {/* Quick Add Widget */}
            <QuickAddWidget onTransactionAdded={() => setRefreshTrigger(prev => prev + 1)} />

            {/* Transaction Form Modal */}
            {showTransactionForm && (
                <TransactionForm
                    onClose={() => setShowTransactionForm(false)}
                    onSave={handleTransactionSaved}
                />
            )}

            {/* Keyboard Shortcuts Help */}
            {showShortcutsHelp && (
                <div className="shortcuts-help" role="dialog" aria-labelledby="shortcuts-title">
                    <div className="shortcuts-help-title" id="shortcuts-title">
                        <Keyboard size={18} />
                        Scorciatoie da Tastiera
                    </div>
                    <div className="shortcuts-list">
                        <div className="shortcut-item">
                            <span>Nuova transazione</span>
                            <span className="shortcut-key">N</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Dashboard</span>
                            <span className="shortcut-key">D</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Transazioni</span>
                            <span className="shortcut-key">T</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Budget</span>
                            <span className="shortcut-key">B</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Confronto</span>
                            <span className="shortcut-key">C</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Report</span>
                            <span className="shortcut-key">R</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Impostazioni</span>
                            <span className="shortcut-key">S</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Chiudi / Annulla</span>
                            <span className="shortcut-key">ESC</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Mostra/nascondi aiuto</span>
                            <span className="shortcut-key">?</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
