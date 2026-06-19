import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { getMonthlyComparison } from '../services/comparison';
import type { MonthlyComparisonData, CategoryComparison } from '../types';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
} from 'chart.js';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    Minus,
    Download,
    Zap,
    Target,
    ArrowUp,
    ArrowDown,
    Sparkles,
    Calendar
} from 'lucide-react';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
ChartJS.defaults.animation = false;

export const MonthComparison = memo(function MonthComparison() {
    const [data, setData] = useState<MonthlyComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [generating, setGenerating] = useState(false);

    const loadComparison = useCallback(async () => {
        setLoading(true);
        try {
            const comparison = await getMonthlyComparison(selectedMonth);
            setData(comparison);
        } catch (error) {
            console.error('Error loading comparison:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadComparison();
    }, [loadComparison]);

    const goToPreviousMonth = useCallback(() => {
        setSelectedMonth(prev => subMonths(prev, 1));
    }, []);

    const goToNextMonth = useCallback(() => {
        setSelectedMonth(prev => {
            const next = addMonths(prev, 1);
            return next <= new Date() ? next : prev;
        });
    }, []);

    const goToCurrentMonth = useCallback(() => {
        setSelectedMonth(new Date());
    }, []);

    function getTrendIcon(trend: 'up' | 'down' | 'stable', isExpense: boolean = false) {
        if (trend === 'up') {
            return <TrendingUp size={16} className={isExpense ? 'text-danger' : 'text-success'} />;
        } else if (trend === 'down') {
            return <TrendingDown size={16} className={isExpense ? 'text-success' : 'text-danger'} />;
        }
        return <Minus size={16} className="text-muted" />;
    }

    function getTrendClass(trend: 'up' | 'down' | 'stable', isExpense: boolean = false): string {
        if (trend === 'up') {
            return isExpense ? 'negative' : 'positive';
        } else if (trend === 'down') {
            return isExpense ? 'positive' : 'negative';
        }
        return 'neutral';
    }

    function formatCurrency(amount: number): string {
        return `€${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    }

    function formatPercent(value: number): string {
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    }

    function getCategoryTrendBadge(cat: CategoryComparison) {
        const badges: Record<string, { label: string; class: string }> = {
            increased: { label: '📈', class: 'badge-warning' },
            decreased: { label: '📉', class: 'badge-success' },
            new: { label: '🆕', class: 'badge-info' },
            removed: { label: '❌', class: 'badge-muted' },
            stable: { label: '→', class: 'badge-neutral' }
        };
        return badges[cat.trend] || badges.stable;
    }

    const generatePDF = useCallback(async () => {
        if (!data) return;
        setGenerating(true);

        try {
            const jsPDF = (await import('jspdf')).default;
            const pdf = new jsPDF();
            const margin = 20;
            let y = margin;

            // Title
            pdf.setFontSize(20);
            pdf.setTextColor(99, 102, 241);
            pdf.text('SpendWise - Monthly Comparison', margin, y);
            y += 12;

            // Months
            pdf.setFontSize(12);
            pdf.setTextColor(100, 100, 100);
            pdf.text(
                `${format(subMonths(selectedMonth, 1), 'MMMM yyyy', { locale: enUS })} vs ${format(selectedMonth, 'MMMM yyyy', { locale: enUS })}`,
                margin, y
            );
            y += 20;

            // Summary
            pdf.setFontSize(14);
            pdf.setTextColor(30, 30, 30);
            pdf.text('Change summary', margin, y);
            y += 10;

            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60);

            const deltas = [
                { label: 'Income', value: data.deltas.income },
                { label: 'Expenses', value: data.deltas.expenses },
                { label: 'Budget', value: data.deltas.netChange }
            ];

            for (const d of deltas) {
                const sign = d.value.amount >= 0 ? '+' : '';
                pdf.text(
                    `${d.label}: ${sign}€${d.value.amount.toFixed(2)} (${formatPercent(d.value.percentage)})`,
                    margin, y
                );
                y += 7;
            }
            y += 10;

            // Category comparison
            pdf.setFontSize(14);
            pdf.setTextColor(30, 30, 30);
            pdf.text('Category comparison', margin, y);
            y += 10;

            pdf.setFontSize(9);
            for (const cat of data.categoryComparison.slice(0, 15)) {
                const sign = cat.delta.amount >= 0 ? '+' : '';
                pdf.text(
                    `${cat.category.name}: €${cat.current.amount.toFixed(0)} (${sign}€${cat.delta.amount.toFixed(0)}, ${formatPercent(cat.delta.percentage)})`,
                    margin, y
                );
                y += 6;
                if (y > 270) {
                    pdf.addPage();
                    y = margin;
                }
            }

            // Footer
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 290);

            pdf.save(`spendwise_comparison_${format(selectedMonth, 'yyyy-MM')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setGenerating(false);
        }
    }, [data, selectedMonth]);

    // Prepare chart data for dual bar comparison
    const chartData = useMemo(() => ({
        labels: data?.categoryComparison.slice(0, 8).map(c => c.category.name) ?? [],
        datasets: [
            {
                label: format(subMonths(selectedMonth, 1), 'MMM', { locale: enUS }),
                data: data?.categoryComparison.slice(0, 8).map(c => c.previous.amount) ?? [],
                backgroundColor: 'rgba(158, 158, 158, 0.5)',
                borderColor: 'rgba(158, 158, 158, 1)',
                borderWidth: 1,
                borderRadius: 4
            },
            {
                label: format(selectedMonth, 'MMM', { locale: enUS }),
                data: data?.categoryComparison.slice(0, 8).map(c => c.current.amount) ?? [],
                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
                borderRadius: 4
            }
        ]
    }), [data, selectedMonth]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false as const,
        indexAxis: 'y' as const,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { color: '#a0a0b0' }
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: '#a0a0b0',
                    callback: (value: string | number) => `€${value}`
                }
            },
            y: {
                grid: { display: false },
                ticks: { color: '#a0a0b0' }
            }
        }
    }), []);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">No data available</div>
                <p>Add transactions to view the comparison</p>
            </div>
        );
    }

    const isCurrentMonth = isSameMonth(selectedMonth, new Date());
    const prevMonthName = format(subMonths(selectedMonth, 1), 'MMMM', { locale: enUS });
    const currentMonthName = format(selectedMonth, 'MMMM yyyy', { locale: enUS });

    const getBalanceClass = () => {
        const balance = data.currentMonth.totalIncome - data.currentMonth.totalExpenses;
        return balance >= 0 ? 'text-success' : 'text-danger';
    };

    const getVelocityTrendClass = () => {
        return data.metrics.spendingVelocity.currentPace <= data.metrics.spendingVelocity.previousPace
            ? 'positive'
            : 'negative';
    };

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Monthly Comparison</h1>
                    <p className="page-subtitle">
                        {prevMonthName} vs {format(selectedMonth, 'MMMM', { locale: enUS })}
                    </p>
                </div>
                <div className="header-controls">
                    {/* Month navigation */}
                    <div className="month-nav">
                        <button className="btn btn-ghost" onClick={goToPreviousMonth} aria-label="Previous month" title="Previous month">
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            className="btn btn-ghost month-selector-btn"
                            onClick={goToCurrentMonth}
                        >
                            <Calendar size={16} />
                            {currentMonthName}
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth}
                            aria-label="Next month"
                            title="Next month"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={generatePDF}
                        disabled={generating}
                    >
                        <Download size={16} />
                        {generating ? 'Generating...' : 'PDF'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="stats-grid">
                {/* Income Delta */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingUp size={16} />
                        Income
                    </div>
                    <div className="stat-value text-success">
                        {formatCurrency(data.currentMonth.totalIncome)}
                    </div>
                    <div className={`stat-trend ${getTrendClass(data.deltas.income.trend)}`}>
                        {getTrendIcon(data.deltas.income.trend)}
                        <span>{formatPercent(data.deltas.income.percentage)}</span>
                        <span className="text-muted">
                            ({data.deltas.income.amount >= 0 ? '+' : ''}{formatCurrency(data.deltas.income.amount)})
                        </span>
                    </div>
                </div>

                {/* Expenses Delta */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingDown size={16} />
                        Expenses
                    </div>
                    <div className="stat-value text-danger">
                        {formatCurrency(data.currentMonth.totalExpenses)}
                    </div>
                    <div className={`stat-trend ${getTrendClass(data.deltas.expenses.trend, true)}`}>
                        {getTrendIcon(data.deltas.expenses.trend, true)}
                        <span>{formatPercent(data.deltas.expenses.percentage)}</span>
                        <span className="text-muted">
                            ({data.deltas.expenses.amount >= 0 ? '+' : ''}{formatCurrency(data.deltas.expenses.amount)})
                        </span>
                    </div>
                </div>

                {/* Net Change */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <Target size={16} />
                        Balance
                    </div>
                    <div className={`stat-value ${getBalanceClass()}`}>
                        {(data.currentMonth.totalIncome - data.currentMonth.totalExpenses) >= 0 ? '+' : ''}
                        {formatCurrency(data.currentMonth.totalIncome - data.currentMonth.totalExpenses)}
                    </div>
                    <div className={`stat-trend ${getTrendClass(data.deltas.netChange.trend)}`}>
                        {getTrendIcon(data.deltas.netChange.trend)}
                        <span>{formatPercent(data.deltas.netChange.percentage)}</span>
                    </div>
                </div>

                {/* Spending Velocity */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <Zap size={16} />
                        Velocity
                    </div>
                    <div className="stat-value">
                        €{data.metrics.spendingVelocity.currentPace.toFixed(0)}<span className="stat-unit">/day</span>
                    </div>
                    <div className={`stat-trend ${getVelocityTrendClass()}`}>
                        {data.metrics.spendingVelocity.currentPace <= data.metrics.spendingVelocity.previousPace
                            ? <ArrowDown size={14} />
                            : <ArrowUp size={14} />
                        }
                        <span>vs €{data.metrics.spendingVelocity.previousPace.toFixed(0)}/day prev.</span>
                    </div>
                </div>
            </div>

            {/* Insights Section */}
            {data.insights.length > 0 && (
                <div className="card mt-lg">
                    <div className="card-header">
                    <h3 className="card-title card-title-with-icon">
                            <Sparkles size={18} />
                            Insights
                    </h3>
                </div>
                <div className="insights-grid">
                    {data.insights.map((insight, i) => (
                        <div key={i} className={`insight-card ${insight.type}`}>
                            <span className="insight-icon">{insight.icon}</span>
                            <div className="insight-content">
                                <div className="insight-title">
                                    {insight.title.en}
                                </div>
                                <div className="insight-description">
                                    {insight.description.en}
                                </div>
                                </div>
                                <span className={`impact-badge ${insight.impact}`}>
                                    {insight.impact.toUpperCase()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="card mt-lg">
                <div className="card-header">
                    <h3 className="card-title">
                        Category Comparison Chart
                    </h3>
                </div>
                <div className="chart-container chart-container-lg">
                    <Bar data={chartData} options={chartOptions} />
                </div>
            </div>

            {/* Category Comparison Table */}
            <div className="card mt-lg">
                <div className="card-header">
                    <h3 className="card-title">
                        Category Comparison Table
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th className="text-left">#</th>
                                <th className="text-left">
                                    Category
                                </th>
                                <th className="text-right">
                                    {format(selectedMonth, 'MMM', { locale: enUS })}
                                </th>
                                <th className="text-right">
                                    {format(subMonths(selectedMonth, 1), 'MMM', { locale: enUS })}
                                </th>
                                <th className="text-right">Δ</th>
                                <th className="text-center">Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.categoryComparison.map((cat, i) => {
                                const badge = getCategoryTrendBadge(cat);
                                const rankChange = cat.rank.change;
                                const deltaColorClass = cat.delta.amount > 0 ? 'text-danger' : cat.delta.amount < 0 ? 'text-success' : 'text-muted';
                                return (
                                    <tr key={i}>
                                        <td>
                                            <div className="rank-display">
                                                <span className="font-semibold">{cat.rank.current}</span>
                                                {rankChange > 0 && <ArrowUp size={12} className="text-success" />}
                                                {rankChange < 0 && <ArrowDown size={12} className="text-danger" />}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="category-cell">
                                                <span className="category-icon">{cat.category.icon}</span>
                                                <span>{cat.category.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-right table-cell-numeric font-semibold">
                                            {formatCurrency(cat.current.amount)}
                                        </td>
                                        <td className="text-right table-cell-numeric text-muted">
                                            {formatCurrency(cat.previous.amount)}
                                        </td>
                                        <td className={`text-right table-cell-numeric font-medium ${deltaColorClass}`}>
                                            {cat.delta.amount >= 0 ? '+' : ''}{formatCurrency(cat.delta.amount)}
                                            <br />
                                            <span className="delta-percentage">
                                                {formatPercent(cat.delta.percentage)}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <span className="trend-badge">{badge.label}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ML Prediction Card */}
            {data.prediction && (
                <div className="card prediction-card">
                    <div className="card-header">
                        <h3 className="card-title card-title-with-icon">
                            🔮 Next Month Prediction
                            <span className="ml-badge">ML</span>
                        </h3>
                    </div>
                    <div className="prediction-grid">
                        <div>
                            <div className="prediction-label">
                                Predicted Expenses
                            </div>
                            <div className="prediction-value">
                                {formatCurrency(data.prediction.predictedExpenses)}
                            </div>
                        </div>
                        <div>
                            <div className="prediction-label">
                                Predicted Income
                            </div>
                            <div className="prediction-value text-success">
                                {formatCurrency(data.prediction.predictedIncome)}
                            </div>
                        </div>
                        <div>
                            <div className="prediction-label">
                                Confidence
                            </div>
                            <div className={`prediction-value ${data.prediction.confidence > 0.7 ? 'text-success' : data.prediction.confidence > 0.5 ? 'text-warning' : 'text-danger'}`}>
                                {(data.prediction.confidence * 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>
                    {data.prediction.riskFactors.length > 0 && (
                        <div className="risk-factors">
                            <div className="risk-factors-label">
                                Risk factors:
                            </div>
                            <ul className="risk-factors-list">
                                {data.prediction.riskFactors.map((rf, i) => (
                                    <li key={i}>{rf.en}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Peak Day Info */}
            <div className="grid-2 mt-lg">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            📅 Peak Day - {format(selectedMonth, 'MMM', { locale: enUS })}
                        </h3>
                    </div>
                    <div className="peak-day-content">
                        {data.metrics.biggestExpenseDay.current ? (
                            <>
                                <div className="peak-day-date">
                                    {format(new Date(data.metrics.biggestExpenseDay.current.date), 'd MMMM', { locale: enUS })}
                                </div>
                                <div className="peak-day-amount">
                                    {formatCurrency(data.metrics.biggestExpenseDay.current.amount)}
                                </div>
                                <div className="peak-day-transactions">
                                    {data.metrics.biggestExpenseDay.current.transactions} transactions
                                </div>
                            </>
                        ) : (
                            <div className="text-muted">
                                No data
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            📅 Peak Day - {format(subMonths(selectedMonth, 1), 'MMM', { locale: enUS })}
                        </h3>
                    </div>
                    <div className="peak-day-content">
                        {data.metrics.biggestExpenseDay.previous ? (
                            <>
                                <div className="peak-day-date">
                                    {format(new Date(data.metrics.biggestExpenseDay.previous.date), 'd MMMM', { locale: enUS })}
                                </div>
                                <div className="peak-day-amount">
                                    {formatCurrency(data.metrics.biggestExpenseDay.previous.amount)}
                                </div>
                                <div className="peak-day-transactions">
                                    {data.metrics.biggestExpenseDay.previous.transactions} transactions
                                </div>
                            </>
                        ) : (
                            <div className="text-muted">
                                No data
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
