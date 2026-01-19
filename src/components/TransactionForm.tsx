import { useState, useEffect, useCallback } from 'react';
import { getCategories, addTransaction, updateTransaction } from '../db/database';
import { classifyTransaction, learnFromCorrection } from '../services/classifier';
import type { Category, Transaction } from '../types';
import { X, Calendar, Tag, DollarSign, FileText, Repeat } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionFormProps {
    transaction?: Transaction;
    onClose: () => void;
    onSave: () => void;
}

export function TransactionForm({ transaction, onClose, onSave }: TransactionFormProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [details, setDetails] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [isRecurring, setIsRecurring] = useState(false);
    const [isExpense, setIsExpense] = useState(true);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadCategories = useCallback(async () => {
        const cats = await getCategories();
        setCategories(cats);

        // Set default category if not editing
        if (!transaction && !categoryId) {
            const defaultCat = cats.find(c => c.name === 'Altre uscite');
            if (defaultCat?.id) setCategoryId(defaultCat.id);
        }
    }, [transaction, categoryId]);

    useEffect(() => {
        loadCategories();
        if (transaction) {
            setAmount(Math.abs(transaction.amount).toString());
            setDescription(transaction.description);
            setDetails(transaction.details);
            setDate(format(new Date(transaction.date), 'yyyy-MM-dd'));
            setCategoryId(transaction.categoryId);
            setIsRecurring(transaction.isRecurring);
            setIsExpense(transaction.amount < 0);
        }
    }, [transaction, loadCategories]);

    async function handleDescriptionBlur() {
        if (description && !transaction) {
            const classification = await classifyTransaction(description, details, isExpense ? -1 : 1);
            if (classification.confidence > 0.5) {
                setCategoryId(classification.categoryId);
            }
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!amount || !description || !categoryId) return;

        setSaving(true);
        try {
            const parsedAmount = parseFloat(amount.replace(',', '.'));
            const finalAmount = isExpense ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

            if (transaction?.id) {
                await updateTransaction(transaction.id, {
                    amount: finalAmount,
                    description,
                    details,
                    date: new Date(date),
                    categoryId,
                    isRecurring
                });
                // Learn from correction if category changed
                if (transaction.categoryId !== categoryId) {
                    learnFromCorrection(description, categoryId);
                }
            } else {
                await addTransaction({
                    amount: finalAmount,
                    description,
                    details,
                    date: new Date(date),
                    categoryId,
                    currency: 'EUR',
                    account: '',
                    isContabilized: true,
                    isRecurring,
                    tags: []
                });
                learnFromCorrection(description, categoryId);
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving transaction:', error);
        } finally {
            setSaving(false);
        }
    }

    const selectedCategory = categories.find(c => c.id === categoryId);
    const expenseCategories = categories.filter(c => !c.isIncome);
    const incomeCategories = categories.filter(c => c.isIncome);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {transaction ? 'Modifica transazione' : 'Nuova transazione'}
                    </h2>
                    <button 
                        className="btn btn-ghost btn-icon" 
                        onClick={onClose}
                        title="Chiudi"
                        aria-label="Chiudi"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-grid">
                            {/* Expense/Income Toggle */}
                            <div className="flex gap-sm mb-md">
                                <button
                                    type="button"
                                    className={`btn flex-1 ${isExpense ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setIsExpense(true)}
                                >
                                    Spesa
                                </button>
                                <button
                                    type="button"
                                    className={`btn flex-1 ${!isExpense ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setIsExpense(false)}
                                >
                                    Entrata
                                </button>
                            </div>

                            {/* Amount */}
                            <div className="input-group">
                                <label className="input-label">
                                    <DollarSign size={14} className="vertical-middle" /> Importo
                                </label>
                                <div className="relative">
                                    <span className="currency-symbol">€</span>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        className="input input-amount pl-amount"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="input-group">
                                <label className="input-label">
                                    <FileText size={14} className="vertical-middle" /> Descrizione
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="es. Cena al ristorante"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    onBlur={handleDescriptionBlur}
                                    required
                                />
                            </div>

                            {/* Date */}
                            <div className="input-group">
                                <label className="input-label">
                                    <Calendar size={14} className="vertical-middle" /> Data
                                </label>
                                <input
                                    type="date"
                                    className="input"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    title="Seleziona data"
                                    required
                                />
                            </div>

                            {/* Category */}
                            <div className="input-group">
                                <label className="input-label">
                                    <Tag size={14} className="vertical-middle" /> Categoria
                                </label>
                                <button
                                    type="button"
                                    className="input input-category-btn"
                                    onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                                    title="Seleziona categoria"
                                >
                                    {selectedCategory ? (
                                        <>
                                            <span>{selectedCategory.icon}</span>
                                            <span>{selectedCategory.name}</span>
                                        </>
                                    ) : (
                                        <span className="text-muted">Seleziona categoria</span>
                                    )}
                                </button>

                                {showCategoryPicker && (
                                    <div className="category-picker mt-sm">
                                        {(isExpense ? expenseCategories : incomeCategories).map(cat => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                className={`category-option ${categoryId === cat.id ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setCategoryId(cat.id!);
                                                    setShowCategoryPicker(false);
                                                }}
                                                title={`Seleziona ${cat.name}`}
                                            >
                                                <span>{cat.icon}</span>
                                                <span className="text-ellipsis">
                                                    {cat.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Details (optional) */}
                            <div className="input-group">
                                <label className="input-label">Dettagli (opzionale)</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Aggiungi note..."
                                    value={details}
                                    onChange={e => setDetails(e.target.value)}
                                />
                            </div>

                            {/* Recurring */}
                            <div className="flex items-center gap-md">
                                <input
                                    type="checkbox"
                                    id="recurring"
                                    checked={isRecurring}
                                    onChange={e => setIsRecurring(e.target.checked)}
                                    className="checkbox-lg"
                                />
                                <label htmlFor="recurring" className="flex items-center gap-sm cursor-pointer">
                                    <Repeat size={16} />
                                    Spesa ricorrente
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Annulla
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Salvataggio...' : (transaction ? 'Aggiorna' : 'Salva')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
