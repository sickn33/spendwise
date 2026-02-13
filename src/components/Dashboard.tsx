import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { getCategories, getTransactions } from '../db/database';
import { getMonthlyStats, getCategoryBreakdown, getDailyAverageSpending } from '../services/analytics';
import type { Transaction, Category, MonthlyStats, ChartDataPoint } from '../types';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, eachMonthOfInterval, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { TrendingUp, TrendingDown, CreditCard, PiggyBank, ChevronLeft, ChevronRight } from 'lucide-react';

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
            <div className="page-header border-b pb-xl mb-2xl">
                <div>
                    <h1 className="font-display">Pannello_Controllo_v1</h1>
                    {/* Month Navigator */}
                    <div className="month-nav mt-md">
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={goToPreviousMonth}
                            title="Mese precedente"
                            aria-label="Mese precedente"
                        >
                            <ChevronLeft size={18} strokeWidth={2.5} />
                        </button>
                        <span className="month-nav-label">
                            {format(selectedMonth, 'yyyy_MMMM', { locale: it })}
                        </span>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth}
                            title="Mese successivo"
                            aria-label="Mese successivo"
                        >
                            <ChevronRight size={18} strokeWidth={2.5} />
                        </button>
                        {!isCurrentMonth && (
                            <button
                                className="btn btn-secondary system-reset-btn"
                                onClick={goToCurrentMonth}
                            >
                                RESET_TO_CURRENT
                            </button>
                        )}
                    </div>
                </div>
                <button className="btn btn-primary" onClick={onAddTransaction}>
                    AGGIUNGI_RECORD
                </button>
            </div>

            {/* Stats Grid -> Data Ledger Style */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">
                        <TrendingDown size={14} strokeWidth={2.5} /> SPESE_MENSILI
                    </div>
                    <div className="stat-value font-mono">
                        €{monthlyStats?.totalExpenses.toFixed(2) || '0.00'}
                    </div>
                    <div className={`stat-change font-mono ${expenseChange > 0 ? 'text-danger' : 'text-success'}`}>
                        {expenseChange > 0 ? '▲' : '▼'} {Math.abs(expenseChange).toFixed(1)}% VS_PREC
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">
                        <TrendingUp size={14} strokeWidth={2.5} /> ENTRATE_MENSILI
                    </div>
                    <div className="stat-value font-mono">
                        €{monthlyStats?.totalIncome.toFixed(2) || '0.00'}
                    </div>
                    <div className={`stat-change font-mono ${incomeChange >= 0 ? 'text-success' : 'text-danger'}`}>
                        {incomeChange >= 0 ? '▲' : '▼'} {Math.abs(incomeChange).toFixed(1)}% VS_PREC
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">
                        <PiggyBank size={14} strokeWidth={2.5} /> BILANCIO_NETTO
                    </div>
                    <div className={`stat-value font-mono ${((monthlyStats?.totalIncome || 0) - (monthlyStats?.totalExpenses || 0)) >= 0 ? 'text-success' : 'text-danger'}`}>
                        €{((monthlyStats?.totalIncome || 0) - (monthlyStats?.totalExpenses || 0)).toFixed(2)}
                    </div>
                    <div className="stat-change font-mono text-muted">
                        {monthlyStats?.transactionCount || 0} RECORDS_FOUND
                    </div>
                </div>

                <div className="stat-card border-none-right">
                    <div className="stat-label">
                        <CreditCard size={14} strokeWidth={2.5} /> MEDIA_DIARIA
                    </div>
                    <div className="stat-value font-mono">
                        €{dailyAverage.toFixed(2)}
                    </div>
                    <div className="stat-change font-mono text-muted">
                        RANGE: 30_DAYS
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid-2">
                <div className="card">
                    <div className="card-header border-b pb-sm mb-xl">
                        <h2 className="font-display text-lg">DISTRIBUZIONE_CATEGORIA_v1</h2>
                    </div>
                    <div className="chart-center-container">
                        {categoryBreakdown.length > 0 ? (
                            <Doughnut 
                                data={{
                                    labels: categoryBreakdown.map(c => c.label),
                                    datasets: [{
                                        data: categoryBreakdown.map(c => c.value),
                                        backgroundColor: ['#0A1F3D', '#D1D1D1', '#0F0F0F', '#F5F5F0', '#008F39', '#E30613'],
                                        borderWidth: 1,
                                        borderColor: '#0F0F0F'
                                    }]
                                }} 
                                options={{
                                    cutout: '70%',
                                    plugins: { legend: { display: false } },
                                    animation: { duration: 0 }
                                }} 
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full font-mono text-muted">NO_DATA</div>
                        )}
                    </div>
                    {categoryBreakdown.length > 0 && (
                        <div className="mt-xl">
                            {categoryBreakdown.map((cat, i) => (
                                <div key={i} className="ledger-row font-mono">
                                    <div className="flex items-center gap-sm">
                                        <div className="color-indicator" style={{ background: cat.color }} />
                                        <span>{cat.label.toUpperCase()}</span>
                                    </div>
                                    <span>€{cat.value.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Trend Forecast Chart */}
                <div className="card">
                    <div className="card-header border-b pb-sm mb-xl">
                        <h2 className="font-display text-lg">TREND_TEMPORALE_6M</h2>
                    </div>
                    <div className="chart-container" style={{ height: '260px' }}>
                        <Line data={lineData} options={{
                            ...lineOptions,
                            plugins: { legend: { display: false } },
                            scales: {
                                ...lineOptions.scales,
                                x: { ...lineOptions.scales.x, grid: { display: false } },
                                y: { ...lineOptions.scales.y, grid: { color: '#D1D1D1' } }
                            },
                            animation: { duration: 0 }
                        } as never} />
                    </div>
                    <div className="mt-xl font-mono text-muted text-right text-xs">
                        DATA_SOURCE: LOCAL_SQL_LEDGER
                    </div>
                </div>
            </div>

            {/* Transaction Ledger */}
            <div className="card mt-2xl">
                <div className="card-header border-b pb-sm mb-xl">
                    <h2 className="font-display text-lg">
                        {isCurrentMonth
                            ? `REGISTRO_TRANSAZIONI_CORRENTE`
                            : `ARCHIVIO_TRANSAZIONI_${format(selectedMonth, 'yyyy_MM').toUpperCase()}`}
                    </h2>
                    <span className="font-mono text-muted text-sm">
                        {recentTransactions.length} RECORDS_COMMIT
                    </span>
                </div>
                <div className="transaction-list">
                    {recentTransactions.length > 0 ? (
                        recentTransactions.map(t => {
                            const category = categoryMap.get(t.categoryId);
                            return (
                                <div key={t.id} className="transaction-item">
                                    <div className="transaction-icon">
                                        {category?.icon || '📦'}
                                    </div>
                                    <div className="transaction-info">
                                        <div className="transaction-description">{t.description}</div>
                                        <div className="transaction-meta">
                                            {format(new Date(t.date), 'yyyy-MM-dd')} | {category?.name.toUpperCase()}
                                        </div>
                                    </div>
                                    <div className={`transaction-amount font-mono ${t.amount < 0 ? 'text-danger' : 'text-success'}`}>
                                        {t.amount < 0 ? '-' : '+'}€{Math.abs(t.amount).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-2xl text-center font-mono text-muted">
                            NULL_SET: NO_TRANSACTIONS_FOUND
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
