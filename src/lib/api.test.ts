// @vitest-environment jsdom.s
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const mock = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./supabase', () => ({
  authClient: () => ({ auth: { getSession: mock.getSession } }),
}));
beforeEach(() => {
  mock.getSession.mockResolvedValue({
    data: { session: { access_token: 'current-supabase-token' } },
    error: null,
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ id: 'shared-id' }), { status: 200 }),
      ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('Spring API client', () => {
  it('sends the SDK-managed token to Spring Boot', async () => {
    await api.me();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer current-supabase-token',
        }),
      }),
    );
  });
  it('uses a refreshed token on subsequent requests', async () => {
    await api.me();
    mock.getSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed' } },
      error: null,
    });
    await api.me();
    expect(fetch).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer refreshed' }),
      }),
    );
  });
  it('makes no business request without a session', async () => {
    mock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(api.dashboard()).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

it('uploads PDFs as multipart data with the current token and lets the browser set the boundary', async () => {
  const file = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });
  await api.documents.upload(file, 'INVOICE', {
    type: 'invoices',
    id: 'invoice-id',
  });
  const [, options] = vi.mocked(fetch).mock.lastCall!;
  const headers = options?.headers as Record<string, string>;
  expect(headers.Authorization).toBe('Bearer current-supabase-token');
  expect(headers['Content-Type']).toBeUndefined();
  const form = options?.body as FormData;
  expect(form.get('file')).toBe(file);
  expect(form.get('targetType')).toBe('invoices');
  expect(form.get('targetId')).toBe('invoice-id');
});
it('downloads PDFs through the authenticated backend rather than a public URL', async () => {
  await api.documents.download('document-id');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/documents/document-id/file'),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer current-supabase-token',
      }),
    }),
  );
});
