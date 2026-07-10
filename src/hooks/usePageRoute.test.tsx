import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hrefForPage, usePageRoute } from './usePageRoute';

describe('usePageRoute', () => {
  beforeEach(() => window.history.replaceState({}, '', '/spendwise/'));

  it('loads deep links, navigates with history, and follows back/forward state', () => {
    window.history.replaceState({}, '', '/spendwise/?page=settings');
    const { result } = renderHook(() => usePageRoute());
    expect(result.current.currentPage).toBe('settings');

    act(() => result.current.navigate('reports'));
    expect(result.current.currentPage).toBe('reports');
    expect(window.location.search).toBe('?page=reports');

    act(() => {
      window.history.replaceState({}, '', '/spendwise/?page=budgets');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.currentPage).toBe('budgets');
  });

  it('canonicalizes unknown pages and keeps dashboard at the base URL', () => {
    window.history.replaceState({}, '', '/spendwise/?page=unknown');
    const { result } = renderHook(() => usePageRoute());
    expect(result.current.currentPage).toBe('dashboard');
    expect(window.location.search).toBe('');
    expect(hrefForPage('dashboard')).toBe('/spendwise/');
  });
});
