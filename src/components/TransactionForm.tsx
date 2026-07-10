import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { getCategories, addTransaction, updateTransaction } from '../db/database';
import { classifyTransaction, learnFromCorrection } from '../services/classifier';
import type { Category, Transaction } from '../types';
import { X } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { Dialog } from './Dialog';

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
    const [formError, setFormError] = useState('');
    const amountInputRef = useRef<HTMLInputElement>(null);

    const loadCategories = useCallback(async () => {
        const cats = await getCategories();
        setCategories(cats);

        // Set default category if not editing
        if (!transaction) {
            const defaultCat = cats.find(c => c.name === 'Other expenses');
            if (defaultCat?.id) setCategoryId(current => current ?? defaultCat.id!);
        }
    }, [transaction]);

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

    function handleTypeChange(expense: boolean) {
        setIsExpense(expense);
        const selectedIsCompatible = categories.some(
            category => category.id === categoryId && category.isIncome === !expense
        );
        if (!selectedIsCompatible) {
            const fallback = categories.find(category => category.isIncome === !expense);
            setCategoryId(fallback?.id ?? null);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const normalizedAmount = amount.trim().replace(',', '.');
        const parsedAmount = Number(normalizedAmount);
        const parsedDate = parseISO(date);
        if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setFormError('Enter an amount greater than zero with at most two decimal places.');
            return;
        }
        if (!description.trim() || !categoryId) {
            setFormError('Description and category are required.');
            return;
        }
        if (!isValid(parsedDate)) {
            setFormError('Enter a valid transaction date.');
            return;
        }

        setSaving(true);
        setFormError('');
        try {
            const finalAmount = isExpense ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

            if (transaction?.id) {
                await updateTransaction(transaction.id, {
                    amount: finalAmount,
                    description: description.trim(),
                    details,
                    date: parsedDate,
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
                    description: description.trim(),
                    details,
                    date: parsedDate,
                    categoryId,
                    currency: 'EUR',
                    account: '',
                    isContabilized: true,
                    isRecurring,
                    tags: []
                });
                learnFromCorrection(description.trim(), categoryId);
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving transaction:', error);
            setFormError('The transaction could not be saved. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    const selectedCategory = categories.find(c => c.id === categoryId);
    const expenseCategories = categories.filter(c => !c.isIncome);
    const incomeCategories = categories.filter(c => c.isIncome);

    return (
        <Dialog titleId="transaction-dialog-title" onClose={onClose} busy={saving} initialFocusRef={amountInputRef} className="max-w-[28rem] bg-paper structural-border shadow-none">
                {/* Header */}
                <div className="flex items-center justify-between p-md border-b border-border">
                    <h2 id="transaction-dialog-title" className="text-sm font-mono uppercase tracking-wider">
                        {transaction ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}
                    </h2>
                    <button 
                        className="btn btn-ghost btn-icon structural-border border-0" 
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
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
                                onClick={() => handleTypeChange(true)}
                                aria-pressed={isExpense}
                            >
                                Expense
                            </button>
                            <button
                                type="button"
                                className={`p-sm text-center font-mono uppercase text-xs tracking-wider transition-colors ${!isExpense ? 'bg-ink text-paper' : 'bg-paper text-text hover:bg-concrete'}`}
                                onClick={() => handleTypeChange(false)}
                                aria-pressed={!isExpense}
                            >
                                Income
                            </button>
                        </div>

                        {/* Amount */}
                        <div>
                            <label htmlFor="transaction-amount" className="text-tiny font-mono uppercase text-muted mb-xs block">
                                Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-sm top-1/2 -translate-y-1/2 font-mono text-lg text-muted/50">€</span>
                                <input
                                    ref={amountInputRef}
                                    type="text"
                                    id="transaction-amount"
                                    inputMode="decimal"
                                    className="w-full bg-paper text-ink border border-border p-sm pl-8 font-mono text-xl focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink placeholder:text-muted/50"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    required
                                    aria-invalid={formError ? true : undefined}
                                    aria-describedby={formError ? 'transaction-form-error' : undefined}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="transaction-description" className="text-tiny font-mono uppercase text-muted mb-xs block">
                                Description
                            </label>
                            <input
                                type="text"
                                id="transaction-description"
                                className="w-full bg-paper text-ink border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink placeholder:text-muted/50"
                                placeholder="e.g. Grocery shopping"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                onBlur={handleDescriptionBlur}
                                required
                            />
                        </div>

                        {/* Date */}
                        <div>
                            <label htmlFor="transaction-date" className="text-tiny font-mono uppercase text-muted mb-xs block">
                                Date
                            </label>
                            <input
                                type="date"
                                id="transaction-date"
                                className="w-full bg-paper text-ink border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink uppercase"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <span id="transaction-category-label" className="text-tiny font-mono uppercase text-muted mb-xs block">
                                Category
                            </span>
                            <button
                                type="button"
                                className={`w-full text-left bg-paper text-ink border border-border p-sm font-mono text-sm flex items-center justify-between ${showCategoryPicker ? 'border-ink ring-1 ring-ink' : ''}`}
                                onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                                title="Select category"
                                aria-labelledby="transaction-category-label"
                                aria-haspopup="listbox"
                                aria-expanded={showCategoryPicker}
                                aria-controls="transaction-category-options"
                            >
                                    {selectedCategory ? (
                                        <span className="flex items-center gap-2">
                                            <span>{selectedCategory.icon}</span>
                                            <span className="uppercase">{selectedCategory.name}</span>
                                        </span>
                                    ) : (
                                        <span className="text-muted uppercase">SELECT CATEGORY</span>
                                    )}
                                </button>

                            {showCategoryPicker && (
                                <div id="transaction-category-options" role="listbox" className="mt-xs border border-border max-h-48 overflow-y-auto grid grid-cols-2 gap-px bg-border">
                                    {(isExpense ? expenseCategories : incomeCategories).map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            className={`p-sm text-left bg-paper text-ink hover:bg-concrete flex items-center gap-2 transition-colors ${categoryId === cat.id ? 'bg-concrete' : ''}`}
                                            onClick={() => {
                                                setCategoryId(cat.id!);
                                                setShowCategoryPicker(false);
                                            }}
                                            title={`Select ${cat.name}`}
                                            role="option"
                                            aria-selected={categoryId === cat.id}
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
                            <label htmlFor="transaction-notes" className="text-tiny font-mono uppercase text-muted mb-xs block">
                                NOTES (OPTIONAL)
                            </label>
                            <input
                                type="text"
                                id="transaction-notes"
                                className="w-full bg-paper text-ink border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink placeholder:text-muted"
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
                                className="w-6 h-6 border-2 border-border text-ink focus:ring-ink rounded-none"
                            />
                            <label htmlFor="recurring" className="font-mono text-xs uppercase cursor-pointer select-none">
                                RECURRING
                            </label>
                        </div>

                        {formError && (
                            <p id="transaction-form-error" role="alert" className="text-xs text-danger font-mono">
                                {formError}
                            </p>
                        )}
                    </div>

                    <div className="p-md border-t border-border flex justify-end gap-sm bg-concrete/20">
                        <button 
                            type="button" 
                            className="btn btn-secondary text-xs uppercase tracking-wider" 
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary text-xs uppercase tracking-wider" 
                            disabled={saving}
                        >
                            {saving ? 'Processing...' : (transaction ? 'UPDATE' : 'SAVE')}
                        </button>
                    </div>
                </form>
        </Dialog>
    );
});
