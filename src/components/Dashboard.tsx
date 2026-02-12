import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { getCategories, getTransactions } from '../db/database';
import { getMonthlyStats, getCategoryBreakdown, getDailyAverageSpending } from '../services/analytics';
import type { Transaction, Category, MonthlyStats, ChartDataPoint } from '../types';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, eachMonthOfInterval, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { TrendingUp, TrendingDown, CreditCard, PiggyBank, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

interface DashboardProps {
    onAddTransaction: () => void;
}

export const Dashboard = memo(function Dashboard({ onAddTransaction }: DashboardProps) {
    const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
    const [lastMonthStats, setLastMonthStats] = useState<MonthlyStats | null>(null);
    const [categoryBreakdown, setCategoryBreakdown] = useState<ChartDataPoint[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [dailyAverage, setDailyAverage] = useState<number>(0);
    const [trendData, setTrendData] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
    const [loading, setLoading] = useState(true);

    const loadDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const startOfSelectedMonth = startOfMonth(selectedMonth);
            const endOfSelectedMonth = endOfMonth(selectedMonth);
            const previousMonth = subMonths(selectedMonth, 1);
            const months = eachMonthOfInterval({
                start: subMonths(selectedMonth, 5),
                end: selectedMonth
            });

            // Load all data in parallel
            const [
                currentStats,
                prevStats,
                breakdown,
                cats,
                avgDaily,
                monthTransactions,
                trendStats
            ] = await Promise.all([
                getMonthlyStats(selectedMonth),
                getMonthlyStats(previousMonth),
                getCategoryBreakdown(startOfSelectedMonth, endOfSelectedMonth),
                getCategories(),
                getDailyAverageSpending(),
                getTransactions({
                    dateFrom: startOfSelectedMonth,
                    dateTo: endOfSelectedMonth
                }),
                Promise.all(months.map(month => getMonthlyStats(month)))
            ]);

            setMonthlyStats(currentStats);
            setLastMonthStats(prevStats);
            setCategoryBreakdown(breakdown);
            setRecentTransactions(monthTransactions);
            setCategories(cats);
            setDailyAverage(avgDaily);
            setTrendData({
                labels: months.map(month => format(month, 'MMM', { locale: it })),
                values: trendStats.map(stats => stats.totalExpenses)
            });
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const goToPreviousMonth = useCallback(() => {
        setSelectedMonth(prev => subMonths(prev, 1));
    }, []);

    const goToNextMonth = useCallback(() => {
        setSelectedMonth(prev => {
            const next = addMonths(prev, 1);
            if (!isAfter(startOfMonth(next), startOfMonth(new Date()))) {
                return next;
            }
            return prev;
        });
    }, []);

    const goToCurrentMonth = useCallback(() => {
        setSelectedMonth(new Date());
    }, []);

    const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

    const categoryMap = useMemo(
        () => new Map(categories.map(c => [c.id!, c])),
        [categories]
    );

    const expenseChange = monthlyStats && lastMonthStats && lastMonthStats.totalExpenses > 0
        ? ((monthlyStats.totalExpenses - lastMonthStats.totalExpenses) / lastMonthStats.totalExpenses * 100)
        : 0;

    const incomeChange = monthlyStats && lastMonthStats && lastMonthStats.totalIncome > 0
        ? ((monthlyStats.totalIncome - lastMonthStats.totalIncome) / lastMonthStats.totalIncome * 100)
        : 0;

    const doughnutData = useMemo(() => ({
        labels: categoryBreakdown.slice(0, 6).map(c => c.label),
        datasets: [{
            data: categoryBreakdown.slice(0, 6).map(c => c.value),
            backgroundColor: categoryBreakdown.slice(0, 6).map(c => c.color),
            borderColor: 'transparent',
            borderWidth: 0,
            hoverOffset: 10
        }]
    }), [categoryBreakdown]);

    const lineData = useMemo(() => ({
        labels: trendData.labels,
        datasets: [{
            label: 'Spese',
            data: trendData.values,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#6366f1'
        }]
    }), [trendData]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: {
                display: false
            }
        }
    }), []);

    const lineOptions = useMemo(() => ({
        ...chartOptions,
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#a0a0b0' }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: '#a0a0b0',
                    callback: (value: number) => `€${value}`
                }
            }
        }
    }), [chartOptions]);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    {/* Month Navigator */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                        marginTop: 'var(--space-sm)'
                    }}>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={goToPreviousMonth}
                            style={{ width: 32, height: 32 }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span style={{
                            fontSize: '1.1rem',
                            fontWeight: 500,
                            minWidth: '150px',
                            textAlign: 'center',
                            textTransform: 'capitalize'
                        }}>
                            {format(selectedMonth, 'MMMM yyyy', { locale: it })}
                        </span>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth}
                            style={{
                                width: 32,
                                height: 32,
                                opacity: isCurrentMonth ? 0.3 : 1,
                                cursor: isCurrentMonth ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <ChevronRight size={20} />
                        </button>
                        {!isCurrentMonth && (
                            <button
                                className="btn btn-secondary"
                                onClick={goToCurrentMonth}
                                style={{ marginLeft: 'var(--space-sm)', fontSize: '0.85rem', padding: 'var(--space-xs) var(--space-sm)' }}
                            >
                                Oggi
                            </button>
                        )}
                    </div>
                </div>
                <button className="btn btn-primary" onClick={onAddTransaction}>
                    + Nuova Spesa
                </button>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingDown size={16} />
                        Spese {isCurrentMonth ? 'del mese' : ''}
                    </div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>
                        €{monthlyStats?.totalExpenses.toFixed(2) || '0.00'}
                    </div>
                    <div className={`stat-change ${expenseChange > 0 ? 'negative' : 'positive'}`}>
                        {expenseChange > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(expenseChange).toFixed(1)}% vs mese precedente
                    </div>
                </div>

                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingUp size={16} />
                        Entrate {isCurrentMonth ? 'del mese' : ''}
                    </div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                        €{monthlyStats?.totalIncome.toFixed(2) || '0.00'}
                    </div>
                    <div className={`stat-change ${incomeChange >= 0 ? 'positive' : 'negative'}`}>
                        {incomeChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(incomeChange).toFixed(1)}% vs mese precedente
                    </div>
                </div>

                <div className="card stat-card">
                    <div className="stat-label">
                        <PiggyBank size={16} />
                        Bilancio
                    </div>
                    <div className="stat-value" style={{
                        color: (monthlyStats?.totalIncome || 0) - (monthlyStats?.totalExpenses || 0) >= 0
                            ? 'var(--success)'
                            : 'var(--danger)'
                    }}>
                        €{((monthlyStats?.totalIncome || 0) - (monthlyStats?.totalExpenses || 0)).toFixed(2)}
                    </div>
                    <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
                        {monthlyStats?.transactionCount || 0} transazioni
                    </div>
                </div>

                <div className="card stat-card">
                    <div className="stat-label">
                        <CreditCard size={16} />
                        Media giornaliera
                    </div>
                    <div className="stat-value">
                        €{dailyAverage.toFixed(2)}
                    </div>
                    <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
                        ultimi 30 giorni
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Spese per categoria</h3>
                    </div>
                    <div className="chart-container" style={{ height: '280px' }}>
                        {categoryBreakdown.length > 0 ? (
                            <Doughnut data={doughnutData} options={chartOptions} />
                        ) : (
                            <div className="empty-state">
                                <p>Nessuna spesa in questo mese</p>
                            </div>
                        )}
                    </div>
                    {categoryBreakdown.length > 0 && (
                        <div style={{ marginTop: 'var(--space-md)' }}>
                            {categoryBreakdown.slice(0, 4).map((cat, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: 'var(--space-sm) 0',
                                    borderBottom: i < 3 ? '1px solid var(--border)' : 'none'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                        <div style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            background: cat.color
                                        }} />
                                        <span style={{ fontSize: '0.9rem' }}>{cat.label}</span>
                                    </div>
                                    <span style={{ fontWeight: 600, fontFeatureSettings: 'tnum' }}>
                                        €{cat.value.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Trend spese (6 mesi)</h3>
                    </div>
                    <div className="chart-container" style={{ height: '280px' }}>
                        <Line data={lineData} options={lineOptions as never} />
                    </div>
                </div>
            </div>

            {/* All Transactions for selected month */}
            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        {isCurrentMonth
                            ? `Transazioni di questo mese`
                            : `Transazioni di ${format(selectedMonth, 'MMMM yyyy', { locale: it })}`}
                    </h3>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {recentTransactions.length} transazioni
                    </span>
                </div>
                <div className="transaction-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {recentTransactions.length > 0 ? (
                        recentTransactions.map(t => {
                            const category = categoryMap.get(t.categoryId);
                            return (
                                <div key={t.id} className="transaction-item">
                                    <div
                                        className="transaction-icon"
                                        style={{ background: category?.color ? `${category.color}20` : 'var(--bg-tertiary)' }}
                                    >
                                        {category?.icon || '📦'}
                                    </div>
                                    <div className="transaction-info">
                                        <div className="transaction-description">{t.description}</div>
                                        <div className="transaction-meta">
                                            {format(new Date(t.date), 'd MMM', { locale: it })} • {category?.name}
                                        </div>
                                    </div>
                                    <div className={`transaction-amount ${t.amount < 0 ? 'expense' : 'income'}`}>
                                        {t.amount < 0 ? '-' : '+'}€{Math.abs(t.amount).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📝</div>
                            <div className="empty-state-title">Nessuna transazione</div>
                            <p>{isCurrentMonth ? 'Inizia ad aggiungere le tue spese' : 'Nessuna transazione in questo mese'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
