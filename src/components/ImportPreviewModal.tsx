import { useState } from 'react';
import type { ImportPreviewResult, ImportPreviewItem } from '../services/importer';
import { X, Check, AlertTriangle, Copy, RefreshCw } from 'lucide-react';

interface ImportPreviewModalProps {
    preview: ImportPreviewResult;
    onConfirm: (updateExisting: boolean) => void;
    onCancel: () => void;
    importing: boolean;
}

export function ImportPreviewModal({ preview, onConfirm, onCancel, importing }: ImportPreviewModalProps) {
    const [updateExisting, setUpdateExisting] = useState(false);

    const getStatusIcon = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return <Check size={16} className="text-success" />;
            case 'duplicate': return <Copy size={16} className="text-muted" />;
            case 'modified': return <AlertTriangle size={16} className="text-warning" />;
        }
    };

    const getStatusLabel = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return 'New';
            case 'duplicate': return 'Duplicate';
            case 'modified': return 'Updated';
        }
    };

    const getStatusBgClass = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return 'bg-success-light';
            case 'duplicate': return 'bg-glass';
            case 'modified': return 'bg-warning-light';
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal max-w-700 max-h-80vh" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                    <h2 className="modal-title">Import Preview</h2>
                    <button 
                        className="btn-icon" 
                        onClick={onCancel}
                        title="Close"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Summary */}
                <div className="flex gap-lg mb-lg flex-wrap">
                    <div className="summary-box bg-success-light">
                        <div className="font-xl font-semibold text-success">
                            {preview.newCount}
                        </div>
                        <div className="font-sm text-muted">New</div>
                    </div>
                    <div className="summary-box bg-glass">
                        <div className="font-xl font-semibold text-muted">
                            {preview.duplicateCount}
                        </div>
                        <div className="font-sm text-muted">Duplicate</div>
                    </div>
                    <div className="summary-box bg-warning-light">
                        <div className="font-xl font-semibold text-warning">
                            {preview.modifiedCount}
                        </div>
                        <div className="font-sm text-muted">Updated</div>
                    </div>
                </div>

                {/* Update existing option */}
                {preview.modifiedCount > 0 && (
                    <label className="flex items-center gap-sm p-md bg-warning-light border-radius-md mb-lg cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="checkbox-lg"
                            checked={updateExisting} 
                            onChange={e => setUpdateExisting(e.target.checked)}
                        />
                        <RefreshCw size={16} className="text-warning" />
                        <span>Update modified transactions ({preview.modifiedCount})</span>
                    </label>
                )}

                {/* Transaction list */}
                <div className="h-300-scroll mb-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="p-sm text-left">Status</th>
                                <th className="p-sm text-left">Date</th>
                                <th className="p-sm text-left">Description</th>
                                <th className="p-sm text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.items.slice(0, 50).map((item, idx) => (
                                <tr key={idx} className={`border-b ${item.status === 'duplicate' ? 'text-muted' : ''}`}>
                                    <td className="p-sm">
                                        <span className={`inline-flex items-center gap-xs px-sm py-xs border-radius-sm font-xs ${getStatusBgClass(item.status)}`}>
                                            {getStatusIcon(item.status)}
                                            {getStatusLabel(item.status)}
                                        </span>
                                    </td>
                                    <td className="p-sm font-sm">
                                        {item.date.toLocaleDateString('en-US')}
                                    </td>
                                    <td className="p-sm font-sm text-ellipsis max-w-200">
                                        {item.description}
                                    </td>
                                    <td className={`p-sm text-right font-medium ${item.amount > 0 ? 'text-success' : 'text-danger'}`}>
                                        {item.amount > 0 ? '+' : ''}{item.amount.toFixed(2)} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {preview.items.length > 50 && (
                        <p className="text-muted text-center mt-md">
                            ...and {preview.items.length - 50} more transactions
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-md justify-end">
                    <button className="btn btn-secondary" onClick={onCancel} disabled={importing}>
                        Cancel
                    </button>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => onConfirm(updateExisting)}
                        disabled={importing || preview.newCount === 0 && (!updateExisting || preview.modifiedCount === 0)}
                    >
                        {importing ? 'Importing...' : `Import ${preview.newCount} transactions`}
                    </button>
                </div>
            </div>
        </div>
    );
}
