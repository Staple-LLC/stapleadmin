import { useSyncExternalStore } from 'react';

const key = 'staple-financial-test-preview';
const eventName = 'staple-financial-preview-change';
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  return () => window.removeEventListener(eventName, callback);
}
export function useFinancialPreview() {
  const enabled = useSyncExternalStore(
    subscribe,
    () => sessionStorage.getItem(key) === 'true',
    () => false,
  );
  return [
    enabled,
    (value: boolean) => {
      sessionStorage.setItem(key, String(value));
      window.dispatchEvent(new Event(eventName));
    },
  ] as const;
}
export function FinancialPreviewToggle() {
  const [enabled, setEnabled] = useFinancialPreview();
  return (
    <div className="financial-preview">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />{' '}
        Include test payments
      </label>
      {enabled && (
        <p role="status">
          Sandbox preview: totals, charts and exports include test invoices,
          payments and refunds. Test rows are marked [TEST]. Turn this off for
          your real financial figures.
        </p>
      )}
    </div>
  );
}
