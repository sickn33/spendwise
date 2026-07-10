import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function Harness({ busy = false, onClose = vi.fn() }: { busy?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const initialFocus = createRef<HTMLInputElement>();
  return <>
    <button onClick={() => setOpen(true)}>Open dialog</button>
    {open && <Dialog
      titleId="test-dialog-title"
      onClose={() => { onClose(); setOpen(false); }}
      busy={busy}
      initialFocusRef={initialFocus}
    >
      <h2 id="test-dialog-title">Test dialog</h2>
      <input ref={initialFocus} aria-label="First field" />
      <button>Last action</button>
    </Dialog>}
  </>;
}

describe('Dialog', () => {
  it('opens a named modal, focuses its requested field, and restores trigger focus', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'First field' })).toHaveFocus();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('blocks Escape and backdrop dismissal while busy', () => {
    const onClose = vi.fn();
    render(<Harness busy onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.pointerDown(dialog);
    fireEvent.pointerUp(dialog);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute('aria-busy', 'true');
  });
});
