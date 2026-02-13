import { useState, useEffect, useMemo, useDeferredValue, memo } from 'react';
import { getTransactions, getCategories, deleteTransaction } from '../db/database';
import type { Transaction, Category } from '../types';
import { format, startOfMonth, subMonths, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Search, Filter, Trash2, Edit2, X, TrendingDown, ArrowUpDown, Calendar, DollarSign } from 'lucide-react';
import { TransactionForm } from './TransactionForm';

interface TransactionListProps {
    refreshTrigger?: number;
}

interface IndexedTransaction extends Transaction {
    timestamp: number;
    dateKey: string;
    searchableText: string;
}

export const TransactionList = memo(function TransactionList({ refreshTrigger }: TransactionListProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [dateRange, setDateRange] = useState<'all' | 'month' | '3months' | 'year' | 'custom'>('all');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [transactionType, setTransactionType] = useState<'all' | 'expense' | 'income'>('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showFilters, setShowFilters] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    async function loadData() {
        setLoading(true);
        try {
            const [txs, cats] = await Promise.all([
                getTransactions(),
                getCategories()
            ]);
            setTransactions(txs);
            setCategories(cats);
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setLoading(false);
        }
    }

    const categoryMap = useMemo(() =>
        new Map(categories.map(c => [c.id!, c])),
        [categories]
    );

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedCategoryId) count++;
        if (dateRange !== 'all') count++;
        if (transactionType !== 'all') count++;
        if (minAmount || maxAmount) count++;
        return count;
    }, [selectedCategoryId, dateRange, transactionType, minAmount, maxAmount]);

    const indexedTransactions = useMemo<IndexedTransaction[]>(() => {
        return transactions.map(t => {
            const dateObj = new Date(t.date);
            const categoryName = categoryMap.get(t.categoryId)?.name ?? '';
            return {
                ...t,
                timestamp: dateObj.getTime(),
                dateKey: format(dateObj, 'yyyy-MM-dd'),
                searchableText: `${t.description} ${t.details ?? ''} ${categoryName}`.toLowerCase()
            };
        });
    }, [transactions, categoryMap]);

    const filteredTransactions = useMemo(() => {
        let filtered = [...indexedTransactions];
        const now = new Date();
        const query = deferredSearchQuery.trim().toLowerCase();
        const customDateFromTs = customDateFrom ? parseISO(customDateFrom).getTime() : null;
        const customDateToTs = customDateTo ? parseISO(customDateTo).getTime() : null;

        // Date range filter
        if (dateRange === 'month') {
            const start = startOfMonth(now).getTime();
            filtered = filtered.filter(t => t.timestamp >= start);
        } else if (dateRange === '3months') {
            const start = subMonths(now, 3).getTime();
            filtered = filtered.filter(t => t.timestamp >= start);
        } else if (dateRange === 'year') {
            const start = new Date(now.getFullYear(), 0, 1).getTime();
            filtered = filtered.filter(t => t.timestamp >= start);
        } else if (dateRange === 'custom') {
            if (customDateFromTs !== null) {
                filtered = filtered.filter(t => t.timestamp >= customDateFromTs);
            }
            if (customDateToTs !== null) {
                filtered = filtered.filter(t => t.timestamp <= customDateToTs);
            }
        }

        // Transaction type filter
        if (transactionType === 'expense') {
            filtered = filtered.filter(t => t.amount < 0);
        } else if (transactionType === 'income') {
            filtered = filtered.filter(t => t.amount > 0);
        }

        // Amount range filter
        if (minAmount) {
            const min = parseFloat(minAmount);
            filtered = filtered.filter(t => Math.abs(t.amount) >= min);
        }
        if (maxAmount) {
            const max = parseFloat(maxAmount);
            filtered = filtered.filter(t => Math.abs(t.amount) <= max);
        }

        // Category filter
        if (selectedCategoryId) {
            filtered = filtered.filter(t => t.categoryId === selectedCategoryId);
        }

        // Search filter
        if (query) {
            filtered = filtered.filter(t => t.searchableText.includes(query));
        }

        // Sorting
        filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'date') {
                comparison = a.timestamp - b.timestamp;
            } else if (sortBy === 'amount') {
                comparison = Math.abs(a.amount) - Math.abs(b.amount);
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return filtered;
    }, [indexedTransactions, dateRange, customDateFrom, customDateTo, transactionType, minAmount, maxAmount, selectedCategoryId, deferredSearchQuery, sortBy, sortOrder]);

    // Group transactions by date
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, IndexedTransaction[]> = {};

        for (const t of filteredTransactions) {
            const dateKey = t.dateKey;
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(t);
        }

        return Object.entries(groups).sort((a, b) =>
            sortOrder === 'desc' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
        );
    }, [filteredTransactions, sortOrder]);

    const { totalFiltered, totalExpenses, totalIncome } = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            acc.totalFiltered += t.amount;
            if (t.amount < 0) acc.totalExpenses += t.amount;
            if (t.amount > 0) acc.totalIncome += t.amount;
            return acc;
        }, { totalFiltered: 0, totalExpenses: 0, totalIncome: 0 });
    }, [filteredTransactions]);

    async function handleDelete(id: number) {
        try {
            await deleteTransaction(id);
            setDeleteConfirm(null);
            loadData();
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    }

    function clearAllFilters() {
        setSelectedCategoryId(null);
        setDateRange('all');
        setCustomDateFrom('');
        setCustomDateTo('');
        setTransactionType('all');
        setMinAmount('');
        setMaxAmount('');
        setSearchQuery('');
    }

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">REGISTRO_TRANSAZIONI_v1</h1>
                    <p className="text-tiny font-mono text-muted">
                        {filteredTransactions.length}_ENTRIES_LOADED
                    </p>
                </div>
                <button
                    className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowFilters(!showFilters)}
                    aria-label="Mostra filtri"
                >
                    <Filter size={16} />
                    Filtri
                    {activeFiltersCount > 0 && (
                        <span className="badge badge-success" style={{ marginLeft: 'var(--space-sm)', minWidth: '20px' }}>
                            {activeFiltersCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Summary Grid */}
            <div className="grid-3 gap-md mb-lg">
                <div className="structural-border p-md">
                    <div className="text-tiny font-mono uppercase text-muted mb-xs">USCITE_TOTALI</div>
                    <div className="font-mono text-lg text-danger">
                        €{Math.abs(totalExpenses).toFixed(2)}
                    </div>
                </div>
                <div className="structural-border p-md">
                    <div className="text-tiny font-mono uppercase text-muted mb-xs">ENTRATE_TOTALI</div>
                    <div className="font-mono text-lg text-success">
                        €{totalIncome.toFixed(2)}
                    </div>
                </div>
                <div className="structural-border p-md">
                    <div className="text-tiny font-mono uppercase text-muted mb-xs">NET_FLOW</div>
                    <div className={`font-mono text-lg ${totalFiltered >= 0 ? 'text-success' : 'text-danger'}`}>
                        {totalFiltered >= 0 ? '+' : ''}€{totalFiltered.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ position: 'relative' }}>
                    <Search
                        size={18}
                        style={{
                            position: 'absolute',
                            left: 'var(--space-md)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }}
                    />
                    <input
                        type="text"
                        className="input"
                        placeholder="Cerca per descrizione, dettagli o categoria..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    />
                    {searchQuery && (
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}
                            onClick={() => setSearchQuery('')}
                            aria-label="Pulisci ricerca"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="card" style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                            {/* Transaction Type */}
                            <div>
                                <label className="form-label" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <TrendingDown size={14} style={{ marginRight: '4px' }} />
                                    Tipo
                                </label>
                                <select
                                    className="input"
                                    value={transactionType}
                                    onChange={e => setTransactionType(e.target.value as typeof transactionType)}
                                >
                                    <option value="all">Tutte</option>
                                    <option value="expense">Solo spese</option>
                                    <option value="income">Solo entrate</option>
                                </select>
                            </div>

                            {/* Date Range */}
                            <div>
                                <label className="form-label" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <Calendar size={14} style={{ marginRight: '4px' }} />
                                    Periodo
                                </label>
                                <select
                                    className="input"
                                    value={dateRange}
                                    onChange={e => setDateRange(e.target.value as typeof dateRange)}
                                >
                                    <option value="all">Tutte le date</option>
                                    <option value="month">Questo mese</option>
                                    <option value="3months">Ultimi 3 mesi</option>
                                    <option value="year">Quest'anno</option>
                                    <option value="custom">Personalizzato</option>
                                </select>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="form-label" style={{ marginBottom: 'var(--space-xs)' }}>Categoria</label>
                                <select
                                    className="input"
                                    value={selectedCategoryId || ''}
                                    onChange={e => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">Tutte le categorie</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.icon} {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Amount Range */}
                            <div>
                                <label className="form-label" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <DollarSign size={14} style={{ marginRight: '4px' }} />
                                    Importo (€)
                                </label>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Min"
                                        value={minAmount}
                                        onChange={e => setMinAmount(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Max"
                                        value={maxAmount}
                                        onChange={e => setMaxAmount(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>

                            {/* Sort */}
                            <div>
                                <label className="form-label" style={{ marginBottom: 'var(--space-xs)' }}>
                                    <ArrowUpDown size={14} style={{ marginRight: '4px' }} />
                                    Ordina per
                                </label>
                                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                    <select
                                        className="input"
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value as typeof sortBy)}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="date">Data</option>
                                        <option value="amount">Importo</option>
                                    </select>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                                        style={{ padding: 'var(--space-sm)' }}
                                    >
                                        {sortOrder === 'desc' ? '↓' : '↑'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Custom Date Range */}
                        {dateRange === 'custom' && (
                            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label" style={{ marginBottom: 'var(--space-xs)' }}>Da</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={customDateFrom}
                                        onChange={e => setCustomDateFrom(e.target.value)}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label" style={{ marginBottom: 'var(--space-xs)' }}>A</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={customDateTo}
                                        onChange={e => setCustomDateTo(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Clear Filters */}
                        {activeFiltersCount > 0 && (
                            <button
                                className="btn btn-ghost"
                                onClick={clearAllFilters}
                                style={{ marginTop: 'var(--space-md)' }}
                            >
                                <X size={16} />
                                Resetta tutti i filtri
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Transaction Groups */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {groupedTransactions.length > 0 ? (
                    groupedTransactions.map(([dateKey, txs]) => (
                        <div key={dateKey}>
                            <div style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--bg-glass)',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                position: 'sticky',
                                top: 0,
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}>
                                <span>{format(new Date(dateKey), "EEEE d MMMM yyyy", { locale: it })}</span>
                                <span style={{ fontFeatureSettings: 'tnum' }}>
                                    {txs.length} transazioni
                                </span>
                            </div>
                            <div className="transaction-list">
                                {txs.map(t => {
                                    const category = categoryMap.get(t.categoryId);
                                    return (
                                        <div key={t.id} className="ledger-row" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                                            <div
                                                className="transaction-icon"
                                                style={{ background: 'transparent', border: '1px solid var(--border-color)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                {category?.icon || '📦'}
                                            </div>
                                            <div className="transaction-info">
                                                <div className="font-mono text-sm">{t.description}</div>
                                                <div className="text-tiny font-mono text-muted uppercase">
                                                    {category?.name}
                                                    {t.isRecurring && ' [R]'}
                                                </div>
                                            </div>
                                            <div className={`font-mono ${t.amount < 0 ? 'text-danger' : 'text-success'}`}>
                                                {t.amount < 0 ? '' : '+'}€{Math.abs(t.amount).toFixed(2)}
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                                <button
                                                    className="btn btn-ghost btn-icon structural-border"
                                                    style={{ width: 28, height: 28, borderRadius: 0 }}
                                                    onClick={() => setEditingTransaction(t)}
                                                    aria-label="Modifica"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                {deleteConfirm === t.id ? (
                                                    <button
                                                        className="btn btn-danger btn-icon structural-border"
                                                        style={{ width: 28, height: 28, borderRadius: 0 }}
                                                        onClick={() => handleDelete(t.id!)}
                                                        aria-label="Conferma eliminazione"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn btn-ghost btn-icon structural-border"
                                                        style={{ width: 28, height: 28, borderRadius: 0 }}
                                                        onClick={() => setDeleteConfirm(t.id!)}
                                                        aria-label="Elimina"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <div className="empty-state-title">Nessuna transazione trovata</div>
                        <p>Prova a modificare i filtri di ricerca</p>
                        {activeFiltersCount > 0 && (
                            <button className="btn btn-secondary" onClick={clearAllFilters} style={{ marginTop: 'var(--space-md)' }}>
                                Resetta filtri
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingTransaction && (
                <TransactionForm
                    transaction={editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    onSave={() => {
                        setEditingTransaction(null);
                        loadData();
                    }}
                />
            )}
        </div>
    );
});
