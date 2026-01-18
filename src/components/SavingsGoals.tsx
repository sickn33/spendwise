import { useState, useEffect, useCallback } from 'react';
import { getSavingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal, addToSavingsGoal, withdrawFromSavingsGoal } from '../db/database';
import type { SavingsGoal } from '../types';
import { format, differenceInDays } from 'date-fns';
import { Plus, Edit2, Trash2, X, Save, Target, TrendingUp, Calendar, PlusCircle, MinusCircle } from 'lucide-react';

export function SavingsGoals() {
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
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Obiettivi di Risparmio</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                        Monitora i tuoi progressi verso i tuoi obiettivi
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    <Plus size={18} />
                    Nuovo Obiettivo
                </button>
            </div>

            {/* Goals Grid */}
            {goals.length > 0 ? (
                <div className="savings-grid">
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
                                className={`card savings-card ${isComplete ? 'complete' : ''}`}
                                style={{ '--goal-color': goal.color } as React.CSSProperties}
                            >
                                <div className="savings-header">
                                    <div className="savings-icon" style={{ background: `${goal.color}20`, color: goal.color }}>
                                        {goal.icon}
                                    </div>
                                    <div className="savings-info">
                                        <h3 className="savings-name">{goal.name}</h3>
                                        {goal.deadline && (
                                            <div className="savings-deadline">
                                                <Calendar size={14} />
                                                {daysLeft !== null && daysLeft > 0
                                                    ? `${daysLeft} giorni rimanenti`
                                                    : daysLeft === 0
                                                        ? 'Scade oggi!'
                                                        : 'Scaduto'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="savings-actions">
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            onClick={() => handleEdit(goal)}
                                            style={{ width: 32, height: 32 }}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            onClick={() => handleDelete(goal.id!)}
                                            style={{ width: 32, height: 32 }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="savings-amounts">
                                    <div className="savings-current">
                                        <span className="label">Risparmiato</span>
                                        <span className="value" style={{ color: goal.color }}>
                                            €{goal.currentAmount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="savings-target">
                                        <span className="label">Obiettivo</span>
                                        <span className="value">€{goal.targetAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="savings-progress">
                                    <div
                                        className="savings-progress-fill"
                                        style={{
                                            width: `${percentage}%`,
                                            background: isComplete
                                                ? 'var(--success)'
                                                : `linear-gradient(90deg, ${goal.color}, ${goal.color}88)`
                                        }}
                                    />
                                </div>

                                <div className="savings-footer">
                                    {isComplete ? (
                                        <div className="savings-complete">
                                            <Target size={16} />
                                            Obiettivo raggiunto! 🎉
                                        </div>
                                    ) : (
                                        <div className="savings-remaining">
                                            <TrendingUp size={14} />
                                            Mancano €{remaining.toFixed(2)}
                                        </div>
                                    )}
                                    <span className="savings-percentage">{percentage.toFixed(0)}%</span>
                                </div>

                                {/* Contribute Buttons */}
                                {showContribute === goal.id ? (
                                    <div className="savings-contribute-form">
                                        <input
                                            type="number"
                                            className="input"
                                            placeholder="Importo"
                                            value={contributeAmount}
                                            onChange={e => setContributeAmount(e.target.value)}
                                            autoFocus
                                        />
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => handleContribute(goal.id!, false)}
                                                style={{ flex: 1 }}
                                            >
                                                <PlusCircle size={16} />
                                                Aggiungi
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => handleContribute(goal.id!, true)}
                                                style={{ flex: 1 }}
                                            >
                                                <MinusCircle size={16} />
                                                Preleva
                                            </button>
                                        </div>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => { setShowContribute(null); setContributeAmount(''); }}
                                            style={{ width: '100%' }}
                                        >
                                            Annulla
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="btn btn-primary savings-contribute-btn"
                                        onClick={() => setShowContribute(goal.id!)}
                                        style={{ width: '100%', marginTop: 'var(--space-md)' }}
                                    >
                                        <PlusCircle size={16} />
                                        Aggiungi / Preleva
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">🎯</div>
                    <div className="empty-state-title">Nessun obiettivo di risparmio</div>
                    <p>Crea il tuo primo obiettivo per iniziare a risparmiare!</p>
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        <Plus size={18} />
                        Crea Obiettivo
                    </button>
                </div>
            )}

            {/* Add/Edit Goal Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={resetForm}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingGoal ? 'Modifica Obiettivo' : 'Nuovo Obiettivo'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={resetForm}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: 'var(--space-lg)' }}>
                            <div className="form-group">
                                <label className="form-label">Nome obiettivo</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="es. Vacanza estiva"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Obiettivo (€)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="1000"
                                        step="1"
                                        min="0"
                                        value={formData.targetAmount}
                                        onChange={e => setFormData({ ...formData, targetAmount: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Già risparmiato (€)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="0"
                                        step="1"
                                        min="0"
                                        value={formData.currentAmount}
                                        onChange={e => setFormData({ ...formData, currentAmount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Data obiettivo (opzionale)</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.deadline}
                                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Icona</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                    {ICON_OPTIONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            className={`btn ${formData.icon === icon ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setFormData({ ...formData, icon })}
                                            style={{ width: 44, height: 44, fontSize: '1.25rem', padding: 0 }}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Colore</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                    {COLOR_OPTIONS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            className="btn"
                                            onClick={() => setFormData({ ...formData, color })}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                padding: 0,
                                                background: color,
                                                border: formData.color === color ? '3px solid white' : 'none',
                                                boxShadow: formData.color === color ? `0 0 0 2px ${color}` : 'none'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={!formData.name || !formData.targetAmount}
                                >
                                    <Save size={16} />
                                    {editingGoal ? 'Salva' : 'Crea Obiettivo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
