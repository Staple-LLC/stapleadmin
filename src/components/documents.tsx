import { Select, SelectItem } from './ui/select';
import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileText,
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { PdfDocument } from '../lib/api';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import './documents.css';

const maxBytes = 10 * 1024 * 1024;
const fileError = (file: File) =>
  !file.name.toLowerCase().endsWith('.pdf')
    ? 'Choose a PDF file.'
    : file.size > maxBytes
      ? 'PDF files must be 10 MB or smaller.'
      : !file.size
        ? 'The selected file is empty.'
        : '';
const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function DocumentsPage() {
  return (
    <main className="page documents-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR FINANCIAL PAPERWORK</p>
          <h1>Invoices & receipts</h1>
          <p className="muted">
            Keep your original PDFs together, ready when you need them.
          </p>
        </div>
        <span className="date-tag">Private · Owner & Finance</span>
      </div>
      <DocumentFiles />
    </main>
  );
}

export function DocumentFiles({
  target,
  defaultKind = 'INVOICE',
}: {
  target?: { type: 'invoices' | 'expenses' | 'financial-records'; id: string };
  defaultKind?: 'INVOICE' | 'RECEIPT';
}) {
  const [kind, setKind] = useState<'INVOICE' | 'RECEIPT'>(defaultKind);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PdfDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const cache = useQueryClient();
  const params = new URLSearchParams({
    page: String(page),
    size: target ? '10' : '20',
    q: search,
    kind: filter,
    ...(target ? { targetType: target.type, targetId: target.id } : {}),
  });
  const query = useQuery({
    queryKey: ['documents', params.toString()],
    queryFn: () => api.documents.list(params),
  });
  function selectFiles(files: FileList | File[]) {
    if (uploading) return;
    const selected = files.length === 1 ? files[0] : null;
    const problem =
      files.length > 1
        ? 'Choose one PDF at a time.'
        : selected
          ? fileError(selected)
          : 'Choose a PDF file.';
    setError(problem);
    setMessage('');
    setFile(problem ? null : selected);
    if (input.current) input.current.value = '';
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (uploading) return;
    setError('');
    setMessage('');
    if (!file) {
      setError('Choose a PDF to upload.');
      return;
    }
    if (fileError(file)) {
      setError(fileError(file));
      return;
    }
    setUploading(true);
    try {
      await api.documents.upload(file, kind, target);
      setFile(null);
      if (input.current) input.current.value = '';
      setPage(0);
      setSearch('');
      setFilter('');
      await cache.invalidateQueries({ queryKey: ['documents'] });
      setMessage('PDF saved. It is ready to download below.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Upload failed. Please retry.',
      );
    } finally {
      setUploading(false);
    }
  }
  async function deleteDocument() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.documents.remove(pendingDelete.id);
      setPendingDelete(null);
      setPage(0);
      await cache.invalidateQueries({ queryKey: ['documents'] });
      setMessage('PDF deleted. Your financial record is unchanged.');
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? cause.message
          : 'Could not delete the PDF. Please retry.',
      );
    } finally {
      setDeleting(false);
    }
  }
  async function download(document: PdfDocument) {
    setError('');
    setDownloading(document.id);
    try {
      const blob = await api.documents.download(document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.name;
      window.document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Download failed. Please retry.',
      );
    } finally {
      setDownloading(null);
    }
  }
  return (
    <section
      className={`document-files ${target ? 'document-files-compact' : ''}`}
      aria-label={target ? 'PDF attachments' : 'PDF document library'}
    >
      {target && (
        <div className="document-section-heading">
          <h2>PDF attachments</h2>
          <p>Upload an invoice or receipt for this record.</p>
        </div>
      )}
      <form
        className={`document-upload ${dragging ? 'document-upload-dragging' : ''}`}
        onSubmit={(event) => void upload(event)}
        aria-label="Upload PDF"
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.dataTransfer.types.includes('Files') && !uploading) {
            dragDepth.current += 1;
            setDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = uploading ? 'none' : 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dragDepth.current = 0;
          setDragging(false);
          if (!uploading) selectFiles(event.dataTransfer.files);
        }}
      >
        <div className="document-upload-icon">
          <Upload size={21} />
        </div>
        <div className="document-file-field">
          <label htmlFor={inputId}>Choose your PDF</label>
          <small>Drag and drop a PDF here, or choose a file.</small>
          <input
            hidden
            ref={input}
            id={inputId}
            type="file"
            accept=".pdf,application/pdf"
            disabled={uploading}
            onChange={(event) => {
              if (event.target.files?.length) selectFiles(event.target.files);
            }}
          />
          <div className="document-file-selection">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              Choose File
            </Button>
            <span role="status" aria-live="polite">
              {file
                ? `${file.name} · ${sizeLabel(file.size)}`
                : 'No file chosen'}
            </span>
          </div>
          <small>PDF only · up to 10 MB · maximum 500 pages</small>
        </div>
        <label className="document-kind">
          Document type
          <Select
            aria-label="Document type"
            value={kind}
            disabled={uploading}
            onValueChange={(nextValue) => setKind(nextValue as typeof kind)}
          >
            <SelectItem value="INVOICE">Invoice</SelectItem>
            <SelectItem value="RECEIPT">Receipt</SelectItem>
          </Select>
        </label>
        <Button type="submit" disabled={uploading || !file}>
          <Upload size={15} />
          {uploading ? 'Uploading…' : 'Upload PDF'}
        </Button>
      </form>
      <p className="document-financial-note">
        Uploading a PDF saves the document. It does not create an invoice or
        record a payment. Files are private to Owner and Finance.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="document-success" role="status">
          {message}
        </p>
      )}
      <div className="document-browser">
        <div className="document-toolbar">
          <label className="document-search">
            <Search size={16} />
            <input
              aria-label="Search PDFs"
              placeholder="Search file or linked record…"
              maxLength={200}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <Select
            aria-label="Filter PDF type"
            value={filter}
            onValueChange={(nextValue) => {
              setFilter(nextValue);
              setPage(0);
            }}
          >
            <SelectItem value="">All PDFs</SelectItem>
            <SelectItem value="INVOICE">Invoices</SelectItem>
            <SelectItem value="RECEIPT">Receipts</SelectItem>
          </Select>
        </div>
        {query.isPending ? (
          <p className="document-state" role="status">
            Loading documents…
          </p>
        ) : query.isError ? (
          <div className="document-state" role="alert">
            <p>{query.error.message}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <ul className="document-list">
              {query.data.content.map((document) => (
                <li key={document.id}>
                  <span
                    className={`document-file-icon ${document.kind.toLowerCase()}`}
                  >
                    <FileText size={21} />
                  </span>
                  <div className="document-file-info">
                    <strong>{document.name}</strong>
                    <p>
                      <span>
                        {document.kind === 'INVOICE' ? 'Invoice' : 'Receipt'}
                      </span>{' '}
                      · {sizeLabel(document.size)} · {document.pages}{' '}
                      {document.pages === 1 ? 'page' : 'pages'} ·{' '}
                      {new Intl.DateTimeFormat('en-MY', {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(new Date(document.createdAt))}
                    </p>
                    {document.targetLabel && (
                      <small>
                        {document.targetType === 'invoices'
                          ? 'Invoice'
                          : 'Expense'}{' '}
                        · {document.targetLabel}
                      </small>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Download ${document.name}`}
                    disabled={downloading === document.id}
                    onClick={() => void download(document)}
                  >
                    <Download size={15} />
                    <span>
                      {downloading === document.id
                        ? 'Downloading…'
                        : 'Download'}
                    </span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    aria-label={`Delete ${document.name}`}
                    onClick={() => {
                      setPendingDelete(document);
                      setDeleteError('');
                      setMessage('');
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </li>
              ))}
            </ul>
            {!query.data.content.length && (
              <div className="document-state">
                <FileText size={27} />
                <h3>
                  {search || filter
                    ? 'No matching PDFs'
                    : 'Your paperwork starts here'}
                </h3>
                <p>
                  {search || filter
                    ? 'Try a different search or document type.'
                    : target
                      ? 'Attach the original invoice or receipt to keep it with this record.'
                      : 'Upload existing invoices and receipts, or attach them from an invoice or expense’s details.'}
                </p>
              </div>
            )}
            <div className="document-pagination">
              <span>
                {query.data.totalElements}{' '}
                {query.data.totalElements === 1 ? 'PDF' : 'PDFs'}
              </span>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous documents page"
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span>
                  {page + 1} / {Math.max(1, query.data.totalPages)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next documents page"
                  disabled={page + 1 >= query.data.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        {pendingDelete && (
          <DialogContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              window.setTimeout(
                () =>
                  window.document
                    .getElementById(`${inputId}-cancel-delete`)
                    ?.focus(),
                0,
              );
            }}
          >
            <DialogTitle className="text-xl font-semibold">
              Delete PDF attachment?
            </DialogTitle>
            <DialogDescription className="muted text-sm my-3">
              Remove {pendingDelete.name} from the document library and its
              linked record. The invoice, expense and payment amounts will stay
              unchanged. A private copy is retained for record history.
            </DialogDescription>
            {deleteError && (
              <p role="alert" className="error">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <Button
                id={`${inputId}-cancel-delete`}
                variant="outline"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => void deleteDocument()}
              >
                {deleting ? 'Deleting…' : 'Delete PDF'}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
