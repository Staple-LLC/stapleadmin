import type { QueryClient } from '@tanstack/react-query';
import type {
  TrackerTransaction,
  FinancialAsset,
  FinancialTransactionInput,
  FinancialAssetInput,
} from './tracker-types';
export const currencies = ['MYR', 'USD', 'SGD', 'EUR', 'GBP', 'AUD'];
export async function refreshFinancialRecords(cache: QueryClient) {
  await Promise.all(
    [
      'tracker',
      'tracker-transactions',
      'financial-workbook',
      'expenses',
      'dashboard',
      'invoices',
      'invoice-reconciliation',
      'documents',
      'billing',
    ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
  );
}
export function transactionInput(
  row: TrackerTransaction,
): FinancialTransactionInput {
  return {
    version: row.version ?? 0,
    date: row.date,
    type: row.type,
    category: row.category,
    vendor: row.vendor ?? '',
    description: row.description,
    amount: row.amount,
    currency: row.currency ?? 'MYR',
    paymentMethod: row.paymentMethod,
    reference: row.reference,
    notes: row.notes,
  };
}
export function assetInput(row: FinancialAsset): FinancialAssetInput {
  return {
    version: row.version ?? 0,
    amount: row.amount,
    currency: row.currency ?? 'MYR',
    description: row.description ?? null,
    purchaseDate: row.purchaseDate ?? null,
  };
}
