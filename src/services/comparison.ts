// Comparison analytics service for SpendWise
// Month-vs-Month comparison with trends, insights, and ML predictions

import { db, getCategories, getSettings } from '../db/database';
import { getMonthlyStats } from './analytics';
import type {
    MonthlyStats,
    MonthlyComparisonData,
    CategoryComparison,
    MonthlyInsight,
    SpendingVelocity,
    DayPeak,
    DeltaValue,
    TrendDirection,
    CategoryTrend,
    MonthlyPrediction
} from '../types';
import {
    startOfMonth,
    endOfMonth,
    subMonths,
    format,
    getDaysInMonth,
    getDate,
    getDay
} from 'date-fns';


// Day names in Italian and English
const DAY_NAMES = {
    it: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

// Calculate trend direction
function getTrend(current: number, previous: number, threshold: number = 5): TrendDirection {
    if (previous === 0) return current > 0 ? 'up' : 'stable';
    const change = ((current - previous) / previous) * 100;
    if (change > threshold) return 'up';
    if (change < -threshold) return 'down';
    return 'stable';
}

// Calculate percentage change
function getPercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

// Calculate delta value
function calculateDelta(current: number, previous: number): DeltaValue {
    return {
        amount: current - previous,
        percentage: getPercentageChange(current, previous),
        trend: getTrend(current, previous)
    };
}

// Get transactions by day for a month
async function getDailySpending(month: Date): Promise<Map<string, { amount: number; count: number }>> {
    const start = startOfMonth(month);
    const end = endOfMonth(month);

    const transactions = await db.transactions
        .where('date')
        .between(start, end, true, true)
        .toArray();

    const dailyMap = new Map<string, { amount: number; count: number }>();

    for (const t of transactions) {
        if (t.amount >= 0) continue; // Only expenses
        const dayKey = format(new Date(t.date), 'yyyy-MM-dd');
        const current = dailyMap.get(dayKey) || { amount: 0, count: 0 };
        dailyMap.set(dayKey, {
            amount: current.amount + Math.abs(t.amount),
            count: current.count + 1
        });
    }

    return dailyMap;
}

// Find peak spending day
async function getPeakSpendingDay(month: Date): Promise<DayPeak | null> {
    const dailySpending = await getDailySpending(month);

    if (dailySpending.size === 0) return null;

    let peakDay: DayPeak | null = null;

    for (const [dayKey, data] of dailySpending) {
        if (!peakDay || data.amount > peakDay.amount) {
            peakDay = {
                date: new Date(dayKey),
                amount: data.amount,
                transactions: data.count
            };
        }
    }

    return peakDay;
}

// Get most expensive weekday
async function getMostExpensiveWeekday(month: Date): Promise<number> {
    const dailySpending = await getDailySpending(month);
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat

    for (const [dayKey, data] of dailySpending) {
        const weekday = getDay(new Date(dayKey));
        weekdayTotals[weekday] += data.amount;
    }

    return weekdayTotals.indexOf(Math.max(...weekdayTotals));
}

// Calculate spending velocity
export async function getSpendingVelocity(month: Date): Promise<SpendingVelocity> {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const today = new Date();
    const daysInMonth = getDaysInMonth(month);

    // Determine current day of month
    const isCurrentMonth = format(month, 'yyyy-MM') === format(today, 'yyyy-MM');
    const daysElapsed = isCurrentMonth ? getDate(today) : daysInMonth;
    const daysRemaining = daysInMonth - daysElapsed;

    // Get current month transactions up to today
    const transactions = await db.transactions
        .where('date')
        .between(start, isCurrentMonth ? today : end, true, true)
        .toArray();

    const currentExpenses = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Get previous month stats and settings in parallel
    const prevMonth = subMonths(month, 1);
    const [prevStats, settings] = await Promise.all([
        getMonthlyStats(prevMonth),
        getSettings()
    ]);
    const prevDaysInMonth = getDaysInMonth(prevMonth);

    // Calculate paces
    const currentPace = daysElapsed > 0 ? currentExpenses / daysElapsed : 0;
    const previousPace = prevDaysInMonth > 0 ? prevStats.totalExpenses / prevDaysInMonth : 0;

    // Project to end of month
    const projectedTotal = currentPace * daysInMonth;
    const comparedToPrevious = getPercentageChange(projectedTotal, prevStats.totalExpenses);

    // Check budget
    const budgetRemaining = settings?.monthlyBudget
        ? settings.monthlyBudget - currentExpenses
        : undefined;

    const isOnTrack = budgetRemaining !== undefined
        ? projectedTotal <= (settings?.monthlyBudget || 0)
        : projectedTotal <= prevStats.totalExpenses;

    return {
        currentPace,
        previousPace,
        projectedTotal,
        comparedToPrevious,
        daysRemaining,
        daysElapsed,
        budgetRemaining,
        isOnTrack
    };
}

// Get category comparison between two months
export async function getCategoryComparison(targetMonth: Date): Promise<CategoryComparison[]> {
    const [currentStats, previousStats] = await Promise.all([
        getMonthlyStats(targetMonth),
        getMonthlyStats(subMonths(targetMonth, 1))
    ]);
    const categories = await getCategories();

    // Get all unique category IDs
    const allCategoryIds = new Set([
        ...Object.keys(currentStats.categoryBreakdown).map(Number),
        ...Object.keys(previousStats.categoryBreakdown).map(Number)
    ]);

    // Get transaction counts per category
    const start = startOfMonth(targetMonth);
    const end = endOfMonth(targetMonth);
    const prevStart = startOfMonth(subMonths(targetMonth, 1));
    const prevEnd = endOfMonth(subMonths(targetMonth, 1));

    const [currentTransactions, prevTransactions] = await Promise.all([
        db.transactions
            .where('date')
            .between(start, end, true, true)
            .toArray(),
        db.transactions
            .where('date')
            .between(prevStart, prevEnd, true, true)
            .toArray()
    ]);

    const currentCounts: Record<number, number> = {};
    const prevCounts: Record<number, number> = {};

    currentTransactions.filter(t => t.amount < 0).forEach(t => {
        currentCounts[t.categoryId] = (currentCounts[t.categoryId] || 0) + 1;
    });

    prevTransactions.filter(t => t.amount < 0).forEach(t => {
        prevCounts[t.categoryId] = (prevCounts[t.categoryId] || 0) + 1;
    });

    // Build comparison array
    const comparisons: CategoryComparison[] = [];

    for (const catId of allCategoryIds) {
        const category = categories.find(c => c.id === catId);
        if (!category || category.isIncome) continue;

        const currentAmount = currentStats.categoryBreakdown[catId] || 0;
        const previousAmount = previousStats.categoryBreakdown[catId] || 0;
        const currentCount = currentCounts[catId] || 0;
        const prevCount = prevCounts[catId] || 0;

        // Determine trend
        let trend: CategoryTrend = 'stable';
        if (currentAmount > 0 && previousAmount === 0) trend = 'new';
        else if (currentAmount === 0 && previousAmount > 0) trend = 'removed';
        else {
            const change = getPercentageChange(currentAmount, previousAmount);
            if (change > 10) trend = 'increased';
            else if (change < -10) trend = 'decreased';
        }

        const deltaAmount = currentAmount - previousAmount;
        const deltaPercent = getPercentageChange(currentAmount, previousAmount);

        // Generate insight for this category
        let insight: { it: string; en: string } | undefined;
        if (trend === 'increased' && deltaAmount > 50) {
            insight = {
                it: `Hai speso €${deltaAmount.toFixed(0)} in più rispetto al mese scorso`,
                en: `You spent €${deltaAmount.toFixed(0)} more compared to last month`
            };
        } else if (trend === 'decreased' && Math.abs(deltaAmount) > 50) {
            insight = {
                it: `Hai risparmiato €${Math.abs(deltaAmount).toFixed(0)} rispetto al mese scorso`,
                en: `You saved €${Math.abs(deltaAmount).toFixed(0)} compared to last month`
            };
        } else if (trend === 'new') {
            insight = {
                it: `Nuova categoria questo mese (€${currentAmount.toFixed(0)})`,
                en: `New category this month (€${currentAmount.toFixed(0)})`
            };
        }

        comparisons.push({
            category,
            current: {
                amount: currentAmount,
                transactionCount: currentCount,
                percentage: currentStats.totalExpenses > 0 ? (currentAmount / currentStats.totalExpenses) * 100 : 0,
                averageTransaction: currentCount > 0 ? currentAmount / currentCount : 0
            },
            previous: {
                amount: previousAmount,
                transactionCount: prevCount,
                percentage: previousStats.totalExpenses > 0 ? (previousAmount / previousStats.totalExpenses) * 100 : 0,
                averageTransaction: prevCount > 0 ? previousAmount / prevCount : 0
            },
            delta: {
                amount: deltaAmount,
                percentage: deltaPercent,
                transactionCountDelta: currentCount - prevCount
            },
            trend,
            rank: { current: 0, previous: 0, change: 0 }, // Will be filled later
            insight
        });
    }

    // Sort by current amount and assign ranks
    comparisons.sort((a, b) => b.current.amount - a.current.amount);
    comparisons.forEach((c, i) => c.rank.current = i + 1);

    // Sort by previous amount to get previous ranks
    const prevSorted = [...comparisons].sort((a, b) => b.previous.amount - a.previous.amount);
    prevSorted.forEach((c, i) => {
        const comp = comparisons.find(x => x.category.id === c.category.id);
        if (comp) comp.rank.previous = i + 1;
    });

    // Calculate rank change
    comparisons.forEach(c => {
        c.rank.change = c.rank.previous - c.rank.current; // Positive = moved up
    });

    // Re-sort by current amount
    comparisons.sort((a, b) => b.current.amount - a.current.amount);

    return comparisons;
}

// Generate monthly insights with i18n
export async function generateMonthlyInsights(
    current: MonthlyStats,
    previous: MonthlyStats,
    categoryComparison: CategoryComparison[],
    velocity: SpendingVelocity
): Promise<MonthlyInsight[]> {
    const insights: MonthlyInsight[] = [];

    // 1. Overall spending change
    const expensesDelta = calculateDelta(current.totalExpenses, previous.totalExpenses);

    if (expensesDelta.trend === 'down' && Math.abs(expensesDelta.percentage) >= 5) {
        insights.push({
            type: 'achievement',
            icon: '🏆',
            title: {
                it: 'Ottimo lavoro!',
                en: 'Great job!'
            },
            description: {
                it: `Hai ridotto le spese del ${Math.abs(expensesDelta.percentage).toFixed(1)}% rispetto al mese scorso. Continua così!`,
                en: `You reduced expenses by ${Math.abs(expensesDelta.percentage).toFixed(1)}% compared to last month. Keep it up!`
            },
            impact: 'high',
            value: Math.abs(expensesDelta.amount)
        });
    } else if (expensesDelta.trend === 'up' && expensesDelta.percentage >= 20) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: {
                it: 'Attenzione alle spese',
                en: 'Watch your spending'
            },
            description: {
                it: `Le spese sono aumentate del ${expensesDelta.percentage.toFixed(1)}% (+€${expensesDelta.amount.toFixed(0)}) rispetto al mese scorso.`,
                en: `Expenses increased by ${expensesDelta.percentage.toFixed(1)}% (+€${expensesDelta.amount.toFixed(0)}) compared to last month.`
            },
            impact: 'high',
            value: expensesDelta.amount
        });
    }

    // 2. Category that increased most
    const increasedCategories = categoryComparison
        .filter(c => c.trend === 'increased' && c.delta.amount > 30)
        .sort((a, b) => b.delta.amount - a.delta.amount);

    if (increasedCategories.length > 0) {
        const topIncreased = increasedCategories[0];
        insights.push({
            type: 'warning',
            icon: '📈',
            title: {
                it: `${topIncreased.category.name} in aumento`,
                en: `${topIncreased.category.name} rising`
            },
            description: {
                it: `Spesa aumentata del ${topIncreased.delta.percentage.toFixed(0)}% (+€${topIncreased.delta.amount.toFixed(0)}). ${topIncreased.current.transactionCount} transazioni vs ${topIncreased.previous.transactionCount} del mese scorso.`,
                en: `Spending increased by ${topIncreased.delta.percentage.toFixed(0)}% (+€${topIncreased.delta.amount.toFixed(0)}). ${topIncreased.current.transactionCount} transactions vs ${topIncreased.previous.transactionCount} last month.`
            },
            impact: topIncreased.delta.amount > 100 ? 'high' : 'medium',
            category: topIncreased.category,
            value: topIncreased.delta.amount
        });
    }

    // 3. Category that decreased most (positive insight)
    const decreasedCategories = categoryComparison
        .filter(c => c.trend === 'decreased' && Math.abs(c.delta.amount) > 30)
        .sort((a, b) => a.delta.amount - b.delta.amount);

    if (decreasedCategories.length > 0) {
        const topDecreased = decreasedCategories[0];
        insights.push({
            type: 'positive',
            icon: '📉',
            title: {
                it: `${topDecreased.category.name} in calo`,
                en: `${topDecreased.category.name} down`
            },
            description: {
                it: `Hai risparmiato €${Math.abs(topDecreased.delta.amount).toFixed(0)} (${Math.abs(topDecreased.delta.percentage).toFixed(0)}% in meno) su ${topDecreased.category.name}.`,
                en: `You saved €${Math.abs(topDecreased.delta.amount).toFixed(0)} (${Math.abs(topDecreased.delta.percentage).toFixed(0)}% less) on ${topDecreased.category.name}.`
            },
            impact: 'medium',
            category: topDecreased.category,
            value: Math.abs(topDecreased.delta.amount)
        });
    }

    // 4. Spending velocity projection
    if (velocity.daysRemaining > 0) {
        const projectionDiff = velocity.projectedTotal - previous.totalExpenses;
        if (velocity.isOnTrack) {
            insights.push({
                type: 'positive',
                icon: '🎯',
                title: {
                    it: 'Proiezione fine mese',
                    en: 'End of month projection'
                },
                description: {
                    it: `A questo ritmo (€${velocity.currentPace.toFixed(0)}/giorno), spenderai €${velocity.projectedTotal.toFixed(0)} a fine mese. ${projectionDiff < 0 ? `€${Math.abs(projectionDiff).toFixed(0)} in meno` : 'In linea con'} il mese scorso.`,
                    en: `At this pace (€${velocity.currentPace.toFixed(0)}/day), you'll spend €${velocity.projectedTotal.toFixed(0)} by month end. ${projectionDiff < 0 ? `€${Math.abs(projectionDiff).toFixed(0)} less than` : 'In line with'} last month.`
                },
                impact: 'low',
                value: velocity.projectedTotal
            });
        } else {
            insights.push({
                type: 'warning',
                icon: '🚨',
                title: {
                    it: 'Proiezione sopra budget',
                    en: 'Projection over budget'
                },
                description: {
                    it: `A questo ritmo spenderai €${velocity.projectedTotal.toFixed(0)} a fine mese, €${projectionDiff.toFixed(0)} in più del mese scorso.`,
                    en: `At this pace you'll spend €${velocity.projectedTotal.toFixed(0)} by month end, €${projectionDiff.toFixed(0)} more than last month.`
                },
                impact: 'high',
                value: velocity.projectedTotal
            });
        }
    }

    // 5. New categories
    const newCategories = categoryComparison.filter(c => c.trend === 'new');
    if (newCategories.length > 0) {
        insights.push({
            type: 'neutral',
            icon: '🆕',
            title: {
                it: `${newCategories.length} nuova categoria`,
                en: `${newCategories.length} new category`
            },
            description: {
                it: `Nuove spese in: ${newCategories.map(c => c.category.name).join(', ')} (totale €${newCategories.reduce((s, c) => s + c.current.amount, 0).toFixed(0)})`,
                en: `New spending in: ${newCategories.map(c => c.category.name).join(', ')} (total €${newCategories.reduce((s, c) => s + c.current.amount, 0).toFixed(0)})`
            },
            impact: 'low'
        });
    }

    // 6. Top category unchanged
    const topCurrent = categoryComparison[0];
    if (topCurrent && topCurrent.rank.current === topCurrent.rank.previous && topCurrent.rank.current === 1) {
        insights.push({
            type: 'neutral',
            icon: '📊',
            title: {
                it: 'Categoria principale',
                en: 'Top category'
            },
            description: {
                it: `${topCurrent.category.name} ${topCurrent.category.icon} resta la tua spesa #1 (€${topCurrent.current.amount.toFixed(0)}, ${topCurrent.current.percentage.toFixed(0)}% del totale)`,
                en: `${topCurrent.category.name} ${topCurrent.category.icon} remains your #1 expense (€${topCurrent.current.amount.toFixed(0)}, ${topCurrent.current.percentage.toFixed(0)}% of total)`
            },
            impact: 'low',
            category: topCurrent.category,
            value: topCurrent.current.amount
        });
    }

    return insights;
}

// Generate ML-based predictions
export async function generatePrediction(monthsBack: number = 6): Promise<MonthlyPrediction> {
    const now = new Date();
    const historyMonths = Array.from({ length: monthsBack }, (_, index) => subMonths(now, index + 1));
    const monthlyData: MonthlyStats[] = await Promise.all(historyMonths.map(month => getMonthlyStats(month)));

    // Simple linear regression for prediction
    const expenses = monthlyData.map(m => m.totalExpenses).reverse();
    const incomes = monthlyData.map(m => m.totalIncome).reverse();

    // Calculate trend using simple moving average
    const avgExpenses = expenses.reduce((a, b) => a + b, 0) / expenses.length;
    const avgIncome = incomes.reduce((a, b) => a + b, 0) / incomes.length;

    // Apply trend factor (last 3 months weighted more)
    const recentExpenses = expenses.slice(-3);
    const recentAvg = recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length;
    const trendFactor = avgExpenses > 0 ? recentAvg / avgExpenses : 1;

    const predictedExpenses = avgExpenses * trendFactor;
    const predictedIncome = avgIncome;

    // Calculate confidence (based on volatility)
    const variance = expenses.reduce((sum, e) => sum + Math.pow(e - avgExpenses, 2), 0) / expenses.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgExpenses > 0 ? stdDev / avgExpenses : 0;
    const confidence = Math.max(0.3, Math.min(0.95, 1 - coefficientOfVariation));

    // Category predictions
    const categories = await getCategories();
    const currentStats = await getMonthlyStats(now);
    const categoryPredictions = categories
        .filter(c => !c.isIncome && currentStats.categoryBreakdown[c.id!])
        .map(c => {
            const currentAmount = currentStats.categoryBreakdown[c.id!] || 0;
            const trend = getTrend(currentAmount, avgExpenses * 0.1); // Compare to 10% of average
            return {
                category: c,
                predictedAmount: currentAmount * trendFactor,
                trend
            };
        })
        .sort((a, b) => b.predictedAmount - a.predictedAmount)
        .slice(0, 5);

    // Risk factors
    const riskFactors: Array<{ it: string; en: string }> = [];
    if (trendFactor > 1.1) {
        riskFactors.push({
            it: 'Trend di spesa in aumento negli ultimi mesi',
            en: 'Spending trend increasing in recent months'
        });
    }
    if (coefficientOfVariation > 0.3) {
        riskFactors.push({
            it: 'Alta variabilità nelle spese mensili',
            en: 'High variability in monthly expenses'
        });
    }

    return {
        predictedExpenses,
        predictedIncome,
        confidence,
        basedOnMonths: monthsBack,
        categoryPredictions,
        riskFactors
    };
}

// Main comparison function
export async function getMonthlyComparison(targetMonth: Date = new Date()): Promise<MonthlyComparisonData> {
    const [currentMonth, previousMonth] = await Promise.all([
        getMonthlyStats(targetMonth),
        getMonthlyStats(subMonths(targetMonth, 1))
    ]);

    // Calculate deltas
    const deltas = {
        income: calculateDelta(currentMonth.totalIncome, previousMonth.totalIncome),
        expenses: calculateDelta(currentMonth.totalExpenses, previousMonth.totalExpenses),
        netChange: calculateDelta(
            currentMonth.totalIncome - currentMonth.totalExpenses,
            previousMonth.totalIncome - previousMonth.totalExpenses
        ),
        transactionCount: {
            amount: currentMonth.transactionCount - previousMonth.transactionCount,
            percentage: getPercentageChange(currentMonth.transactionCount, previousMonth.transactionCount)
        }
    };

    const [
        categoryComparison,
        spendingVelocity,
        currentPeakDay,
        previousPeakDay,
        currentMostExpensiveWeekday,
        previousMostExpensiveWeekday,
        prediction
    ] = await Promise.all([
        getCategoryComparison(targetMonth),
        getSpendingVelocity(targetMonth),
        getPeakSpendingDay(targetMonth),
        getPeakSpendingDay(subMonths(targetMonth, 1)),
        getMostExpensiveWeekday(targetMonth),
        getMostExpensiveWeekday(subMonths(targetMonth, 1)),
        generatePrediction(6)
    ]);

    // Generate insights
    const insights = await generateMonthlyInsights(currentMonth, previousMonth, categoryComparison, spendingVelocity);

    // Get metrics
    const currentDailyAvg = currentMonth.transactionCount > 0
        ? currentMonth.totalExpenses / getDaysInMonth(targetMonth)
        : 0;
    const previousDailyAvg = previousMonth.transactionCount > 0
        ? previousMonth.totalExpenses / getDaysInMonth(subMonths(targetMonth, 1))
        : 0;

    return {
        currentMonth,
        previousMonth,
        deltas,
        categoryComparison,
        insights,
        metrics: {
            dailyAverageSpending: {
                current: currentDailyAvg,
                previous: previousDailyAvg,
                delta: currentDailyAvg - previousDailyAvg
            },
            biggestExpenseDay: {
                current: currentPeakDay,
                previous: previousPeakDay
            },
            spendingVelocity,
            weekdayAnalysis: {
                currentMostExpensive: DAY_NAMES.it[currentMostExpensiveWeekday],
                previousMostExpensive: DAY_NAMES.it[previousMostExpensiveWeekday]
            }
        },
        prediction
    };
}
