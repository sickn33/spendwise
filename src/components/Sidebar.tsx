import { LayoutDashboard, List, Tag, FileText, Settings as SettingsIcon, Wallet, Sun, Moon } from 'lucide-react';

export type Page = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'savings' | 'reports' | 'comparison' | 'settings';

interface SidebarProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
    theme: 'dark' | 'light';
    onThemeToggle: () => void;
}

export function Sidebar({ currentPage, onNavigate, theme, onThemeToggle }: SidebarProps) {
    return (
        <aside className="sidebar structural-border" role="complementary">
            <div className="sidebar-masthead">
                <div className="logo font-display">SPENDWISE</div>
                <div className="text-tiny font-mono opacity-40">v1.0.0_STABLE</div>
            </div>

            <div className="sidebar-nav">
                <nav className="flex flex-col gap-xs">
                    <button
                        className={`sidebar-nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                        onClick={() => onNavigate('dashboard')}
                    >
                        <LayoutDashboard size={14} />
                        <span>RIEPILOGO</span>
                    </button>

                    <button
                        className={`sidebar-nav-item ${currentPage === 'transactions' ? 'active' : ''}`}
                        onClick={() => onNavigate('transactions')}
                    >
                        <List size={14} />
                        <span>REGISTRO</span>
                    </button>

                    <button
                        className={`sidebar-nav-item ${currentPage === 'reports' ? 'active' : ''}`}
                        onClick={() => onNavigate('reports')}
                    >
                        <FileText size={14} />
                        <span>REPORT</span>
                    </button>

                    <button
                        className={`sidebar-nav-item ${currentPage === 'categories' ? 'active' : ''}`}
                        onClick={() => onNavigate('categories')}
                    >
                        <Tag size={14} />
                        <span>CATEGORIE</span>
                    </button>

                    <button
                        className={`sidebar-nav-item ${currentPage === 'settings' ? 'active' : ''}`}
                        onClick={() => onNavigate('settings')}
                    >
                        <SettingsIcon size={14} />
                        <span>CONFIG</span>
                    </button>
                </nav>
            </div>

            {/* Theme Toggle in Sidebar */}
            <div
                className="theme-toggle theme-toggle-mt-auto"
                onClick={onThemeToggle}
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
    );
}
