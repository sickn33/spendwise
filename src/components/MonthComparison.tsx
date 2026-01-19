import { useState, useEffect } from 'react';
import { getMonthlyComparison } from '../services/comparison';
import type { MonthlyComparisonData, CategoryComparison, MonthlyInsight, Language } from '../types';
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
import { it as itLocale } from 'date-fns/locale';
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
import jsPDF from 'jspdf';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export function MonthComparison() {
    const [data, setData] = useState<MonthlyComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [language, setLanguage] = useState<Language>('it');
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadComparison();
    }, [selectedMonth]);

    async function loadComparison() {
        setLoading(true);
        try {
            const comparison = await getMonthlyComparison(selectedMonth);
            setData(comparison);
        } catch (error) {
            console.error('Error loading comparison:', error);
        } finally {
            setLoading(false);
        }
    }

    function goToPreviousMonth() {
        setSelectedMonth(prev => subMonths(prev, 1));
    }

    function goToNextMonth() {
        const next = addMonths(selectedMonth, 1);
        if (next <= new Date()) {
            setSelectedMonth(next);
        }
    }

    function goToCurrentMonth() {
        setSelectedMonth(new Date());
    }

    function getTrendIcon(trend: 'up' | 'down' | 'stable', isExpense: boolean = false) {
        if (trend === 'up') {
            return <TrendingUp size={16} className={isExpense ? 'text-danger' : 'text-success'} />;
        } else if (trend === 'down') {
            return <TrendingDown size={16} className={isExpense ? 'text-success' : 'text-danger'} />;
        }
        return <Minus size={16} style={{ color: 'var(--text-muted)' }} />;
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

    function getInsightStyle(type: MonthlyInsight['type']) {
        const styles: Record<string, { bg: string; border: string; icon: string }> = {
            positive: { bg: 'rgba(76, 175, 80, 0.1)', border: 'var(--success)', icon: '✅' },
            warning: { bg: 'rgba(255, 152, 0, 0.1)', border: 'var(--warning)', icon: '⚠️' },
            achievement: { bg: 'rgba(156, 39, 176, 0.1)', border: '#9C27B0', icon: '🏆' },
            neutral: { bg: 'rgba(158, 158, 158, 0.1)', border: 'var(--text-muted)', icon: '📊' }
        };
        return styles[type] || styles.neutral;
    }

    async function generatePDF() {
        if (!data) return;
        setGenerating(true);

        try {
            const pdf = new jsPDF();
            const margin = 20;
            let y = margin;

            // Title
            pdf.setFontSize(20);
            pdf.setTextColor(99, 102, 241);
            pdf.text('SpendWise - Confronto Mensile', margin, y);
            y += 12;

            // Months
            pdf.setFontSize(12);
            pdf.setTextColor(100, 100, 100);
            pdf.text(
                `${format(subMonths(selectedMonth, 1), 'MMMM yyyy', { locale: itLocale })} vs ${format(selectedMonth, 'MMMM yyyy', { locale: itLocale })}`,
                margin, y
            );
            y += 20;

            // Summary
            pdf.setFontSize(14);
            pdf.setTextColor(30, 30, 30);
            pdf.text('Riepilogo Variazioni', margin, y);
            y += 10;

            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60);

            const deltas = [
                { label: 'Entrate', value: data.deltas.income },
                { label: 'Spese', value: data.deltas.expenses },
                { label: 'Bilancio', value: data.deltas.netChange }
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
            pdf.text('Confronto Categorie', margin, y);
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
            pdf.text(`Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 290);

            pdf.save(`spendwise_confronto_${format(selectedMonth, 'yyyy-MM')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setGenerating(false);
        }
    }

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
                <div className="empty-state-title">Nessun dato disponibile</div>
                <p>Aggiungi delle transazioni per vedere il confronto</p>
            </div>
        );
    }

    // Prepare chart data for dual bar comparison
    const chartData = {
        labels: data.categoryComparison.slice(0, 8).map(c => c.category.name),
        datasets: [
            {
                label: format(subMonths(selectedMonth, 1), 'MMM', { locale: itLocale }),
                data: data.categoryComparison.slice(0, 8).map(c => c.previous.amount),
                backgroundColor: 'rgba(158, 158, 158, 0.5)',
                borderColor: 'rgba(158, 158, 158, 1)',
                borderWidth: 1,
                borderRadius: 4
            },
            {
                label: format(selectedMonth, 'MMM', { locale: itLocale }),
                data: data.categoryComparison.slice(0, 8).map(c => c.current.amount),
                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
                borderRadius: 4
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
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
    };

    const isCurrentMonth = isSameMonth(selectedMonth, new Date());
    const prevMonthName = format(subMonths(selectedMonth, 1), 'MMMM', { locale: itLocale });
    const currentMonthName = format(selectedMonth, 'MMMM yyyy', { locale: itLocale });

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Confronto Mensile</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                        {prevMonthName} vs {format(selectedMonth, 'MMMM', { locale: itLocale })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Language toggle */}
                    <button
                        className="btn btn-ghost"
                        onClick={() => setLanguage(l => l === 'it' ? 'en' : 'it')}
                        title={language === 'it' ? 'Switch to English' : 'Passa all\'italiano'}
                    >
                        {language === 'it' ? '🇮🇹' : '🇬🇧'}
                    </button>

                    {/* Month navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <button className="btn btn-ghost" onClick={goToPreviousMonth}>
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={goToCurrentMonth}
                            style={{
                                minWidth: '160px',
                                textTransform: 'capitalize',
                                fontWeight: 600
                            }}
                        >
                            <Calendar size={16} />
                            {currentMonthName}
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth}
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
                        {generating ? 'Generazione...' : 'PDF'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="stats-grid">
                {/* Income Delta */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingUp size={16} />
                        {language === 'it' ? 'Entrate' : 'Income'}
                    </div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                        {formatCurrency(data.currentMonth.totalIncome)}
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        marginTop: 'var(--space-xs)',
                        fontSize: '0.85rem',
                        color: data.deltas.income.trend === 'up' ? 'var(--success)' : data.deltas.income.trend === 'down' ? 'var(--danger)' : 'var(--text-muted)'
                    }}>
                        {getTrendIcon(data.deltas.income.trend)}
                        <span>{formatPercent(data.deltas.income.percentage)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                            ({data.deltas.income.amount >= 0 ? '+' : ''}{formatCurrency(data.deltas.income.amount)})
                        </span>
                    </div>
                </div>

                {/* Expenses Delta */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingDown size={16} />
                        {language === 'it' ? 'Spese' : 'Expenses'}
                    </div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>
                        {formatCurrency(data.currentMonth.totalExpenses)}
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        marginTop: 'var(--space-xs)',
                        fontSize: '0.85rem',
                        color: data.deltas.expenses.trend === 'down' ? 'var(--success)' : data.deltas.expenses.trend === 'up' ? 'var(--danger)' : 'var(--text-muted)'
                    }}>
                        {getTrendIcon(data.deltas.expenses.trend, true)}
                        <span>{formatPercent(data.deltas.expenses.percentage)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                            ({data.deltas.expenses.amount >= 0 ? '+' : ''}{formatCurrency(data.deltas.expenses.amount)})
                        </span>
                    </div>
                </div>

                {/* Net Change */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <Target size={16} />
                        {language === 'it' ? 'Bilancio' : 'Balance'}
                    </div>
                    <div className="stat-value" style={{
                        color: (data.currentMonth.totalIncome - data.currentMonth.totalExpenses) >= 0
                            ? 'var(--success)'
                            : 'var(--danger)'
                    }}>
                        {(data.currentMonth.totalIncome - data.currentMonth.totalExpenses) >= 0 ? '+' : ''}
                        {formatCurrency(data.currentMonth.totalIncome - data.currentMonth.totalExpenses)}
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        marginTop: 'var(--space-xs)',
                        fontSize: '0.85rem',
                        color: data.deltas.netChange.trend === 'up' ? 'var(--success)' : data.deltas.netChange.trend === 'down' ? 'var(--danger)' : 'var(--text-muted)'
                    }}>
                        {getTrendIcon(data.deltas.netChange.trend)}
                        <span>{formatPercent(data.deltas.netChange.percentage)}</span>
                    </div>
                </div>

                {/* Spending Velocity */}
                <div className="card stat-card">
                    <div className="stat-label">
                        <Zap size={16} />
                        {language === 'it' ? 'Velocità' : 'Velocity'}
                    </div>
                    <div className="stat-value">
                        €{data.metrics.spendingVelocity.currentPace.toFixed(0)}<span style={{ fontSize: '0.6em', color: 'var(--text-muted)' }}>/giorno</span>
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-xs)',
                        marginTop: 'var(--space-xs)',
                        fontSize: '0.85rem',
                        color: data.metrics.spendingVelocity.currentPace <= data.metrics.spendingVelocity.previousPace
                            ? 'var(--success)'
                            : 'var(--danger)'
                    }}>
                        {data.metrics.spendingVelocity.currentPace <= data.metrics.spendingVelocity.previousPace
                            ? <ArrowDown size={14} />
                            : <ArrowUp size={14} />
                        }
                        <span>vs €{data.metrics.spendingVelocity.previousPace.toFixed(0)}/g prec.</span>
                    </div>
                </div>
            </div>

            {/* Insights Section */}
            {data.insights.length > 0 && (
                <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <Sparkles size={18} />
                            {language === 'it' ? 'Insight' : 'Insights'}
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-md)', padding: 'var(--space-md)' }}>
                        {data.insights.map((insight, i) => {
                            const style = getInsightStyle(insight.type);
                            return (
                                <div
                                    key={i}
                                    style={{
                                        padding: 'var(--space-md)',
                                        background: style.bg,
                                        borderLeft: `4px solid ${style.border}`,
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 'var(--space-md)'
                                    }}
                                >
                                    <span style={{ fontSize: '1.5rem' }}>{insight.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                                            {insight.title[language]}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            {insight.description[language]}
                                        </div>
                                    </div>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        background: insight.impact === 'high' ? 'var(--danger)' : insight.impact === 'medium' ? 'var(--warning)' : 'var(--text-muted)',
                                        color: 'white'
                                    }}>
                                        {insight.impact.toUpperCase()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        {language === 'it' ? 'Confronto per Categoria' : 'Category Comparison'}
                    </h3>
                </div>
                <div className="chart-container" style={{ height: '350px', padding: 'var(--space-md)' }}>
                    <Bar data={chartData} options={chartOptions} />
                </div>
            </div>

            {/* Category Comparison Table */}
            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        {language === 'it' ? 'Dettaglio Categorie' : 'Category Details'}
                    </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>#</th>
                                <th style={{ textAlign: 'left', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    {language === 'it' ? 'Categoria' : 'Category'}
                                </th>
                                <th style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    {format(selectedMonth, 'MMM', { locale: itLocale })}
                                </th>
                                <th style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    {format(subMonths(selectedMonth, 1), 'MMM', { locale: itLocale })}
                                </th>
                                <th style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>Δ</th>
                                <th style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.categoryComparison.map((cat, i) => {
                                const badge = getCategoryTrendBadge(cat);
                                const rankChange = cat.rank.change;
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 'var(--space-md)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ fontWeight: 600 }}>{cat.rank.current}</span>
                                                {rankChange > 0 && <ArrowUp size={12} style={{ color: 'var(--success)' }} />}
                                                {rankChange < 0 && <ArrowDown size={12} style={{ color: 'var(--danger)' }} />}
                                            </div>
                                        </td>
                                        <td style={{ padding: 'var(--space-md)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                <span style={{ fontSize: '1.25rem' }}>{cat.category.icon}</span>
                                                <span>{cat.category.name}</span>
                                            </div>
                                        </td>
                                        <td style={{
                                            textAlign: 'right',
                                            padding: 'var(--space-md)',
                                            fontWeight: 600,
                                            fontFeatureSettings: 'tnum'
                                        }}>
                                            {formatCurrency(cat.current.amount)}
                                        </td>
                                        <td style={{
                                            textAlign: 'right',
                                            padding: 'var(--space-md)',
                                            color: 'var(--text-muted)',
                                            fontFeatureSettings: 'tnum'
                                        }}>
                                            {formatCurrency(cat.previous.amount)}
                                        </td>
                                        <td style={{
                                            textAlign: 'right',
                                            padding: 'var(--space-md)',
                                            fontWeight: 500,
                                            color: cat.delta.amount > 0 ? 'var(--danger)' : cat.delta.amount < 0 ? 'var(--success)' : 'var(--text-muted)',
                                            fontFeatureSettings: 'tnum'
                                        }}>
                                            {cat.delta.amount >= 0 ? '+' : ''}{formatCurrency(cat.delta.amount)}
                                            <br />
                                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                                {formatPercent(cat.delta.percentage)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
                                            <span style={{ fontSize: '1.2rem' }}>{badge.label}</span>
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
                <div className="card" style={{ marginTop: 'var(--space-lg)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(156, 39, 176, 0.1) 100%)' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            🔮 {language === 'it' ? 'Previsione Prossimo Mese' : 'Next Month Prediction'}
                            <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--primary)',
                                color: 'white',
                                marginLeft: 'var(--space-sm)'
                            }}>
                                ML
                            </span>
                        </h3>
                    </div>
                    <div style={{ padding: 'var(--space-md)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)' }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-xs)' }}>
                                {language === 'it' ? 'Spese Previste' : 'Predicted Expenses'}
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {formatCurrency(data.prediction.predictedExpenses)}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-xs)' }}>
                                {language === 'it' ? 'Entrate Previste' : 'Predicted Income'}
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                                {formatCurrency(data.prediction.predictedIncome)}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-xs)' }}>
                                {language === 'it' ? 'Affidabilità' : 'Confidence'}
                            </div>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: data.prediction.confidence > 0.7 ? 'var(--success)' : data.prediction.confidence > 0.5 ? 'var(--warning)' : 'var(--danger)'
                            }}>
                                {(data.prediction.confidence * 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>
                    {data.prediction.riskFactors.length > 0 && (
                        <div style={{ padding: '0 var(--space-md) var(--space-md)', borderTop: '1px solid var(--border)', marginTop: 'var(--space-sm)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 'var(--space-md) 0 var(--space-sm)' }}>
                                {language === 'it' ? 'Fattori di rischio:' : 'Risk factors:'}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 'var(--space-lg)', color: 'var(--warning)' }}>
                                {data.prediction.riskFactors.map((rf, i) => (
                                    <li key={i} style={{ fontSize: '0.9rem' }}>{rf[language]}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Peak Day Info */}
            <div className="grid-2" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            📅 {language === 'it' ? 'Giorno di Picco' : 'Peak Day'} - {format(selectedMonth, 'MMM', { locale: itLocale })}
                        </h3>
                    </div>
                    <div style={{ padding: 'var(--space-md)' }}>
                        {data.metrics.biggestExpenseDay.current ? (
                            <>
                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    {format(new Date(data.metrics.biggestExpenseDay.current.date), 'd MMMM', { locale: itLocale })}
                                </div>
                                <div style={{ color: 'var(--danger)', fontSize: '1.5rem', fontWeight: 700, marginTop: 'var(--space-xs)' }}>
                                    {formatCurrency(data.metrics.biggestExpenseDay.current.amount)}
                                </div>
                                <div style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                                    {data.metrics.biggestExpenseDay.current.transactions} {language === 'it' ? 'transazioni' : 'transactions'}
                                </div>
                            </>
                        ) : (
                            <div style={{ color: 'var(--text-muted)' }}>
                                {language === 'it' ? 'Nessun dato' : 'No data'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            📅 {language === 'it' ? 'Giorno di Picco' : 'Peak Day'} - {format(subMonths(selectedMonth, 1), 'MMM', { locale: itLocale })}
                        </h3>
                    </div>
                    <div style={{ padding: 'var(--space-md)' }}>
                        {data.metrics.biggestExpenseDay.previous ? (
                            <>
                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                    {format(new Date(data.metrics.biggestExpenseDay.previous.date), 'd MMMM', { locale: itLocale })}
                                </div>
                                <div style={{ color: 'var(--danger)', fontSize: '1.5rem', fontWeight: 700, marginTop: 'var(--space-xs)' }}>
                                    {formatCurrency(data.metrics.biggestExpenseDay.previous.amount)}
                                </div>
                                <div style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                                    {data.metrics.biggestExpenseDay.previous.transactions} {language === 'it' ? 'transazioni' : 'transactions'}
                                </div>
                            </>
                        ) : (
                            <div style={{ color: 'var(--text-muted)' }}>
                                {language === 'it' ? 'Nessun dato' : 'No data'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
