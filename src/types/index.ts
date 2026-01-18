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


