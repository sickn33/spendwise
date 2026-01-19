// TypeScript types for SpendWise

export interface Transaction {
  id?: number;
  date: Date;
  description: string;
  details: string;
  amount: number;
  currency: string;
  categoryId: number;
  subcategoryId?: number;
  isRecurring: boolean;
  tags: string[];
  account: string;
  isContabilized: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  parentId?: number;
  keywords: string[];
  isDefault: boolean;
  isIncome: boolean;
}

export interface UserSettings {
  id?: number;
  currency: string;
  theme: 'dark' | 'light' | 'auto';
  monthlyBudget?: number;
  categoryBudgets: Record<number, number>;
  pinEnabled: boolean;
  pinHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  totalIncome: number;
  totalExpenses: number;
  categoryBreakdown: Record<number, number>;
  transactionCount: number;
}

// For display purposes
export interface TransactionWithCategory extends Transaction {
  category?: Category;
  subcategory?: Category;
}

export interface CategoryWithSubcategories extends Category {
  subcategories: Category[];
}

// Import types
export interface IsybankTransaction {
  Data: Date | string;
  Operazione: string;
  Dettagli: string;
  'Conto o carta': string;
  Contabilizzazione: string;
  Categoria: string;
  Valuta: string;
  Importo: number;
}

// Chart data types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

// Filter types
export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categoryIds?: number[];
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
  isIncome?: boolean;
}

// Report types
export interface ReportData {
  dateRange: { from: Date; to: Date };
  totalIncome: number;
  totalExpenses: number;
  netChange: number;
  categoryBreakdown: Array<{
    category: Category;
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;
  topExpenses: Transaction[];
  monthlyTrend: TimeSeriesDataPoint[];
}

// Budget types
export interface Budget {
  id?: number;
  categoryId: number;
  amount: number;
  period: 'monthly' | 'weekly';
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetProgress {
  budget: Budget;
  category: Category;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

// Quick Add preset
export interface QuickAddPreset {
  id?: number;
  name: string;
  amount: number;
  categoryId: number;
  icon: string;
}

// Savings Goal
export interface SavingsGoal {
  id?: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  icon: string;
  color: string;
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsContribution {
  id?: number;
  goalId: number;
  amount: number;
  date: Date;
  note?: string;
}

// =====================================================
// Month-vs-Month Comparison Types
// =====================================================

export type TrendDirection = 'up' | 'down' | 'stable';
export type CategoryTrend = 'increased' | 'decreased' | 'new' | 'removed' | 'stable';
export type InsightType = 'positive' | 'warning' | 'neutral' | 'achievement';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type Language = 'it' | 'en';

// Delta change with percentage
export interface DeltaValue {
  amount: number;
  percentage: number;
  trend: TrendDirection;
}

// Day with peak spending
export interface DayPeak {
  date: Date;
  amount: number;
  transactions: number;
}

// Spending velocity analysis
export interface SpendingVelocity {
  currentPace: number;        // €/day this month
  previousPace: number;       // €/day last month
  projectedTotal: number;     // Projected end of month
  comparedToPrevious: number; // % difference projected
  daysRemaining: number;
  daysElapsed: number;
  budgetRemaining?: number;
  isOnTrack: boolean;
}

// Category comparison between months
export interface CategoryComparison {
  category: Category;
  current: {
    amount: number;
    transactionCount: number;
    percentage: number;
    averageTransaction: number;
  };
  previous: {
    amount: number;
    transactionCount: number;
    percentage: number;
    averageTransaction: number;
  };
  delta: {
    amount: number;
    percentage: number;
    transactionCountDelta: number;
  };
  trend: CategoryTrend;
  rank: {
    current: number;
    previous: number;
    change: number;
  };
  insight?: {
    it: string;
    en: string;
  };
}

// Insight with i18n support
export interface MonthlyInsight {
  type: InsightType;
  icon: string;
  title: {
    it: string;
    en: string;
  };
  description: {
    it: string;
    en: string;
  };
  impact: ImpactLevel;
  category?: Category;
  value?: number;
  metadata?: Record<string, unknown>;
}

// ML Prediction for next month
export interface MonthlyPrediction {
  predictedExpenses: number;
  predictedIncome: number;
  confidence: number; // 0-1
  basedOnMonths: number;
  categoryPredictions: Array<{
    category: Category;
    predictedAmount: number;
    trend: TrendDirection;
  }>;
  riskFactors: Array<{
    it: string;
    en: string;
  }>;
}

// Complete monthly comparison data
export interface MonthlyComparisonData {
  currentMonth: MonthlyStats;
  previousMonth: MonthlyStats;
  
  // Overall deltas
  deltas: {
    income: DeltaValue;
    expenses: DeltaValue;
    netChange: DeltaValue;
    transactionCount: { amount: number; percentage: number };
  };
  
  // Per-category analysis
  categoryComparison: CategoryComparison[];
  
  // Smart insights
  insights: MonthlyInsight[];
  
  // Advanced metrics
  metrics: {
    dailyAverageSpending: { current: number; previous: number; delta: number };
    biggestExpenseDay: { current: DayPeak | null; previous: DayPeak | null };
    spendingVelocity: SpendingVelocity;
    weekdayAnalysis: {
      currentMostExpensive: string;
      previousMostExpensive: string;
    };
  };
  
  // ML predictions
  prediction?: MonthlyPrediction;
}
