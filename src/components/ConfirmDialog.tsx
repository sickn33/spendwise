import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
}

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, busy = false, danger = false }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <Dialog titleId="confirm-dialog-title" descriptionId="confirm-dialog-description" onClose={onCancel} busy={busy} closeOnBackdrop={false} className="max-w-[28rem] bg-paper structural-border">
      <div className="p-lg space-y-md">
        <h2 id="confirm-dialog-title" className="font-display text-lg">{title}</h2>
        <p id="confirm-dialog-description" className="text-sm text-muted">{description}</p>
        <div className="flex justify-end gap-sm pt-md border-t border-border">
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
