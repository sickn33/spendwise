import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImportPreviewModal } from './ImportPreviewModal';

describe('ImportPreviewModal', () => {
  it('confirms whether modified rows should be updated', () => {
    const onConfirm = vi.fn();
    render(
      <ImportPreviewModal
        importing={false}
        onCancel={() => {}}
        onConfirm={onConfirm}
        preview={{
          success: true,
          newCount: 1,
          duplicateCount: 1,
          modifiedCount: 1,
          errors: [],
          items: [
            { date: new Date(2026, 0, 1), description: 'New row', details: '', amount: -10, currency: 'EUR', account: '', categoryId: 1, status: 'new' },
            { date: new Date(2026, 0, 2), description: 'Changed row', details: '', amount: -20, currency: 'EUR', account: '', categoryId: 1, status: 'modified', existingId: 7 },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('dialog', { name: 'Import Preview' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /import 1 new and update 1 existing/i }));

    expect(onConfirm).toHaveBeenCalledWith(true);
    expect(screen.getByText('Changed row')).toBeInTheDocument();
  });

  it('disables modified-only imports until updates are explicitly enabled', () => {
    const onConfirm = vi.fn();
    render(
      <ImportPreviewModal
        importing={false}
        onCancel={() => {}}
        onConfirm={onConfirm}
        preview={{
          success: true,
          newCount: 0,
          duplicateCount: 0,
          modifiedCount: 1,
          errors: [],
          items: [
            { date: new Date(2026, 0, 2), description: 'Changed row', details: '', amount: 20, currency: 'EUR', account: '', categoryId: 1, status: 'modified', existingId: 7 },
          ],
        }}
      />
    );

    const button = screen.getByRole('button', { name: /enable update for 1 existing/i });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    const enabledButton = screen.getByRole('button', { name: /update 1 existing/i });
    expect(enabledButton).toBeEnabled();
    fireEvent.click(enabledButton);
    expect(onConfirm).toHaveBeenCalledWith(true);
    expect(screen.getByText('+20.00 €')).toBeInTheDocument();
  });
});
