export interface TrackerTransaction {
  sourceRow: number;
  id?: string;
  version?: number;
  currency?: string;
  source?: 'WORKBOOK' | 'MANUAL' | 'OS' | 'PAYMENT';
  vendor?: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  amount: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
}
export interface TrackerSummary {
  source: {
    id: string;
    name: string;
    sha256: string | null;
    currency: string;
    updatedAt?: string | null;
    importedAt?: string;
    firstDate: string | null;
    lastDate: string | null;
    transactionCount: number;
  } | null;
  years: number[];
  periodStart: string | null;
  periodEnd: string | null;
  income: string;
  expenses: string;
  profit: string;
  margin: string | null;
  incomeCount: number;
  expenseCount: number;
  purchasedAssets: string;
  assets: FinancialAsset[];
  months: {
    month: string;
    income: string;
    expenses: string;
    profit: string;
    cumulativeProfit: string;
    transactionCount: number;
    margin?: string | null;
  }[];
  categories: { name: string; amount: string }[];
}

export interface FinancialWorkbook {
  transactionPage?: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  summary: TrackerSummary;
  transactions: TrackerTransaction[];
  categoryRows: {
    type: 'INCOME' | 'EXPENSE';
    name: string;
    amounts: string[];
    total: string;
  }[];
  expenseBreakdown: {
    name: string;
    amount: string;
    share: string | null;
    monthlyAverage: string | null;
  }[];
}

export interface FinancialAsset {
  sourceRow: number;
  amount: string;
  id?: string;
  version?: number;
  currency?: string;
  description?: string | null;
  purchaseDate?: string | null;
  source?: string;
}
export type FinancialTransactionInput = Pick<
  TrackerTransaction,
  | 'date'
  | 'type'
  | 'category'
  | 'description'
  | 'amount'
  | 'paymentMethod'
  | 'reference'
  | 'notes'
> & { version: number; currency: string; vendor: string };
export interface FinancialAssetInput {
  version: number;
  amount: string;
  currency: string;
  description: string | null;
  purchaseDate: string | null;
}
