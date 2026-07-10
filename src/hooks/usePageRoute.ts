import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '../components/Sidebar';

export const PAGES: readonly Page[] = ['dashboard', 'transactions', 'budgets', 'savings', 'reports', 'comparison', 'categories', 'settings'];
const PAGE_SET = new Set<Page>(PAGES);

function pageFromLocation(): Page {
  const candidate = new URL(window.location.href).searchParams.get('page');
  return candidate && PAGE_SET.has(candidate as Page) ? candidate as Page : 'dashboard';
}

export function hrefForPage(page: Page): string {
  const url = new URL(window.location.href);
  if (page === 'dashboard') url.searchParams.delete('page');
  else url.searchParams.set('page', page);
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

export function usePageRoute() {
  const [currentPage, setCurrentPage] = useState<Page>(() => pageFromLocation());
  const firstRender = useRef(true);

  const navigate = useCallback((page: Page, mode: 'push' | 'replace' = 'push') => {
    const href = hrefForPage(page);
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({ page }, '', href);
    setCurrentPage(page);
  }, []);

  useEffect(() => {
    const candidate = new URL(window.location.href).searchParams.get('page');
    if (candidate && !PAGE_SET.has(candidate as Page)) {
      window.history.replaceState({ page: 'dashboard' }, '', hrefForPage('dashboard'));
    }
    const handlePopState = () => setCurrentPage(pageFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  useEffect(() => {
    document.title = currentPage === 'dashboard'
      ? 'SpendWise — Dashboard'
      : `SpendWise — ${currentPage[0].toUpperCase()}${currentPage.slice(1)}`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('main-content')?.focus();
  }, [currentPage]);

  return { currentPage, navigate, hrefFor: hrefForPage };
}
