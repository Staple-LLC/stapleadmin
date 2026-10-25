import { Select, SelectItem } from './ui/select';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { TrackerTransaction, FinancialAsset } from '../lib/tracker-types';
import {
  currencies,
  refreshFinancialRecords,
  transactionInput,
  assetInput,
} from '../lib/financial-records';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { DocumentFiles } from './documents';
export type RecordEditorState =
  | { kind: 'transaction'; record?: TrackerTransaction }
  | { kind: 'asset'; record?: FinancialAsset };
export function FinancialRecordEditor({
  state,
  currency,
  onClose,
  onSaved,
}: {
  state: RecordEditorState;
  currency: string;
  onClose: () => void;
  onSaved: (currency: string) => void;
}) {
  const isAsset = state.kind === 'asset';
  const [transaction, setTransaction] = useState(() =>
    state.kind === 'transaction' && state.record
      ? transactionInput(state.record)
      : {
          version: 0,
          date: new Date().toISOString().slice(0, 10),
          type: 'EXPENSE' as const,
          category: 'Software/Tools',
          vendor: '',
          description: '',
          amount: '',
          currency,
          paymentMethod: '',
          reference: '',
          notes: '',
        },
  );
  const [asset, setAsset] = useState(() =>
    state.kind === 'asset' && state.record
      ? assetInput(state.record)
      : {
          version: 0,
          amount: '',
          currency,
          description: '',
          purchaseDate: null as string | null,
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cache = useQueryClient();
  const record = state.record;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isAsset) {
        if (record?.id)
          await api.financialRecords.updateAsset(record.id, asset);
        else await api.financialRecords.createAsset(asset);
      } else {
        if (record?.id)
          await api.financialRecords.update(record.id, transaction);
        else await api.financialRecords.create(transaction);
      }
      await refreshFinancialRecords(cache);
      onSaved(isAsset ? asset.currency : transaction.currency);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409)
        await refreshFinancialRecords(cache);
      setError(
        cause instanceof ApiError && Object.keys(cause.fields ?? {}).length
          ? Object.entries(cause.fields)
              .map(([field, message]) => `${field}: ${message}`)
              .join('; ')
          : cause instanceof Error
            ? cause.message
            : 'The record could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          {record ? 'Edit' : 'Add'}{' '}
          {isAsset ? 'purchased asset' : 'financial transaction'}
        </DialogTitle>
        <DialogDescription className="muted text-sm my-3">
          Saved changes update the worksheet and dashboard. Amounts stay in
          their stated currency; no currency conversion is applied.
        </DialogDescription>
        <form onSubmit={(event) => void submit(event)}>
          {isAsset ? (
            <div className="form-grid">
              <label>
                Description
                <input
                  maxLength={2000}
                  value={asset.description ?? ''}
                  onChange={(e) =>
                    setAsset({ ...asset, description: e.target.value })
                  }
                />
              </label>
              <label>
                Purchase date (optional)
                <input
                  type="date"
                  value={asset.purchaseDate ?? ''}
                  onChange={(e) =>
                    setAsset({ ...asset, purchaseDate: e.target.value || null })
                  }
                />
              </label>
              <label>
                Purchase amount
                <input
                  required
                  inputMode="decimal"
                  value={asset.amount}
                  onChange={(e) =>
                    setAsset({ ...asset, amount: e.target.value })
                  }
                />
              </label>
              <label>
                Currency
                <Select
                  aria-label="Currency"
                  value={asset.currency}
                  onValueChange={(nextValue) =>
                    setAsset({ ...asset, currency: nextValue })
                  }
                >
                  {currencies.map((c) => (
                    <SelectItem key={c}>{c}</SelectItem>
                  ))}
                </Select>
              </label>
            </div>
          ) : (
            <div className="form-grid">
              <label>
                Date
                <input
                  required
                  type="date"
                  value={transaction.date}
                  onChange={(e) =>
                    setTransaction({ ...transaction, date: e.target.value })
                  }
                />
              </label>
              <label>
                Type
                <Select
                  aria-label="Type"
                  value={transaction.type}
                  disabled={
                    state.kind === 'transaction' &&
                    state.record?.source === 'OS'
                  }
                  onValueChange={(nextValue) =>
                    setTransaction({
                      ...transaction,
                      type: nextValue as 'INCOME' | 'EXPENSE',
                    })
                  }
                >
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </Select>
              </label>
              <label>
                Description
                <input
                  required
                  maxLength={2000}
                  value={transaction.description}
                  onChange={(e) =>
                    setTransaction({
                      ...transaction,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Category
                <input
                  required
                  maxLength={160}
                  value={transaction.category}
                  onChange={(e) =>
                    setTransaction({ ...transaction, category: e.target.value })
                  }
                />
              </label>
              <label>
                Amount
                <input
                  required
                  inputMode="decimal"
                  value={transaction.amount}
                  onChange={(e) =>
                    setTransaction({ ...transaction, amount: e.target.value })
                  }
                />
              </label>
              <label>
                Currency
                <Select
                  aria-label="Currency"
                  value={transaction.currency}
                  onValueChange={(nextValue) =>
                    setTransaction({ ...transaction, currency: nextValue })
                  }
                >
                  {currencies.map((c) => (
                    <SelectItem key={c}>{c}</SelectItem>
                  ))}
                </Select>
              </label>
              <label>
                Vendor (optional)
                <input
                  maxLength={200}
                  value={transaction.vendor}
                  onChange={(e) =>
                    setTransaction({ ...transaction, vendor: e.target.value })
                  }
                />
              </label>
              <label>
                Payment method
                <input
                  maxLength={160}
                  value={transaction.paymentMethod ?? ''}
                  onChange={(e) =>
                    setTransaction({
                      ...transaction,
                      paymentMethod: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Reference / invoice number
                <input
                  maxLength={255}
                  value={transaction.reference ?? ''}
                  onChange={(e) =>
                    setTransaction({
                      ...transaction,
                      reference: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Notes
                <textarea
                  maxLength={2000}
                  value={transaction.notes ?? ''}
                  onChange={(e) =>
                    setTransaction({ ...transaction, notes: e.target.value })
                  }
                />
              </label>
            </div>
          )}
          {error && (
            <p className="error my-4" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer mt-5">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? 'Saving…' : 'Save record'}
            </Button>
          </div>
        </form>
        {state.kind === 'transaction' && state.record?.id && (
          <DocumentFiles
            target={{ type: 'financial-records', id: state.record.id }}
            defaultKind={transaction.type === 'INCOME' ? 'INVOICE' : 'RECEIPT'}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
