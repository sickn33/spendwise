import { useState, useEffect, useCallback, memo } from 'react';
import { getBudgets, addBudget, updateBudget, deleteBudget, getCategories, getTransactions } from '../db/database';
import type { Budget, Category, BudgetProgress } from '../types';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Plus, Edit2, Trash2, X, Save, TrendingUp, AlertTriangle } from 'lucide-react';

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

    const getProgressColor = useCallback((progress: BudgetProgress) => {
        if (progress.isOverBudget) return 'bg-danger';
        if (progress.percentage > 80) return 'bg-warning';
        return 'bg-success';
    }, []);

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
                    <h1 className="page-title">Budget</h1>
                    <p className="text-muted mt-xs">
                        Imposta limiti di spesa per categoria
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    <Plus size={18} />
                    Nuovo Budget
                </button>
            </div>

            {/* Budget Progress Cards */}
            {budgetProgress.length > 0 ? (
                <div className="budget-grid">
                    {budgetProgress.map(progress => (
                        <div
                            key={progress.budget.id}
                            className={`card budget-card ${progress.isOverBudget ? 'over-budget' : ''}`}
                        >
                            <div className="budget-header">
                                <div className="flex items-center gap-sm">
                                    <span className="font-xl">{progress.category?.icon}</span>
                                    <div>
                                        <div className="font-semibold">{progress.category?.name}</div>
                                        <div className="font-sm text-muted">
                                            Budget mensile
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-xs">
                                    <button
                                        className="btn btn-ghost btn-icon btn-xs-icon"
                                        onClick={() => handleEdit(progress.budget)}
                                        title="Modifica budget"
                                        aria-label="Modifica budget"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-icon btn-xs-icon"
                                        onClick={() => handleDelete(progress.budget.id!)}
                                        title="Elimina budget"
                                        aria-label="Elimina budget"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="budget-amounts">
                                <div>
                                    <span className="text-muted font-sm">Speso</span>
                                    <div className={`font-xl font-bold ${progress.isOverBudget ? 'text-danger' : ''}`}>
                                        €{progress.spent.toFixed(2)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-muted font-sm">Budget</span>
                                    <div className="font-xl font-bold">
                                        €{progress.budget.amount.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="budget-progress-bar">
                                <div
                                    className={`budget-progress-fill ${getProgressColor(progress)}`}
                                    ref={el => {
                                        if (el) el.style.setProperty('--progress-width', `${Math.min(progress.percentage, 100)}%`);
                                    }}
                                />
                            </div>

                            <div className="budget-footer">
                                {progress.isOverBudget ? (
                                    <div className="text-danger flex items-center gap-xs">
                                        <AlertTriangle size={16} />
                                        Budget superato di €{Math.abs(progress.remaining).toFixed(2)}
                                    </div>
                                ) : (
                                    <div className="text-success flex items-center gap-xs">
                                        <TrendingUp size={16} />
                                        Rimangono €{progress.remaining.toFixed(2)}
                                    </div>
                                )}
                                <div className="text-muted font-sm">
                                    {progress.percentage.toFixed(0)}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">💰</div>
                    <div className="empty-state-title">Nessun budget impostato</div>
                    <p>Crea budget per tenere sotto controllo le tue spese per categoria</p>
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        <Plus size={18} />
                        Crea il tuo primo budget
                    </button>
                </div>
            )}

            {/* Add/Edit Budget Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={resetForm}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingBudget ? 'Modifica Budget' : 'Nuovo Budget'}</h2>
                            <button 
                                className="btn btn-ghost btn-icon" 
                                onClick={resetForm}
                                title="Chiudi"
                                aria-label="Chiudi"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Categoria</label>
                                <select
                                    className="input"
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: parseInt(e.target.value) })}
                                    disabled={!!editingBudget}
                                    title="Seleziona categoria"
                                >
                                    <option value={0}>Seleziona categoria</option>
                                    {(editingBudget ? categories : categoriesWithoutBudget)
                                        .filter(c => !c.isIncome)
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Budget mensile (€)</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="es. 200"
                                    step="1"
                                    min="0"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={!formData.categoryId || !formData.amount}
                                >
                                    <Save size={16} />
                                    {editingBudget ? 'Salva' : 'Crea Budget'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
