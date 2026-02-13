import { useState, useEffect, useCallback, memo } from 'react';
import { getCategories, addTransaction, updateTransaction } from '../db/database';
import { classifyTransaction, learnFromCorrection } from '../services/classifier';
import type { Category, Transaction } from '../types';
import { X } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionFormProps {
    transaction?: Transaction;
    onClose: () => void;
    onSave: () => void;
}

export const TransactionForm = memo(function TransactionForm({ transaction, onClose, onSave }: TransactionFormProps) {
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
        <div className="fixed inset-0 bg-paper/90 backdrop-blur-sm z-50 flex items-center justify-center p-md" onClick={onClose}>
            <div 
                className="w-full max-w-md bg-paper structural-border shadow-none" 
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-md border-b border-border">
                    <h2 className="text-sm font-mono uppercase tracking-wider">
                        {transaction ? 'MODIFICA_TRANSAZIONE' : 'NUOVA_TRANSAZIONE'}
                    </h2>
                    <button 
                        className="btn btn-ghost btn-icon structural-border border-0" 
                        onClick={onClose}
                        title="Chiudi"
                        aria-label="Chiudi"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-md space-y-md">
                        {/* Transaction Type Toggle */}
                        <div className="grid grid-cols-2 gap-px bg-border border border-border">
                            <button
                                type="button"
                                className={`p-sm text-center font-mono uppercase text-xs tracking-wider transition-colors ${isExpense ? 'bg-ink text-paper' : 'bg-paper text-text hover:bg-concrete'}`}
                                onClick={() => setIsExpense(true)}
                            >
                                USCITA
                            </button>
                            <button
                                type="button"
                                className={`p-sm text-center font-mono uppercase text-xs tracking-wider transition-colors ${!isExpense ? 'bg-ink text-paper' : 'bg-paper text-text hover:bg-concrete'}`}
                                onClick={() => setIsExpense(false)}
                            >
                                ENTRATA
                            </button>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="text-tiny font-mono uppercase text-muted mb-xs block">
                                IMPORTO
                            </label>
                            <div className="relative">
                                <span className="absolute left-sm top-1/2 -translate-y-1/2 font-mono text-lg text-muted/50">€</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full bg-paper border border-border p-sm pl-8 font-mono text-xl focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink placeholder:text-muted/50"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-tiny font-mono uppercase text-muted mb-xs block">
                                DESCRIZIONE
                            </label>
                            <input
                                type="text"
                                className="w-full bg-paper border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink placeholder:text-muted/50"
                                placeholder="es. Spesa Esselunga"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                onBlur={handleDescriptionBlur}
                                required
                            />
                        </div>

                        {/* Date */}
                        <div>
                            <label className="text-tiny font-mono uppercase text-muted mb-xs block">
                                DATA
                            </label>
                            <input
                                type="date"
                                className="w-full bg-paper border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink uppercase"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-tiny font-mono uppercase text-muted mb-xs block">
                                CATEGORIA
                            </label>
                            <button
                                type="button"
                                className={`w-full text-left border border-border p-sm font-mono text-sm flex items-center justify-between ${showCategoryPicker ? 'border-ink ring-1 ring-ink' : ''}`}
                                onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                                title="Seleziona categoria"
                            >
                                {selectedCategory ? (
                                    <span className="flex items-center gap-2">
                                        <span>{selectedCategory.icon}</span>
                                        <span className="uppercase">{selectedCategory.name}</span>
                                    </span>
                                ) : (
                                    <span className="text-muted uppercase">SELEZIONA_CATEGORIA</span>
                                )}
                            </button>

                            {showCategoryPicker && (
                                <div className="mt-xs border border-border max-h-48 overflow-y-auto grid grid-cols-2 gap-px bg-border">
                                    {(isExpense ? expenseCategories : incomeCategories).map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            className={`p-sm text-left bg-paper hover:bg-concrete flex items-center gap-2 transition-colors ${categoryId === cat.id ? 'bg-concrete' : ''}`}
                                            onClick={() => {
                                                setCategoryId(cat.id!);
                                                setShowCategoryPicker(false);
                                            }}
                                            title={`Seleziona ${cat.name}`}
                                        >
                                            <span>{cat.icon}</span>
                                            <span className="font-mono text-xs uppercase truncate">
                                                {cat.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Details (optional) */}
                        <div>
                            <label className="text-tiny font-mono uppercase text-muted mb-xs block">
                                NOTE (OPZIONALE)
                            </label>
                            <input
                                type="text"
                                className="w-full bg-paper border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink placeholder:text-muted"
                                placeholder="..."
                                value={details}
                                onChange={e => setDetails(e.target.value)}
                            />
                        </div>

                        {/* Recurring */}
                        <div className="flex items-center gap-sm pt-xs">
                            <input
                                type="checkbox"
                                id="recurring"
                                checked={isRecurring}
                                onChange={e => setIsRecurring(e.target.checked)}
                                className="w-4 h-4 border-2 border-border text-ink focus:ring-ink rounded-none"
                            />
                            <label htmlFor="recurring" className="font-mono text-xs uppercase cursor-pointer select-none">
                                RICORRENTE
                            </label>
                        </div>
                    </div>

                    <div className="p-md border-t border-border flex justify-end gap-sm bg-concrete/20">
                        <button 
                            type="button" 
                            className="btn btn-secondary text-xs uppercase tracking-wider" 
                            onClick={onClose}
                        >
                            ANNULLA
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary text-xs uppercase tracking-wider" 
                            disabled={saving}
                        >
                            {saving ? 'ELABORAZIONE...' : (transaction ? 'AGGIORNA_DATI' : 'SALVA_DATI')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});
