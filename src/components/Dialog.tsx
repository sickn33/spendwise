import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

interface DialogProps {
  children: ReactNode;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Dialog({
  children,
  titleId,
  descriptionId,
  onClose,
  busy = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
  initialFocusRef,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const pointerStartedOnBackdrop = useRef(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const returnTarget = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTarget = initialFocusRef?.current
      ?? dialog.querySelector<HTMLElement>('[data-autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    focusTarget?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      const restoreFocus = () => {
        if (returnTarget?.isConnected) returnTarget.focus();
        else document.getElementById('main-content')?.focus();
      };
      restoreFocus();
      // Chromium can perform its native dialog focus restoration after close().
      // Reassert the captured target once that browser step has completed.
      queueMicrotask(restoreFocus);
    };
  }, [initialFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (!busy && closeOnEscape) onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [busy, closeOnEscape, onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog-shell"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onPointerDown={event => {
        pointerStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onPointerUp={event => {
        const endedOnBackdrop = event.target === event.currentTarget;
        if (pointerStartedOnBackdrop.current && endedOnBackdrop && closeOnBackdrop && !busy) onClose();
        pointerStartedOnBackdrop.current = false;
      }}
    >
      <div className={`app-dialog-panel ${className}`.trim()}>
        {children}
      </div>
    </dialog>
  );
}
