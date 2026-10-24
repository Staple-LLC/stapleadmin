import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import {
  currencies,
  refreshFinancialRecords,
  transactionInput,
  assetInput,
} from '../lib/financial-records';
import { FinancialRecordEditor } from './financial-record-editor';
import type { RecordEditorState } from './financial-record-editor';
import {
  buildFinancialSheets,
  cellsAsTsv,
  columnLetter,
  sheetAsCsv,
} from '../lib/financial-sheets';
import type { FinancialSheet, SheetRow } from '../lib/financial-sheets';
import { Button } from './ui/button';
import './financial-workbook.css';

type Position = { row: number; col: number };
export default function FinancialWorkbookPage() {
  const [year, setYear] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [editor, setEditor] = useState<RecordEditorState | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const cache = useQueryClient();
  const [years, setYears] = useState<number[]>([]);
  const [tab, setTab] = useState('transactions');
  const query = useQuery({
    queryKey: ['financial-workbook', year, currency],
    refetchInterval: 15000,
    queryFn: () => api.financialWorkbook(year, currency),
  });
  useEffect(() => {
    if (query.data) setYears(query.data.summary.years);
  }, [query.data]);
  const sheets = query.data ? buildFinancialSheets(query.data) : [];
  const sheet = sheets.find((s) => s.id === tab) ?? sheets[0];
  async function commit(row: SheetRow, field: string, value: string) {
    try {
      if (row.record?.id)
        await api.financialRecords.update(row.record.id, {
          ...transactionInput(row.record),
          [field]: value,
        });
      else if (row.asset?.id)
        await api.financialRecords.updateAsset(row.asset.id, {
          ...assetInput(row.asset),
          [field]:
            field === 'purchaseDate' || field === 'description'
              ? value || null
              : value,
        });
      await refreshFinancialRecords(cache);
      setSavedMessage('Saved. Worksheet and dashboard totals are up to date.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        await refreshFinancialRecords(cache);
      throw error;
    }
  }
  function editRow(row: SheetRow) {
    if (row.record?.source === 'PAYMENT') return;
    if (row.record?.id) setEditor({ kind: 'transaction', record: row.record });
    else if (row.asset?.id) setEditor({ kind: 'asset', record: row.asset });
  }
  return (
    <main className="page financial-records-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">A FAMILIAR WAY TO SEE YOUR NUMBERS</p>
          <h1>Financial records</h1>
          <p className="muted">
            Edit your records here. Saved changes update your dashboard.
          </p>
        </div>
        <div className="workbook-page-actions">
          <NavLink to={`/dashboard?currency=${currency}`}>
            <BarChart3 size={15} />
            View charts
          </NavLink>
          <label>
            Currency
            <select
              aria-label="Financial currency"
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value);
                setYear('');
              }}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Reporting period
            <select
              aria-label="Workbook reporting period"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="">All recorded history</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() =>
              setEditor({ kind: tab === 'assets' ? 'asset' : 'transaction' })
            }
          >
            <Plus size={15} />
            {tab === 'assets' ? 'Add asset' : 'Add transaction'}
          </Button>
        </div>
      </div>
      <div className="workbook-context">
        <span>
          <FileSpreadsheet size={15} />
          Live financial records
          {query.data?.summary.source && (
            <span className="workbook-source-name">
              {' '}
              / {query.data.summary.source.name}
            </span>
          )}
        </span>
        <span>
          <Pencil size={12} />
          Editable records · {currency}
        </span>
      </div>
      {query.isPending ? (
        <p className="workbook-state" role="status">
          Loading your financial workbook…
        </p>
      ) : query.isError ? (
        <div className="workbook-state" role="alert">
          <h2>Couldn’t load financial records</h2>
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : !query.data.summary.source ? (
        <div className="workbook-state">
          <FileSpreadsheet size={30} />
          <h2>No workbook has been imported yet</h2>
          <p>Your imported financial records will appear here.</p>
        </div>
      ) : (
        <>
          {savedMessage && (
            <p className="financial-save-success" role="status">
              {savedMessage}
            </p>
          )}
          <WorkbookGrid
            key={`${year}-${currency}-${sheet.id}`}
            sheet={sheet}
            onCommit={commit}
            onEditRow={editRow}
          />
          <div
            className="workbook-tabs"
            role="tablist"
            aria-label="Financial workbook sheets"
          >
            {sheets.map((s) => (
              <button
                type="button"
                role="tab"
                key={s.id}
                aria-selected={s.id === tab}
                aria-controls="financial-sheet-panel"
                id={`sheet-tab-${s.id}`}
                onClick={() => setTab(s.id)}
              >
                <FileSpreadsheet size={14} />
                {s.name}
              </button>
            ))}
          </div>
          <p className="workbook-explainer">
            Double-click a transaction or asset cell to edit it, then press
            Enter or Save cell. Summaries and profit are calculated
            automatically. Expenses recorded in OS appear here too. Currencies
            are kept separate; purchased assets do not reduce recorded profit.
            Row filters hide entries without changing totals.
          </p>
        </>
      )}
      {editor && (
        <FinancialRecordEditor
          key={`${editor.kind}-${editor.record?.id ?? 'new'}`}
          state={editor}
          currency={currency}
          onClose={() => setEditor(null)}
          onSaved={(savedCurrency) => {
            setEditor(null);
            setCurrency(savedCurrency);
            setSavedMessage(
              'Saved. Worksheet and dashboard totals are up to date.',
            );
          }}
        />
      )}
    </main>
  );
}

export function WorkbookGrid({
  sheet,
  onCommit,
  onEditRow,
}: {
  sheet: FinancialSheet;
  onCommit?: (row: SheetRow, field: string, value: string) => Promise<void>;
  onEditRow?: (row: SheetRow) => void;
}) {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia?.('(max-width: 700px)').matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 700px)');
    if (!media) return;
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const widths = sheet.widths.map((width, i) =>
    i === 0 && narrow ? Math.min(width, 150) : width,
  );
  const [active, setActive] = useState<Position>({ row: 0, col: 0 });
  const [anchor, setAnchor] = useState<Position>({ row: 0, col: 0 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<{
    row: SheetRow;
    col: number;
    field: string;
    value: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const editable =
    !!onCommit && (sheet.id === 'transactions' || sheet.id === 'assets');
  function beginEdit(row: SheetRow, col: number, replacement?: string) {
    const cell = row.cells[col];
    if (!onCommit || !cell?.field || busy) return;
    setEditError('');
    setEditing({
      row,
      col,
      field: cell.field,
      value:
        cell.field === 'type'
          ? (row.record?.type ?? 'EXPENSE')
          : (replacement ?? cell.raw),
    });
  }
  async function saveCell() {
    if (!editing || !onCommit || busy) return;
    setBusy(true);
    setEditError('');
    try {
      await onCommit(editing.row, editing.field, editing.value);
      setEditing(null);
      setMessage('Saved');
    } catch (error) {
      setEditError(
        error instanceof ApiError && Object.keys(error.fields ?? {}).length
          ? Object.entries(error.fields)
              .map(([field, message]) => `${field}: ${message}`)
              .join('; ')
          : error instanceof Error
            ? error.message
            : 'Could not save this cell.',
      );
    } finally {
      setBusy(false);
    }
  }
  function editorKeys(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      setEditing(null);
      setEditError('');
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void saveCell();
    }
  }

  const ref = useRef<HTMLDivElement>(null);
  const rows = search.trim()
    ? sheet.rows.filter(
        (r) =>
          r.tone ||
          r.cells.some((c) =>
            c.raw.toLowerCase().includes(search.toLowerCase()),
          ),
      )
    : sheet.rows;
  const pageSize = 100;
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const chosen = rows[active.row]?.cells[active.col];
  useEffect(() => {
    if (active.row >= rows.length) {
      const row = Math.max(0, rows.length - 1);
      setActive({ row, col: 0 });
      setAnchor({ row, col: 0 });
    }
  }, [rows.length, active.row]);

  const address = `${columnLetter(active.col)}${rows[active.row]?.number ?? 1}`;
  const top = Math.min(active.row, anchor.row),
    bottom = Math.max(active.row, anchor.row),
    left = Math.min(active.col, anchor.col),
    right = Math.max(active.col, anchor.col);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        cellsAsTsv(rows, top, bottom, left, right),
      );
      setMessage('Cells copied');
    } catch {
      setMessage(
        'Clipboard is unavailable. You can copy the selected value from the cell bar.',
      );
    }
  }
  function select(position: Position, extend = false, focus = false) {
    setMessage('');
    setActive(position);
    if (!extend) setAnchor(position);
    setPage(Math.floor(position.row / pageSize));
    if (focus)
      requestAnimationFrame(() => {
        const cell = ref.current?.querySelector<HTMLElement>(
          `[data-row="${position.row}"][data-col="${position.col}"]`,
        );
        cell?.focus({ preventScroll: true });
        cell?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      });
  }
  function keyboard(event: KeyboardEvent<HTMLTableCellElement>) {
    if (busy || editing) return;
    const recordRow = rows[active.row];
    if ((event.key === 'Enter' || event.key === 'F2') && chosen?.field) {
      event.preventDefault();
      beginEdit(recordRow, active.col);
      return;
    }
    if (
      chosen?.field &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      (event.key.length === 1 ||
        event.key === 'Backspace' ||
        event.key === 'Delete')
    ) {
      event.preventDefault();
      beginEdit(recordRow, active.col, event.key.length === 1 ? event.key : '');
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void copy();
      return;
    }
    let row = active.row,
      col = active.col;
    switch (event.key) {
      case 'ArrowUp':
        row--;
        break;
      case 'ArrowDown':
        row++;
        break;
      case 'ArrowLeft':
        col--;
        break;
      case 'ArrowRight':
        col++;
        break;
      case 'Home':
        col = 0;
        if (event.ctrlKey || event.metaKey) row = 0;
        break;
      case 'End':
        col = sheet.columns - 1;
        if (event.ctrlKey || event.metaKey) row = rows.length - 1;
        break;
      case 'PageDown':
        row += 20;
        break;
      case 'PageUp':
        row -= 20;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(
      {
        row: Math.max(0, Math.min(rows.length - 1, row)),
        col: Math.max(0, Math.min(sheet.columns - 1, col)),
      },
      event.shiftKey,
      true,
    );
  }
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([sheetAsCsv(sheet)], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `StapleOS_${sheet.name.replaceAll(/[^a-zA-Z0-9]+/g, '_')}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const showing = visible.length
    ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, rows.length)} of ${rows.length} rows`
    : 'No matching rows';
  return (
    <section
      className="workbook-shell"
      id="financial-sheet-panel"
      role="tabpanel"
      aria-labelledby={`sheet-tab-${sheet.id}`}
    >
      <div className="workbook-toolbar">
        <div className="workbook-sheet-title">
          <FileSpreadsheet size={17} />
          <strong>{sheet.name}</strong>
          <span>
            {editable
              ? 'Editable · Enter to save'
              : onCommit
                ? 'Calculated'
                : 'Read only'}
          </span>
        </div>
        <div className="workbook-tools">
          <label className="workbook-search">
            <Search size={14} />
            <input
              aria-label="Filter sheet rows"
              placeholder="Filter rows…"
              value={search}
              maxLength={200}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
                setActive({ row: 0, col: 0 });
                setAnchor({ row: 0, col: 0 });
              }}
            />
          </label>
          {onEditRow && (
            <Button
              variant="outline"
              size="sm"
              disabled={
                busy ||
                !!editing ||
                rows[active.row]?.record?.source === 'PAYMENT' ||
                !(rows[active.row]?.record?.id || rows[active.row]?.asset?.id)
              }
              onClick={() => onEditRow(rows[active.row])}
            >
              <Pencil size={13} />
              Edit row / PDFs
            </Button>
          )}
          {editable && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !!editing || !chosen?.field}
              onClick={() => beginEdit(rows[active.row], active.col)}
            >
              <Pencil size={13} />
              Edit cell
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            <Copy size={13} />
            Copy cells
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download size={13} />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="workbook-formula-bar">
        <span className="cell-address" aria-label="Selected cell">
          {address}
        </span>
        <span className="formula-symbol">fx</span>
        <output aria-label="Selected cell value">{chosen?.raw ?? ''}</output>
      </div>
      {editing && (
        <div className="financial-cell-save">
          <span>
            Editing {columnLetter(editing.col)}
            {editing.row.number} ·{' '}
            {busy ? 'Saving…' : 'Enter saves · Escape cancels'}
          </span>
          <Button size="sm" disabled={busy} onClick={() => void saveCell()}>
            Save cell
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setEditError('');
            }}
          >
            Cancel edit
          </Button>
        </div>
      )}
      {editError && (
        <p className="error" role="alert">
          {editError}
        </p>
      )}
      <div className="workbook-scroll" ref={ref}>
        <table
          role="grid"
          aria-readonly={!editable}
          aria-label={`${sheet.name} spreadsheet`}
          aria-rowcount={rows.length + 1}
          aria-colcount={sheet.columns + 1}
          className="sheet-grid"
          style={{
            width: 44 + widths.reduce((sum, width) => sum + width, 0),
          }}
        >
          <colgroup>
            <col style={{ width: 44 }} />
            {Array.from({ length: sheet.columns }, (_, i) => (
              <col key={i} style={{ width: widths[i] ?? 145 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sheet-corner" aria-label="Row numbers" />
              {Array.from({ length: sheet.columns }, (_, i) => (
                <th
                  key={i}
                  scope="col"
                  className={i === 0 ? 'sheet-frozen-letter' : ''}
                >
                  {columnLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, offset) => {
              const index = page * pageSize + offset;
              return (
                <tr key={r.number} className={r.tone ? `tone-${r.tone}` : ''}>
                  <th scope="row" className="sheet-row-number">
                    {r.number}
                  </th>
                  {Array.from({ length: sheet.columns }, (_, col) => {
                    const cell = r.cells[col],
                      selected =
                        index >= top &&
                        index <= bottom &&
                        col >= left &&
                        col <= right,
                      focused = index === active.row && col === active.col;
                    return (
                      <td
                        key={col}
                        role="gridcell"
                        aria-selected={selected}
                        tabIndex={focused ? 0 : -1}
                        data-row={index}
                        data-col={col}
                        aria-label={`${columnLetter(col)}${r.number}: ${cell?.display ?? ''}`}
                        className={`${col === 0 ? 'sheet-frozen-cell ' : ''}${cell?.kind !== 'text' && cell ? 'sheet-numeric ' : ''}${cell?.kind === 'money' && cell.raw.startsWith('-') ? 'sheet-negative ' : ''}${selected ? 'sheet-selected ' : ''}${focused ? 'sheet-active' : ''}`}
                        title={cell?.display ?? ''}
                        onClick={(event) => {
                          if (!busy && !editing) {
                            select({ row: index, col }, event.shiftKey);
                            event.currentTarget.focus();
                          }
                        }}
                        onDoubleClick={() => beginEdit(r, col)}
                        aria-readonly={!onCommit || !cell?.field}
                        onKeyDown={keyboard}
                      >
                        {editing?.row.number === r.number &&
                        editing.col === col ? (
                          editing.field === 'type' ? (
                            <select
                              autoFocus
                              aria-label="Edit cell value"
                              disabled={busy}
                              value={editing.value}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  value: e.target.value,
                                })
                              }
                              onKeyDown={editorKeys}
                            >
                              <option value="INCOME">Income</option>
                              <option value="EXPENSE">Expense</option>
                            </select>
                          ) : editing.field === 'notes' ? (
                            <textarea
                              autoFocus
                              aria-label="Edit cell value"
                              disabled={busy}
                              value={editing.value}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  value: e.target.value,
                                })
                              }
                              onKeyDown={editorKeys}
                            />
                          ) : (
                            <input
                              autoFocus
                              aria-label="Edit cell value"
                              disabled={busy}
                              type={
                                editing.field === 'date' ||
                                editing.field === 'purchaseDate'
                                  ? 'date'
                                  : 'text'
                              }
                              inputMode={
                                editing.field === 'amount' ? 'decimal' : 'text'
                              }
                              value={editing.value}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  value: e.target.value,
                                })
                              }
                              onKeyDown={editorKeys}
                            />
                          )
                        ) : (
                          <span className="sheet-cell-text">
                            {cell?.display ?? ''}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="workbook-status">
        <span>
          {showing}
          <small>
            Arrow keys to move · Shift + click to select a range · Ctrl/Cmd + C
            to copy
          </small>
        </span>
        <span className="workbook-copy-status" role="status">
          {message === 'Cells copied' && <Check size={13} />}
          {message}
        </span>
        <div className="workbook-paging">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous sheet page"
            disabled={page === 0}
            onClick={() => {
              setPage((p) => p - 1);
              setActive({ row: (page - 1) * pageSize, col: 0 });
              setAnchor({ row: (page - 1) * pageSize, col: 0 });
            }}
          >
            <ChevronLeft size={15} />
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next sheet page"
            disabled={page + 1 >= pages}
            onClick={() => {
              setPage((p) => p + 1);
              setActive({ row: (page + 1) * pageSize, col: 0 });
              setAnchor({ row: (page + 1) * pageSize, col: 0 });
            }}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </section>
  );
}
