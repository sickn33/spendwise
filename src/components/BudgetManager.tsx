import { useState, useEffect, useCallback, memo } from 'react';
import { getBudgets, addBudget, updateBudget, deleteBudget, getCategories, getTransactions } from '../db/database';
import type { Budget, Category, BudgetProgress } from '../types';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Plus, Edit2, Trash2, X, TrendingUp, AlertTriangle } from 'lucide-react';

export const BudgetManager = memo(function BudgetManager() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [formData, setFormData] = useState({ categoryId: 0, amount: '' });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [b, c] = await Promise.all([
                getBudgets(),
                getCategories()
            ]);
            setBudgets(b);
            setCategories(c);

            // Calculate progress for each budget
            const now = new Date();
            const start = startOfMonth(now);
            const end = endOfMonth(now);
            // Optimized: Fetch only current month's transactions
            const monthTransactions = await getTransactions({
                dateFrom: start,
                dateTo: end
            });

            const progressList: BudgetProgress[] = b.map(budget => {
                const category = c.find(cat => cat.id === budget.categoryId);
                const spent = monthTransactions
                    .filter(t => t.categoryId === budget.categoryId && t.amount < 0)
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
                const remaining = budget.amount - spent;
                const percentage = (spent / budget.amount) * 100;

                return {
                    budget,
                    category: category!,
                    spent,
                    remaining,
                    percentage: Math.min(percentage, 100),
                    isOverBudget: spent > budget.amount
                };
            });

            setBudgetProgress(progressList);
        } catch (error) {
            console.error('Error loading budgets:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const resetForm = useCallback(() => {
        setEditingBudget(null);
        setFormData({ categoryId: 0, amount: '' });
        setShowForm(false);
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.categoryId || !formData.amount) return;

        const budgetData = {
            categoryId: formData.categoryId,
            amount: parseFloat(formData.amount),
            period: 'monthly' as const
        };

        if (editingBudget) {
            await updateBudget(editingBudget.id!, budgetData);
        } else {
            await addBudget(budgetData);
        }

        resetForm();
        loadData();
    }, [formData, editingBudget, resetForm, loadData]);

    const handleDelete = useCallback(async (id: number) => {
        if (confirm('Sei sicuro di voler eliminare questo budget?')) {
            await deleteBudget(id);
            loadData();
        }
    }, [loadData]);

    const handleEdit = useCallback((budget: Budget) => {
        setEditingBudget(budget);
        setFormData({
            categoryId: budget.categoryId,
            amount: budget.amount.toString()
        });
        setShowForm(true);
    }, []);

    const categoriesWithoutBudget = categories.filter(
        c => !c.isIncome && !budgets.some(b => b.categoryId === c.id)
    );

    if (loading) {
        return (
            <div className="flex justify-center p-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink"></div>
            </div>
        );
    }

    return (
        <div className="space-y-md">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">BUDGET_MANAGER</h1>
                    <p className="text-xs font-mono text-muted uppercase tracking-wider mt-1">
                        CONTROLLO_LIMITI_SPESA
                    </p>
                </div>
                <button 
                    className="btn btn-primary flex items-center gap-xs text-xs uppercase tracking-wider" 
                    onClick={() => setShowForm(true)}
                >
                    <Plus size={16} />
                    NUOVO_BUDGET
                </button>
            </div>

            {/* Budget Grid */}
            {budgetProgress.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                    {budgetProgress.map(progress => (
                        <div
                            key={progress.budget.id}
                            className={`bg-paper structural-border p-md relative group hover:border-ink transition-colors ${progress.isOverBudget ? 'border-danger' : ''}`}
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-md">
                                <div className="flex items-center gap-sm">
                                    <span className="text-xl">{progress.category?.icon}</span>
                                    <div>
                                        <div className="font-bold tracking-tight">{progress.category?.name}</div>
                                        <div className="text-tiny font-mono uppercase text-muted">MENSILE</div>
                                    </div>
                                </div>
                                <div className="flex gap-px opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        className="p-xs hover:bg-concrete text-ink"
                                        onClick={() => handleEdit(progress.budget)}
                                        title="Modifica"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        className="p-xs hover:bg-concrete text-ink hover:text-danger"
                                        onClick={() => handleDelete(progress.budget.id!)}
                                        title="Elimina"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-2 gap-sm mb-md border-t border-b border-border py-sm border-dashed">
                                <div>
                                    <span className="text-tiny font-mono uppercase text-muted block mb-1">SPESO</span>
                                    <div className={`text-lg font-mono font-bold ${progress.isOverBudget ? 'text-danger' : ''}`}>
                                        €{progress.spent.toFixed(2)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-tiny font-mono uppercase text-muted block mb-1">BUDGET</span>
                                    <div className="text-lg font-mono font-bold">
                                        €{progress.budget.amount.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-sm">
                                <div className="h-1 w-full bg-border">
                                    <div
                                        className={`h-full transition-all duration-500 ${progress.isOverBudget ? 'bg-danger' : 'bg-ink'}`}
                                        style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Footer Status */}
                            <div className="flex items-center justify-between text-xs font-mono">
                                {progress.isOverBudget ? (
                                    <div className="text-danger flex items-center gap-xs">
                                        <AlertTriangle size={14} />
                                        <span>OVER_LIMIT +€{Math.abs(progress.remaining).toFixed(0)}</span>
                                    </div>
                                ) : (
                                    <div className="text-muted flex items-center gap-xs">
                                        <TrendingUp size={14} />
                                        <span>RIMANENTE: €{progress.remaining.toFixed(0)}</span>
                                    </div>
                                )}
                                <div className="text-ink">{progress.percentage.toFixed(0)}%</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-xl border border-dashed border-border text-center bg-paper structural-border">
                    <AlertTriangle size={32} className="text-muted mb-md opacity-50" />
                    <h3 className="text-sm font-mono uppercase text-muted mb-xs">NESSUN_BUDGET_ATTIVO</h3>
                    <p className="text-muted text-sm max-w-xs mb-md">
                        Definisci i limiti di spesa per le categorie per monitorare i tuoi obiettivi finanziari.
                    </p>
                    <button 
                        className="btn btn-primary text-xs uppercase tracking-wider" 
                        onClick={() => setShowForm(true)}
                    >
                        INIZIA_CONFIGURAZIONE
                    </button>
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-paper/90 backdrop-blur-sm z-50 flex items-center justify-center p-md" onClick={resetForm}>
                    <div className="w-full max-w-sm bg-paper structural-border shadow-none" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-md border-b border-border">
                            <h2 className="text-sm font-mono uppercase tracking-wider">
                                {editingBudget ? 'MODIFICA_BUDGET' : 'NUOVO_BUDGET'}
                            </h2>
                            <button 
                                className="btn btn-ghost btn-icon structural-border border-0" 
                                onClick={resetForm}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-md space-y-md">
                            <div>
                                <label className="text-tiny font-mono uppercase opacity-60 mb-xs block">CATEGORIA</label>
                                <select
                                    className="w-full bg-paper border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink appearance-none rounded-none"
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: parseInt(e.target.value) })}
                                    disabled={!!editingBudget}
                                >
                                    <option value={0}>SELEZIONA...</option>
                                    {(editingBudget ? categories : categoriesWithoutBudget)
                                        .filter(c => !c.isIncome)
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div>
                                <label className="text-tiny font-mono uppercase opacity-60 mb-xs block">IMPORTO_MENSILE (€)</label>
                                <input
                                    type="number"
                                    className="w-full bg-paper border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink"
                                    placeholder="0.00"
                                    step="1"
                                    min="0"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>

                            <div className="pt-md border-t border-border flex justify-end gap-sm">
                                <button type="button" className="btn btn-secondary text-xs uppercase tracking-wider" onClick={resetForm}>
                                    ANNULLA
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary text-xs uppercase tracking-wider"
                                    disabled={!formData.categoryId || !formData.amount}
                                >
                                    {editingBudget ? 'SALVA_MODIFICHE' : 'CREA_BUDGET'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
