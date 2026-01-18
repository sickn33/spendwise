// Analytics service for SpendWise
import { db, getCategories } from '../db/database';
import type { Transaction, MonthlyStats, ReportData, ChartDataPoint, TimeSeriesDataPoint } from '../types';
import { startOfMonth, endOfMonth, format, subMonths, eachMonthOfInterval } from 'date-fns';

// Get monthly statistics
export async function getMonthlyStats(month: Date): Promise<MonthlyStats> {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const monthKey = format(month, 'yyyy-MM');

    const transactions = await db.transactions
        .where('date')
        .between(start, end, true, true)
        .toArray();

    const categoryBreakdown: Record<number, number> = {};
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of transactions) {
        if (t.amount > 0) {
            totalIncome += t.amount;
        } else {
            totalExpenses += Math.abs(t.amount);
        }

        categoryBreakdown[t.categoryId] = (categoryBreakdown[t.categoryId] || 0) + Math.abs(t.amount);
    }

    return {
        month: monthKey,
        totalIncome,
        totalExpenses,
        categoryBreakdown,
        transactionCount: transactions.length
    };
}

// Get spending trend over multiple months
export async function getSpendingTrend(months: number = 6): Promise<TimeSeriesDataPoint[]> {
    const now = new Date();
    const startDate = subMonths(now, months - 1);

    const monthDates = eachMonthOfInterval({ start: startDate, end: now });
    const trend: TimeSeriesDataPoint[] = [];

    for (const monthDate of monthDates) {
        const stats = await getMonthlyStats(monthDate);
        trend.push({
            date: stats.month,
            value: stats.totalExpenses
        });
    }

    return trend;
}

// Get category breakdown for a date range
export async function getCategoryBreakdown(
    startDate: Date,
    endDate: Date,
    onlyExpenses: boolean = true
): Promise<ChartDataPoint[]> {
    const transactions = await db.transactions
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();

    const categories = await getCategories();
    const categoryMap = new Map(categories.map(c => [c.id!, c]));

    const breakdown: Record<number, number> = {};

    for (const t of transactions) {
        if (onlyExpenses && t.amount >= 0) continue;
        breakdown[t.categoryId] = (breakdown[t.categoryId] || 0) + Math.abs(t.amount);
    }

    return Object.entries(breakdown)
        .map(([catId, amount]) => {
            const category = categoryMap.get(Number(catId));
            return {
                label: category?.name || 'Unknown',
                value: amount,
                color: category?.color || '#757575'
            };
        })
        .sort((a, b) => b.value - a.value);
}

// Get top expenses for a period
export async function getTopExpenses(
    startDate: Date,
    endDate: Date,
    limit: number = 10
): Promise<Transaction[]> {
    const transactions = await db.transactions
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();

    return transactions
        .filter(t => t.amount < 0)
        .sort((a, b) => a.amount - b.amount)
        .slice(0, limit);
}

// Generate insights
export async function generateInsights(): Promise<string[]> {
    const insights: string[] = [];
    const now = new Date();
    const currentMonth = await getMonthlyStats(now);
    const lastMonth = await getMonthlyStats(subMonths(now, 1));

    // Compare spending
    const spendingChange = currentMonth.totalExpenses - lastMonth.totalExpenses;
    const spendingChangePercent = lastMonth.totalExpenses > 0
        ? (spendingChange / lastMonth.totalExpenses * 100).toFixed(1)
        : 0;

    if (spendingChange > 0) {
        insights.push(`📈 Le tue spese sono aumentate del ${spendingChangePercent}% rispetto al mese scorso.`);
    } else if (spendingChange < 0) {
        insights.push(`📉 Le tue spese sono diminuite del ${Math.abs(Number(spendingChangePercent))}% rispetto al mese scorso.`);
    }

    // Find biggest category
    const categories = await getCategories();
    const categoryMap = new Map(categories.map(c => [c.id!, c]));

    let biggestCatId = 0;
    let biggestAmount = 0;
    for (const [catId, amount] of Object.entries(currentMonth.categoryBreakdown)) {
        if (amount > biggestAmount) {
            biggestAmount = amount;
            biggestCatId = Number(catId);
        }
    }

    if (biggestCatId > 0) {
        const category = categoryMap.get(biggestCatId);
        if (category) {
            insights.push(`💰 La categoria "${category.name}" è la tua spesa maggiore questo mese (€${biggestAmount.toFixed(2)}).`);
        }
    }

    // Check income vs expenses
    const netChange = currentMonth.totalIncome - currentMonth.totalExpenses;
    if (netChange > 0) {
        insights.push(`✅ Bilancio positivo questo mese: +€${netChange.toFixed(2)}.`);
    } else if (netChange < 0) {
        insights.push(`⚠️ Stai spendendo più di quanto guadagni questo mese: -€${Math.abs(netChange).toFixed(2)}.`);
    }

    return insights;
}

// Generate full report data
export async function generateReportData(startDate: Date, endDate: Date): Promise<ReportData> {
    const transactions = await db.transactions
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();

    const categories = await getCategories();
    const categoryMap = new Map(categories.map(c => [c.id!, c]));

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryAmounts: Record<number, { amount: number; count: number }> = {};

    for (const t of transactions) {
        if (t.amount > 0) {
            totalIncome += t.amount;
        } else {
            totalExpenses += Math.abs(t.amount);
        }

        if (!categoryAmounts[t.categoryId]) {
            categoryAmounts[t.categoryId] = { amount: 0, count: 0 };
        }
        categoryAmounts[t.categoryId].amount += Math.abs(t.amount);
        categoryAmounts[t.categoryId].count++;
    }

    const categoryBreakdown = Object.entries(categoryAmounts)
        .map(([catId, data]) => {
            const category = categoryMap.get(Number(catId));
            return {
                category: category || { id: Number(catId), name: 'Unknown', icon: '❓', color: '#757575', keywords: [], isDefault: false, isIncome: false },
                amount: data.amount,
                percentage: totalExpenses > 0 ? (data.amount / totalExpenses * 100) : 0,
                transactionCount: data.count
            };
        })
        .sort((a, b) => b.amount - a.amount);

    const topExpenses = await getTopExpenses(startDate, endDate, 10);
    const monthlyTrend = await getSpendingTrend(6);

    return {
        dateRange: { from: startDate, to: endDate },
        totalIncome,
        totalExpenses,
        netChange: totalIncome - totalExpenses,
        categoryBreakdown,
        topExpenses,
        monthlyTrend
    };
}

// Calculate daily average spending
export async function getDailyAverageSpending(days: number = 30): Promise<number> {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const transactions = await db.transactions
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();

    const totalExpenses = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return totalExpenses / days;
}
