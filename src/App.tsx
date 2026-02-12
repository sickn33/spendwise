import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { initializeDatabase, getTransactions, getCategories } from './db/database';
import { buildMerchantCacheFromHistory } from './services/classifier';
import { useLocalBackup } from './hooks/useLocalBackup';
import { TransactionForm } from './components/TransactionForm';
import { Plus, Wallet, Keyboard } from 'lucide-react';
import './index.css';
import { Sidebar, type Page } from './components/Sidebar';

const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TransactionList = lazy(() => import('./components/TransactionList').then(m => ({ default: m.TransactionList })));
const CategoryManager = lazy(() => import('./components/CategoryManager').then(m => ({ default: m.CategoryManager })));
const BudgetManager = lazy(() => import('./components/BudgetManager').then(m => ({ default: m.BudgetManager })));
const SavingsGoals = lazy(() => import('./components/SavingsGoals').then(m => ({ default: m.SavingsGoals })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const MonthComparison = lazy(() => import('./components/MonthComparison').then(m => ({ default: m.MonthComparison })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));


function App() {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const [announcement, setAnnouncement] = useState('');

    const { fileHandle, permissionStatus, saveToBackup } = useLocalBackup();

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
        } else {
            // Default to dark if no saved theme
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }, []);

    function handleTransactionSaved() {
        setShowTransactionForm(false);
        setRefreshTrigger(prev => prev + 1);
    }

    // Auto-backup trigger
    useEffect(() => {
        if (fileHandle && permissionStatus === 'granted') {
            const performBackup = async () => {
                try {
                    const [transactions, categories] = await Promise.all([
                        getTransactions(),
                        getCategories()
                    ]);
                    await saveToBackup({
                        version: '1.0',
                        exportedAt: new Date().toISOString(),
                        transactions,
                        categories
                    });
                } catch (err) {
                    console.error('Auto-backup failed:', err);
                }
            };
            performBackup();
        }
    }, [refreshTrigger, fileHandle, permissionStatus, saveToBackup]);

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
            <div className="loading-screen bg-paper">
                <div className="logo logo-large">
                    <div className="logo-icon">
                        <Wallet size={32} strokeWidth={2.5} />
                    </div>
                    <span>SpendWise</span>
                </div>
                <div className="spinner"></div>
                <p className="system-status">INITIALIZING_SYSTEM...</p>
            </div>
        );
    }

    const pageFallback = (
        <div className="loading">
            <div className="spinner"></div>
        </div>
    );

    const renderPage = () => {
        const page = (() => {
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
        })();
        return <Suspense fallback={pageFallback}>{page}</Suspense>;
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
            <Sidebar 
                currentPage={currentPage} 
                onNavigate={setCurrentPage} 
                theme={theme} 
                onThemeToggle={handleThemeToggle} 
                onTransactionAdded={() => setRefreshTrigger(prev => prev + 1)}
            />

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
