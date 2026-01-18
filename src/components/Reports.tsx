import { useState, useEffect } from 'react';
import { generateReportData } from '../services/analytics';
import { getCategories } from '../db/database';
import type { ReportData, Category } from '../types';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export function Reports() {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'month' | '3months' | 'year'>('month');
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadReport();
    }, [dateRange]);

    async function loadReport() {
        setLoading(true);
        try {
            const now = new Date();
            let startDate: Date;

            switch (dateRange) {
                case 'month':
                    startDate = startOfMonth(now);
                    break;
                case '3months':
                    startDate = startOfMonth(subMonths(now, 2));
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
            }

            const [report, cats] = await Promise.all([
                generateReportData(startDate, endOfMonth(now)),
                getCategories()
            ]);

            setReportData(report);
            setCategories(cats);
        } catch (error) {
            console.error('Error loading report:', error);
        } finally {
            setLoading(false);
        }
    }

    async function generatePDF() {
        if (!reportData) return;

        setGenerating(true);
        try {
            const pdf = new jsPDF();
            const margin = 20;
            let y = margin;

            // Title
            pdf.setFontSize(24);
            pdf.setTextColor(99, 102, 241);
            pdf.text('SpendWise Report', margin, y);
            y += 15;

            // Date range
            pdf.setFontSize(12);
            pdf.setTextColor(100, 100, 100);
            pdf.text(
                `${format(reportData.dateRange.from, 'd MMM yyyy', { locale: it })} - ${format(reportData.dateRange.to, 'd MMM yyyy', { locale: it })}`,
                margin, y
            );
            y += 20;

            // Summary
            pdf.setFontSize(16);
            pdf.setTextColor(30, 30, 30);
            pdf.text('Riepilogo', margin, y);
            y += 10;

            pdf.setFontSize(12);
            pdf.setTextColor(60, 60, 60);
            pdf.text(`Totale Entrate: €${reportData.totalIncome.toFixed(2)}`, margin, y);
            y += 8;
            pdf.text(`Totale Spese: €${reportData.totalExpenses.toFixed(2)}`, margin, y);
            y += 8;
            pdf.text(`Bilancio: €${reportData.netChange.toFixed(2)}`, margin, y);
            y += 20;

            // Category breakdown
            pdf.setFontSize(16);
            pdf.setTextColor(30, 30, 30);
            pdf.text('Spese per Categoria', margin, y);
            y += 10;

            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60);

            for (const item of reportData.categoryBreakdown.slice(0, 10)) {
                pdf.text(
                    `${item.category.name}: €${item.amount.toFixed(2)} (${item.percentage.toFixed(1)}%)`,
                    margin, y
                );
                y += 7;

                if (y > 270) {
                    pdf.addPage();
                    y = margin;
                }
            }

            // Top expenses
            y += 10;
            pdf.setFontSize(16);
            pdf.setTextColor(30, 30, 30);
            pdf.text('Top 10 Spese', margin, y);
            y += 10;

            pdf.setFontSize(10);
            pdf.setTextColor(60, 60, 60);

            for (const tx of reportData.topExpenses.slice(0, 10)) {
                pdf.text(
                    `${format(new Date(tx.date), 'dd/MM/yyyy')} - ${tx.description.substring(0, 30)}: €${Math.abs(tx.amount).toFixed(2)}`,
                    margin, y
                );
                y += 7;

                if (y > 270) {
                    pdf.addPage();
                    y = margin;
                }
            }

            // Footer
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 290);

            // Save
            pdf.save(`spendwise_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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

    if (!reportData) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">Nessun dato disponibile</div>
                <p>Aggiungi delle transazioni per vedere i report</p>
            </div>
        );
    }

    const doughnutData = {
        labels: reportData.categoryBreakdown.slice(0, 6).map(c => c.category.name),
        datasets: [{
            data: reportData.categoryBreakdown.slice(0, 6).map(c => c.amount),
            backgroundColor: reportData.categoryBreakdown.slice(0, 6).map(c => c.category.color),
            borderColor: 'transparent',
            borderWidth: 0
        }]
    };

    const barData = {
        labels: reportData.monthlyTrend.map(d => d.date),
        datasets: [{
            label: 'Spese',
            data: reportData.monthlyTrend.map(d => d.value),
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderRadius: 8
        }]
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
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
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Report</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                        {format(reportData.dateRange.from, 'd MMM', { locale: it })} - {format(reportData.dateRange.to, 'd MMM yyyy', { locale: it })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                    <select
                        className="input"
                        value={dateRange}
                        onChange={e => setDateRange(e.target.value as typeof dateRange)}
                        style={{ width: 'auto' }}
                    >
                        <option value="month">Questo mese</option>
                        <option value="3months">Ultimi 3 mesi</option>
                        <option value="year">Quest'anno</option>
                    </select>
                    <button
                        className="btn btn-primary"
                        onClick={generatePDF}
                        disabled={generating}
                    >
                        <Download size={16} />
                        {generating ? 'Generazione...' : 'Scarica PDF'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="stats-grid">
                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingUp size={16} />
                        Totale Entrate
                    </div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                        €{reportData.totalIncome.toFixed(2)}
                    </div>
                </div>

                <div className="card stat-card">
                    <div className="stat-label">
                        <TrendingDown size={16} />
                        Totale Spese
                    </div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>
                        €{reportData.totalExpenses.toFixed(2)}
                    </div>
                </div>

                <div className="card stat-card">
                    <div className="stat-label">
                        <DollarSign size={16} />
                        Bilancio Netto
                    </div>
                    <div className="stat-value" style={{
                        color: reportData.netChange >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                        {reportData.netChange >= 0 ? '+' : ''}€{reportData.netChange.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Spese per categoria</h3>
                    </div>
                    <div className="chart-container" style={{ height: '280px' }}>
                        <Doughnut
                            data={doughnutData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } }
                            }}
                        />
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Trend mensile</h3>
                    </div>
                    <div className="chart-container" style={{ height: '280px' }}>
                        <Bar data={barData} options={barOptions as any} />
                    </div>
                </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">Dettaglio categorie</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>Categoria</th>
                                <th style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>Importo</th>
                                <th style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>%</th>
                                <th style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)', fontWeight: 500 }}>Transazioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.categoryBreakdown.map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--space-md)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <span style={{ fontSize: '1.25rem' }}>{item.category.icon}</span>
                                            <span>{item.category.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: 'var(--space-md)', fontWeight: 600, fontFeatureSettings: 'tnum' }}>
                                        €{item.amount.toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)' }}>
                                        {item.percentage.toFixed(1)}%
                                    </td>
                                    <td style={{ textAlign: 'right', padding: 'var(--space-md)', color: 'var(--text-muted)' }}>
                                        {item.transactionCount}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Expenses */}
            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">Top 10 spese</h3>
                </div>
                <div className="transaction-list">
                    {reportData.topExpenses.map((t, i) => {
                        const category = categories.find(c => c.id === t.categoryId);
                        return (
                            <div key={i} className="transaction-item">
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 'var(--radius-full)',
                                    background: 'var(--bg-glass)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    fontSize: '0.85rem'
                                }}>
                                    #{i + 1}
                                </div>
                                <div
                                    className="transaction-icon"
                                    style={{ background: category?.color ? `${category.color}20` : 'var(--bg-tertiary)' }}
                                >
                                    {category?.icon || '📦'}
                                </div>
                                <div className="transaction-info">
                                    <div className="transaction-description">{t.description}</div>
                                    <div className="transaction-meta">
                                        {format(new Date(t.date), 'd MMM yyyy', { locale: it })} • {category?.name}
                                    </div>
                                </div>
                                <div className="transaction-amount expense">
                                    -€{Math.abs(t.amount).toFixed(2)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
