# Staple OS frontend

React + TypeScript + Vite, Tailwind CSS, shadcn/ui primitives (Radix), and TanStack Query. The sibling `../stapleadmin-backend` is a Java 21 / Spring Boot modular monolith. Both repositories were empty at the start of this implementation.

## Run locally

1. Follow the backend README to configure the OS business database and the shared CMS Supabase Auth project.
2. Run `npm ci` and `npm run dev` (Node 22+).
3. Configure `.env` using `.env.example`, then open the URL printed by Vite and sign in with your CMS account. The first owner is explicitly linked by Supabase user UUID in the backend environment.

The development server proxies `/api` to `http://localhost:8080`. The Supabase SDK is used **only for Auth**. Business data still passes through the typed Spring API client. Set `VITE_SUPABASE_AUTH_URL` and `VITE_SUPABASE_AUTH_PUBLISHABLE_KEY` to the CMS project's Auth origin/public key. The OS database remains separate. No database password, service-role key or integration secret belongs in frontend configuration.

Leave `VITE_API_BASE_URL` empty for the proxy or same-origin deployment. Changing a direct API origin requires a matching entry in the backend’s comma-separated `FRONTEND_ORIGIN` list. Docker accepts the two public Auth values as build arguments; backend Compose files supply them automatically. Rebuild the frontend image when changing Auth configuration.
Run `npm test` for Auth/session and API-client tests. Run `npm run build` for the TypeScript check and production bundle; `npm run format:check` checks formatting. Docker Compose in the backend repository builds both sibling repositories and serves this frontend at port 5173. The frontend Docker image uses an unprivileged Nginx server with a same-origin `/api` proxy and SPA fallback. Put HTTPS termination in front of it in production.

## Working foundation

- Shared Supabase sign-in, automatic refresh, password recovery and role-aware protected routes.
- Customer portal with explicit business memberships and read-only invoices, isolated from staff APIs.
- Customer, lead and website CRUD with search, status filters, sorting and pagination.
- Issued invoices with multiple line items, customer billing snapshots and server-calculated decimal totals; read-only after issue.
- Append-only expense recording with explicit currency and transaction date. The Expenses list also shows active workbook expenses, with source labels, source filtering, description/reference search and date/amount sorting.
- Dashboard queries PostgreSQL-derived counts, invoiced totals, verified receipts, expenses and remaining receivables; currencies remain separate.
- Financial overview combines worksheet income, verified provider receipts and native expenses using a shared month/year/all-time/custom date filter and currency. Collected sales, expenses and income less expenses show lifetime comparisons; outstanding and overdue invoices are explicitly current balances. Animated charts, expense categories, monthly figures and searchable transactions use the selected dates. Purchased assets remain separate, and operations appear in a compact row.
- Open an invoice's details and choose **Link recorded income** to apply an existing receipt without increasing collected sales. Partial receipts are supported, and an incorrect link can be removed. Linked income is locked against editing until its links are removed; verified provider payments are read-only in the worksheet.
- Empty, loading, validation and error states. Customer pickers search/paginate through the API (100 matching options at a time).

Supabase manages access/refresh tokens in application-scoped localStorage. Sessions restore on reload; sign-out clears private query state and requests local-session revocation from Supabase. Each API call uses the current SDK token. Spring verifies identity through Supabase's `/auth/v1/user`, then rechecks the staff role/enabled flag and customer membership in OS PostgreSQL. Email or user metadata never grants staff access. Same account credentials work in CMS and OS; automatic cross-domain SSO is not implemented.

A customer without linked businesses sees their shared account UUID and an access-pending screen. Use that UUID with the owner-only membership API. To bootstrap your first owner, sign in, copy your displayed account ID, set backend `BOOTSTRAP_OWNER_USER_ID` / `BOOTSTRAP_OWNER_EMAIL`, restart the backend and sign in again. Existing local OS passwords are retired; use an existing CMS Auth account or create/invite an account through the shared project's Authentication tools.

For password recovery, add the exact OS `http://localhost:5173/auth/reset` development URL (and the production HTTPS equivalent) to **Supabase Auth → URL Configuration → Redirect URLs** in the CMS project. Configure email delivery there. The PKCE flow requires the link to open in the same browser/profile that requested it; a different tab is supported. Password changes affect the shared account in both applications.
The typed API boundary is `src/lib/api.ts`. TanStack Query owns server state and mutations invalidate affected lists and dashboard totals. Financial display uses `Intl.NumberFormat`; monetary calculations are exclusively server-side `BigDecimal`. The API serializes decimals as strings to preserve precision. Only display formatting converts them to JavaScript numbers; persisted totals are calculated on the server.

## Deliberately deferred

Stripe checkout and signed webhooks are implemented but require backend credentials and sandbox validation before activation. Registrar renewal, CMS entitlement provisioning and OS email delivery remain deferred. Historical invoice matching records a staff-confirmed allocation of income already saved; it does not charge a customer or claim provider verification. Credit notes, generated invoice PDFs, lead conversion/Kanban and remaining long-term modules follow later. A website's CMS flag records metadata; it does not call Staple CMS.

See the backend `ARCHITECTURE.md` for the data model, authorization matrix, security boundaries and phased rollout. Development data used during verification lives only in a disposable local database; no demo records are seeded into normal deployments.

See the backend `docs/financial-tracker.md` for the private workbook import command, source reconciliation and initial adoption behavior. The original workbook and extracted financial data are not shipped in the frontend bundle. After initial adoption, edit records in OS; the local XLSX does not synchronize with PostgreSQL.

## PDF invoices and receipts

Documents stores existing invoice/receipt PDFs without creating financial records. Open an invoice or expense with View / PDFs to attach files to that record, including workbook expenses. OWNER and FINANCE can upload and download; the staff library is not exposed to customer accounts. PDFs may be up to 10 MB and must be readable and unencrypted. Local development storage works by default; configure the backend’s Supabase Storage credentials for cloud storage. See `stapleadmin-backend/docs/pdf-documents.md`.

## Financial spreadsheet view

Open Financial records to edit saved transactions and assets in a workbook with Transaction Log, Monthly Summary, Category Breakdown and Investments / Assets tabs. Use the reporting-year filter, sticky row/column headers, keyboard cell navigation, Shift selection, Copy cells and Export CSV. Text row filters do not change totals, and CSV exports include the full selected sheet. Existing charts remain on Overview. Monthly totals and margins come from Spring using decimal arithmetic. New native expenses and worksheet transactions feed the same saved totals. Double-click or Enter/F2 to edit, then Save cell; use Edit row / PDFs for full fields and attachments. Summary sheets are calculated. Currency filters keep totals separate, and version checks reject conflicting saves. Migration V6 preserves imported history and existing PDF links.

The unified overview requires backend migration V9, applied by Flyway on backend startup. Restart the backend after updating it, then refresh the frontend. Past receipts keep their original dates when linked to an invoice. If a historical payment is missing, add one income record with its actual receipt date, then link it from the invoice. Do not re-enter an existing worksheet receipt. Existing invoices are never automatically marked paid during migration.

## Billing

Open **Billing** for Customer services, Invoices, Payments and Plans. Use **Services & billing** on a customer for their filtered records. Seeded plans are RM99/month, RM1500 one-time website, and a quoted annual domain renewal/management plan. Choose automatic card billing, a payment link per cycle, or bank transfer. Customer checkout needs no Staple account. Domains are managed in Websites or the Managed domains section in Billing.

Restart the backend to apply V10/V11 before using Billing. Stripe defaults to DISABLED; configure the backend's `STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLIC_BASE_URL` and optional `STRIPE_FPX_ENABLED` as described in `../stapleadmin-backend/docs/billing.md`. Test invoices and payments are labelled and excluded from your real financial overview. Browser return pages never claim a verified payment. Website and domain cancellation are independent; registrar renewal still requires an actual renewal with the registrar.
