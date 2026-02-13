import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { generateReportData } from '../services/analytics';
import { getCategories } from '../db/database';
import type { ReportData, Category } from '../types';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
ChartJS.defaults.animation = false;

export const Reports = memo(function Reports() {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'month' | '3months' | 'year'>('month');
    const [generating, setGenerating] = useState(false);

    const loadReport = useCallback(async () => {
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
    }, [dateRange]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const generatePDF = useCallback(async () => {
        if (!reportData) return;

        setGenerating(true);
        try {
            const jsPDF = (await import('jspdf')).default;
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
    }, [reportData]);

    const categoryMap = useMemo(
        () => new Map(categories.map(c => [c.id!, c])),
        [categories]
    );

    const doughnutData = useMemo(() => ({
        labels: reportData?.categoryBreakdown.slice(0, 6).map(c => c.category.name) ?? [],
        datasets: [{
            data: reportData?.categoryBreakdown.slice(0, 6).map(c => c.amount) ?? [],
            backgroundColor: reportData?.categoryBreakdown.slice(0, 6).map(c => c.category.color) ?? [],
            borderColor: 'transparent',
            borderWidth: 0
        }]
    }), [reportData]);

    const barData = useMemo(() => ({
        labels: reportData?.monthlyTrend.map(d => d.date) ?? [],
        datasets: [{
            label: 'Spese',
            data: reportData?.monthlyTrend.map(d => d.value) ?? [],
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderRadius: 8
        }]
    }), [reportData]);

    const barOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
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
    }), []);

    const doughnutOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } }
    }), []);

    const handleDateRangeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setDateRange(e.target.value as typeof dateRange);
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center p-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink"></div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="flex flex-col items-center justify-center p-xl border border-dashed border-border text-center bg-paper structural-border">
                <TrendingUp size={32} className="text-muted mb-md text-muted" />
                <h3 className="text-sm font-mono uppercase text-muted mb-xs">NESSUN_DATO_ANALITICO</h3>
                <p className="text-muted text-sm max-w-xs mb-md">
                    Registra le tue prime transazioni per generare i report.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-lg">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">REPORT_MENSILE</h1>
                    <p className="text-xs font-mono text-muted uppercase tracking-wider mt-1">
                        ANALISI_FINANZIARIA
                    </p>
                </div>
                <div className="flex items-center gap-sm">
                    <select
                        className="bg-paper border border-border p-xs font-mono text-xs uppercase focus:outline-none focus:border-ink appearance-none pl-2 pr-8"
                        style={{ backgroundImage: 'none' }}
                        value={dateRange}
                        onChange={handleDateRangeChange}
                        aria-label="SELEZIONA_PERIODO"
                    >
                        <option value="month">MESE_CORRENTE</option>
                        <option value="3months">TRIMESTRE</option>
                        <option value="year">ANNO_CORRENTE</option>
                    </select>
                    <button
                        className="btn btn-primary flex items-center gap-xs text-xs uppercase tracking-wider"
                        onClick={generatePDF}
                        disabled={generating}
                    >
                        <Download size={14} />
                        {generating ? 'GENERAZIONE...' : 'EXPORT_PDF'}
                    </button>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                <div className="bg-paper structural-border p-md">
                    <div className="flex items-center gap-xs text-tiny font-mono uppercase text-muted mb-xs">
                        <TrendingUp size={14} />
                        ENTRATE
                    </div>
                    <div className="text-2xl font-mono font-bold tracking-tight text-success">
                        €{reportData.totalIncome.toFixed(2)}
                    </div>
                </div>

                <div className="bg-paper structural-border p-md">
                    <div className="flex items-center gap-xs text-tiny font-mono uppercase text-muted mb-xs">
                        <TrendingDown size={14} />
                        USCITE
                    </div>
                    <div className="text-2xl font-mono font-bold tracking-tight text-danger">
                        €{reportData.totalExpenses.toFixed(2)}
                    </div>
                </div>

                <div className="bg-paper structural-border p-md">
                    <div className="flex items-center gap-xs text-tiny font-mono uppercase text-muted mb-xs">
                        <DollarSign size={14} />
                        NETTO
                    </div>
                    <div className={`text-2xl font-mono font-bold tracking-tight ${reportData.netChange >= 0 ? 'text-success' : 'text-danger'}`}>
                        {reportData.netChange >= 0 ? '+' : ''}€{reportData.netChange.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
                <div className="bg-paper structural-border p-md">
                    <h3 className="text-xs font-mono uppercase text-muted mb-md tracking-wider">SPESE_PER_CATEGORIA</h3>
                    <div className="h-[280px] w-full">
                        <Doughnut
                            data={doughnutData}
                            options={doughnutOptions as never}
                        />
                    </div>
                </div>

                <div className="bg-paper structural-border p-md">
                    <h3 className="text-xs font-mono uppercase text-muted mb-md tracking-wider">TREND_TEMPORALE</h3>
                    <div className="h-[280px] w-full">
                        <Bar data={barData} options={barOptions as never} />
                    </div>
                </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="bg-paper structural-border overflow-hidden">
                <div className="p-md border-b border-border">
                    <h3 className="text-xs font-mono uppercase text-muted tracking-wider">DETTAGLIO_CATEGORIE</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-concrete/20">
                            <tr>
                                <th className="text-left p-sm text-tiny font-mono uppercase text-muted font-normal">CATEGORIA</th>
                                <th className="text-right p-sm text-tiny font-mono uppercase text-muted font-normal">IMPORTO</th>
                                <th className="text-right p-sm text-tiny font-mono uppercase text-muted font-normal">%</th>
                                <th className="text-right p-sm text-tiny font-mono uppercase text-muted font-normal">TX</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {reportData.categoryBreakdown.map((item, i) => (
                                <tr key={i} className="hover:bg-concrete/10 transition-colors">
                                    <td className="p-sm">
                                        <div className="flex items-center gap-sm">
                                            <span>{item.category.icon}</span>
                                            <span className="font-medium text-sm">{item.category.name}</span>
                                        </div>
                                    </td>
                                    <td className="text-right p-sm font-mono text-sm font-bold">
                                        €{item.amount.toFixed(2)}
                                    </td>
                                    <td className="text-right p-sm font-mono text-sm text-muted">
                                        {item.percentage.toFixed(1)}%
                                    </td>
                                    <td className="text-right p-sm font-mono text-sm text-muted">
                                        {item.transactionCount}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Expenses */}
            <div className="bg-paper structural-border overflow-hidden">
                <div className="p-md border-b border-border">
                    <h3 className="text-xs font-mono uppercase text-muted tracking-wider">TOP_10_USCITE</h3>
                </div>
                <div className="divide-y divide-border">
                    {reportData.topExpenses.map((t, i) => {
                        const category = categoryMap.get(t.categoryId);
                        return (
                            <div key={i} className="flex items-center justify-between p-sm hover:bg-concrete/10 transition-colors">
                                <div className="flex items-center gap-md">
                                    <span className="font-mono text-xs text-muted w-6">#{i + 1}</span>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{t.description}</span>
                                        <span className="text-xs text-muted">
                                            {format(new Date(t.date), 'd MMM', { locale: it })} • {category?.name}
                                        </span>
                                    </div>
                                </div>
                                <div className="font-mono text-sm font-bold text-danger">
                                    -€{Math.abs(t.amount).toFixed(2)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
