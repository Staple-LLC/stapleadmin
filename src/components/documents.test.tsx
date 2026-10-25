import { chooseSelectValue } from '../test-utils/select';
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DocumentFiles } from './documents';
const mock = vi.hoisted(() => ({
  list: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../lib/api', () => ({ api: { documents: mock } }));
const document = {
  id: 'pdf-id',
  name: 'receipt.pdf',
  kind: 'RECEIPT',
  size: 1024,
  pages: 1,
  createdAt: '2026-10-22T00:00:00Z',
  targetType: 'expenses',
  targetId: 'expense-id',
  targetLabel: 'Hosting',
};
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DocumentFiles
        target={{ type: 'expenses', id: 'expense-id' }}
        defaultKind="RECEIPT"
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0 });
  mock.upload.mockResolvedValue(document);
  mock.remove.mockResolvedValue(undefined);
});
afterEach(cleanup);
it('uploads a receipt linked to its expense and refreshes the attachment list', async () => {
  mount();
  await screen.findByText('Your paperwork starts here');
  const file = new File(['%PDF-fixture'], 'receipt.pdf', {
    type: 'application/pdf',
  });
  fireEvent.change(screen.getByLabelText('Choose your PDF'), {
    target: { files: [file] },
  });
  mock.list.mockResolvedValue({
    content: [document],
    totalElements: 1,
    totalPages: 1,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
  await screen.findByText('PDF saved. It is ready to download below.');
  expect(mock.upload).toHaveBeenCalledWith(file, 'RECEIPT', {
    type: 'expenses',
    id: 'expense-id',
  });
  await screen.findByRole('button', { name: 'Download receipt.pdf' });
});
it('preserves the selected file after an upload error and allows retry', async () => {
  mock.upload
    .mockRejectedValueOnce(new Error('Storage unavailable'))
    .mockResolvedValue(document);
  mount();
  await screen.findByText('Your paperwork starts here');
  const file = new File(['pdf'], 'receipt.pdf');
  fireEvent.change(screen.getByLabelText('Choose your PDF'), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
  await screen.findByRole('alert');
  expect(screen.queryByText(/PDF saved/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
  await screen.findByText('PDF saved. It is ready to download below.');
  expect(mock.upload).toHaveBeenCalledTimes(2);
});
it('rejects non-PDF filenames without sending a request', async () => {
  mount();
  await screen.findByText('Your paperwork starts here');
  fireEvent.change(screen.getByLabelText('Choose your PDF'), {
    target: { files: [new File(['text'], 'receipt.txt')] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
  await screen.findByText('Choose a PDF file.');
  expect(mock.upload).not.toHaveBeenCalled();
});
it('filters the library and includes its record link in each request', async () => {
  mount();
  await screen.findByText('Your paperwork starts here');
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Filter PDF type' }),
    'INVOICE',
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Search PDFs' }), {
    target: { value: 'hosting' },
  });
  await waitFor(() =>
    expect(mock.list.mock.lastCall?.[0].get('q')).toBe('hosting'),
  );
  const params = mock.list.mock.lastCall?.[0];
  expect(params.get('kind')).toBe('INVOICE');
  expect(params.get('targetId')).toBe('expense-id');
  expect(params.get('targetType')).toBe('expenses');
});
it('selects a dropped PDF and uploads it only after confirmation with the linked record', async () => {
  mount();
  await screen.findByText('Your paperwork starts here');
  const file = new File(['%PDF-fixture'], 'dropped-receipt.pdf', {
    type: 'application/pdf',
  });
  const zone = screen.getByRole('form', { name: 'Upload PDF' });
  fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } });
  expect(zone.classList.contains('document-upload-dragging')).toBe(true);
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
  expect(zone.classList.contains('document-upload-dragging')).toBe(false);
  expect(screen.getByText(/dropped-receipt.pdf/)).toBeTruthy();
  expect(mock.upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
  await screen.findByText('PDF saved. It is ready to download below.');
  expect(mock.upload).toHaveBeenCalledWith(file, 'RECEIPT', {
    type: 'expenses',
    id: 'expense-id',
  });
  expect(screen.getByText('No file chosen')).toBeTruthy();
});
it('rejects multiple, empty, oversized and non-PDF drops without uploading', async () => {
  mount();
  await screen.findByText('Your paperwork starts here');
  const zone = screen.getByRole('form', { name: 'Upload PDF' });
  for (const [files, message] of [
    [
      [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')],
      'Choose one PDF at a time.',
    ],
    [[new File(['text'], 'receipt.txt')], 'Choose a PDF file.'],
    [[new File([], 'empty.pdf')], 'The selected file is empty.'],
    [
      [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf')],
      'PDF files must be 10 MB or smaller.',
    ],
  ] as [File[], string][]) {
    fireEvent.drop(zone, { dataTransfer: { files } });
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(
      (screen.getByRole('button', { name: 'Upload PDF' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  }
  expect(mock.upload).not.toHaveBeenCalled();
});
it('ignores new drops during upload and preserves the original selection on failure', async () => {
  let reject!: (reason: Error) => void;
  mock.upload.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  mount();
  await screen.findByText('Your paperwork starts here');
  const zone = screen.getByRole('form', { name: 'Upload PDF' });
  const original = new File(['pdf'], 'original.pdf');
  fireEvent.drop(zone, { dataTransfer: { files: [original] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
  fireEvent.drop(zone, {
    dataTransfer: { files: [new File(['pdf'], 'replacement.pdf')] },
  });
  reject(new Error('Storage unavailable'));
  await screen.findByRole('alert');
  expect(screen.getByText(/original.pdf/)).toBeTruthy();
  expect(screen.queryByText(/replacement.pdf/)).toBeNull();
  expect(mock.upload).toHaveBeenCalledTimes(1);
});
it('requires confirmation before deleting and refreshes the list after deletion', async () => {
  mock.list.mockResolvedValue({
    content: [document],
    totalElements: 1,
    totalPages: 1,
  });
  mount();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Delete receipt.pdf' }),
  );
  expect(mock.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(mock.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete receipt.pdf' }));
  mock.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Delete PDF' }));
  await screen.findByText('PDF deleted. Your financial record is unchanged.');
  expect(mock.remove).toHaveBeenCalledWith('pdf-id');
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Download receipt.pdf' }),
    ).toBeNull(),
  );
});
it('keeps the attachment and confirmation open when deletion fails', async () => {
  mock.list.mockResolvedValue({
    content: [document],
    totalElements: 1,
    totalPages: 1,
  });
  mock.remove.mockRejectedValueOnce(new Error('Delete unavailable'));
  mount();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Delete receipt.pdf' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete PDF' }));
  await screen.findByText('Delete unavailable');
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.queryByText(/PDF deleted/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(
    screen.getByRole('button', { name: 'Download receipt.pdf' }),
  ).toBeTruthy();
});
