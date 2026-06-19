import { useState, useEffect, useCallback, memo } from 'react';
import { getSavingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal, addToSavingsGoal, withdrawFromSavingsGoal } from '../db/database';
import type { SavingsGoal } from '../types';
import { format, differenceInDays } from 'date-fns';
import { Plus, Edit2, Trash2, X, Save, Target, TrendingUp, Calendar, PlusCircle } from 'lucide-react';

export const SavingsGoals = memo(function SavingsGoals() {
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
    const [showContribute, setShowContribute] = useState<number | null>(null);
    const [contributeAmount, setContributeAmount] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        targetAmount: '',
        currentAmount: '',
        icon: '🎯',
        color: '#6366f1',
        deadline: ''
    });

    const loadGoals = useCallback(async () => {
        setLoading(true);
        try {
            const g = await getSavingsGoals();
            setGoals(g);
        } catch (error) {
            console.error('Error loading savings goals:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGoals();
    }, [loadGoals]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name || !formData.targetAmount) return;

        const goalData = {
            name: formData.name,
            targetAmount: parseFloat(formData.targetAmount),
            currentAmount: parseFloat(formData.currentAmount) || 0,
            icon: formData.icon,
            color: formData.color,
            deadline: formData.deadline ? new Date(formData.deadline) : undefined
        };

        if (editingGoal) {
            await updateSavingsGoal(editingGoal.id!, goalData);
        } else {
            await addSavingsGoal(goalData);
        }

        resetForm();
        loadGoals();
    }

    async function handleDelete(id: number) {
        await deleteSavingsGoal(id);
        loadGoals();
    }

    async function handleContribute(id: number, isWithdraw: boolean) {
        const amount = parseFloat(contributeAmount);
        if (!amount || amount <= 0) return;

        if (isWithdraw) {
            await withdrawFromSavingsGoal(id, amount);
        } else {
            await addToSavingsGoal(id, amount);
        }

        setShowContribute(null);
        setContributeAmount('');
        loadGoals();
    }

    function handleEdit(goal: SavingsGoal) {
        setEditingGoal(goal);
        setFormData({
            name: goal.name,
            targetAmount: goal.targetAmount.toString(),
            currentAmount: goal.currentAmount.toString(),
            icon: goal.icon,
            color: goal.color,
            deadline: goal.deadline ? format(new Date(goal.deadline), 'yyyy-MM-dd') : ''
        });
        setShowForm(true);
    }

    function resetForm() {
        setEditingGoal(null);
        setFormData({
            name: '',
            targetAmount: '',
            currentAmount: '',
            icon: '🎯',
            color: '#6366f1',
            deadline: ''
        });
        setShowForm(false);
    }

    const ICON_OPTIONS = ['🎯', '✈️', '🏠', '🚗', '💻', '📱', '🎓', '💍', '🏖️', '🎁', '🛡️', '💰'];
    const COLOR_OPTIONS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6'];

    if (loading) {
        return (
            <div className="flex justify-center p-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink"></div>
            </div>
        );
    }

    return (
        <div className="space-y-lg">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">SAVINGS GOALS</h1>
                    <p className="text-xs font-mono text-muted uppercase tracking-wider mt-1">
                        ASSET TRACKING
                    </p>
                </div>
                <button 
                    className="btn btn-primary flex items-center gap-xs text-xs uppercase tracking-wider" 
                    onClick={() => setShowForm(true)}
                >
                    <Plus size={14} />
                    NEW GOAL
                </button>
            </div>

            {/* Goals Grid */}
            {goals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                    {goals.map(goal => {
                        const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                        const remaining = goal.targetAmount - goal.currentAmount;
                        const isComplete = goal.currentAmount >= goal.targetAmount;
                        const daysLeft = goal.deadline
                            ? differenceInDays(new Date(goal.deadline), new Date())
                            : null;

                        return (
                            <div
                                key={goal.id}
                                className={`bg-paper structural-border p-md relative group transition-all hover:shadow-none hover:border-ink ${isComplete ? 'border-success' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-md">
                                    <div className="flex items-center gap-md">
                                        <div className="w-10 h-10 flex items-center justify-center bg-concrete/20 text-xl rounded-none structural-border border-border">
                                            {goal.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg tracking-tight leading-none mb-1">{goal.name}</h3>
                                            {goal.deadline && (
                                                <div className="flex items-center gap-xs text-xs font-mono text-muted uppercase">
                                                    <Calendar size={10} />
                                                    {daysLeft !== null && daysLeft > 0
                                                            ? `${daysLeft} DAYS`
                                                        : daysLeft === 0
                                                            ? 'TODAY'
                                                            : 'OVERDUE'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-xs transition-opacity group-hover:opacity-100">
                                        <button
                                            className="p-1 hover:bg-concrete text-muted hover:text-ink transition-colors"
                                            onClick={() => handleEdit(goal)}
                                            aria-label="Edit"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            className="p-1 hover:bg-concrete text-muted hover:text-danger transition-colors"
                                            onClick={() => handleDelete(goal.id!)}
                                            aria-label="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-md mb-md">
                                    <div>
                                        <div className="text-tiny font-mono uppercase text-muted mb-xs">SAVED</div>
                                        <div className="text-lg font-mono font-bold" style={{ color: goal.color }}>
                                            €{goal.currentAmount.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-tiny font-mono uppercase text-muted mb-xs">TARGET</div>
                                        <div className="text-lg font-mono font-bold">
                                            €{goal.targetAmount.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-md">
                                    <div className="flex justify-between text-xs font-mono text-muted mb-1 uppercase">
                                        <span>PROGRESS</span>
                                        <span>{percentage.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-concrete overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-500 ease-out"
                                            style={{
                                                width: `${percentage}%`,
                                                background: isComplete ? 'var(--success)' : goal.color
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-sm border-t border-dotted border-border">
                                    {isComplete ? (
                                        <div className="flex items-center gap-xs text-success font-mono text-sm uppercase font-bold">
                                            <Target size={14} />
                                            COMPLETED
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-xs text-muted font-mono text-xs uppercase">
                                            <TrendingUp size={14} />
                                            REMAINING €{remaining.toFixed(2)}
                                        </div>
                                    )}
                                </div>

                                {/* Quick Contribute */}
                                {showContribute === goal.id ? (
                                    <div className="absolute inset-x-0 bottom-0 top-auto bg-paper structural-border border-t-0 p-sm z-10 animate-in slide-in-from-top-2">
                                        <input
                                            type="number"
                                            className="w-full bg-concrete/20 border-b border-ink p-xs font-mono text-sm focus:outline-none mb-sm"
                                            placeholder="Amount..."
                                            value={contributeAmount}
                                            onChange={e => setContributeAmount(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="grid grid-cols-2 gap-xs">
                                            <button
                                                className="btn btn-primary text-xs py-1"
                                                onClick={() => handleContribute(goal.id!, false)}
                                            >
                                                ADD
                                            </button>
                                            <button
                                                className="btn btn-secondary text-xs py-1"
                                                onClick={() => handleContribute(goal.id!, true)}
                                            >
                                                WITHDRAW
                                            </button>
                                        </div>
                                        <button
                                            className="w-full text-center text-xs text-muted uppercase mt-xs hover:text-ink"
                                            onClick={() => { setShowContribute(null); setContributeAmount(''); }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="absolute bottom-md right-md btn btn-ghost btn-icon bg-paper hover:bg-concrete structural-border border-border shadow-none"
                                        onClick={() => setShowContribute(goal.id!)}
                                        aria-label="MANAGE_FUNDS"
                                    >
                                        <PlusCircle size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-xl border border-dashed border-border text-center bg-paper structural-border">
                    <Target size={32} className="text-muted mb-md text-muted" />
                    <h3 className="text-sm font-mono uppercase text-muted mb-xs">NO GOALS DEFINED</h3>
                    <p className="text-muted text-sm max-w-xs mb-md">
                        Define your first savings goal to start tracking.
                    </p>
                    <button className="btn btn-primary text-xs uppercase tracking-wider" onClick={() => setShowForm(true)}>
                        <Plus size={14} className="mr-xs" />
                        CREATE FIRST GOAL
                    </button>
                </div>
            )}

            {/* Add/Edit Goal Modal - Data Entry Sheet Style */}
            {showForm && (
                <div className="fixed inset-0 bg-paper/90 backdrop-blur-sm z-50 flex items-center justify-center p-md" onClick={resetForm}>
                    <div className="w-full max-w-md bg-paper structural-border shadow-none" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-md border-b border-border">
                            <h2 className="text-sm font-mono uppercase tracking-wider">
                                {editingGoal ? 'EDIT GOAL' : 'NEW GOAL'}
                            </h2>
                            <button 
                                className="btn btn-ghost btn-icon structural-border border-0" 
                                onClick={resetForm}
                                aria-label="CLOSE"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-lg space-y-md">
                            <div className="space-y-xs">
                                <label className="text-tiny font-mono uppercase text-muted">GOAL NAME</label>
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-b border-border focus:border-ink py-xs font-mono text-sm focus:outline-none placeholder:text-muted/50"
                                    placeholder="GOAL NAME"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-md">
                                <div className="space-y-xs">
                                    <label className="text-tiny font-mono uppercase text-muted">TARGET (€)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-transparent border-b border-border focus:border-ink py-xs font-mono text-sm focus:outline-none"
                                        placeholder="0.00"
                                        step="1"
                                        min="0"
                                        value={formData.targetAmount}
                                        onChange={e => setFormData({ ...formData, targetAmount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-xs">
                                    <label className="text-tiny font-mono uppercase text-muted">CURRENT (€)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-transparent border-b border-border focus:border-ink py-xs font-mono text-sm focus:outline-none"
                                        placeholder="0.00"
                                        step="1"
                                        min="0"
                                        value={formData.currentAmount}
                                        onChange={e => setFormData({ ...formData, currentAmount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-xs">
                                <label className="text-tiny font-mono uppercase text-muted">DEADLINE (OPTIONAL)</label>
                                <input
                                    type="date"
                                    className="w-full bg-transparent border-b border-border focus:border-ink py-xs font-mono text-sm focus:outline-none uppercase"
                                    value={formData.deadline}
                                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                />
                            </div>

                            <div className="space-y-xs">
                                <label className="text-tiny font-mono uppercase text-muted">ICON</label>
                                <div className="flex flex-wrap gap-xs">
                                    {ICON_OPTIONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            className={`w-10 h-10 flex items-center justify-center text-lg transition-colors border ${formData.icon === icon ? 'bg-concrete border-ink' : 'bg-transparent border-transparent hover:bg-concrete/50'}`}
                                            onClick={() => setFormData({ ...formData, icon })}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-xs">
                                <label className="text-tiny font-mono uppercase text-muted">COLOR</label>
                                <div className="flex flex-wrap gap-xs">
                                    {COLOR_OPTIONS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            className="w-8 h-8 structural-border border-border transition-transform hover:scale-110"
                                            onClick={() => setFormData({ ...formData, color })}
                                            style={{
                                                backgroundColor: color,
                                                borderColor: formData.color === color ? 'var(--ink)' : 'transparent',
                                                boxShadow: formData.color === color ? '0 0 0 2px var(--paper), 0 0 0 3px var(--ink)' : 'none'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="pt-md flex justify-end gap-sm">
                                <button type="button" className="btn btn-secondary text-xs uppercase tracking-wider" onClick={resetForm}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary text-xs uppercase tracking-wider flex items-center gap-xs"
                                    disabled={!formData.name || !formData.targetAmount}
                                >
                                    <Save size={14} />
                                    {editingGoal ? 'Save changes' : 'CREATE GOAL'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
