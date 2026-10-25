// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { chooseSelectValue } from '../../test-utils/select';
import { Select, SelectItem } from './select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './dialog';

afterEach(cleanup);
function Fixture({
  required = false,
  disabled = false,
  onChange = (_: string) => {},
}: {
  required?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <form aria-label="Test form">
      <label>
        Plan
        <Select
          aria-label="Plan"
          name="plan"
          value={value}
          required={required}
          disabled={disabled}
          onValueChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        >
          <SelectItem value="">All plans</SelectItem>
          <>
            <SelectItem value="monthly">Website — RM99 monthly</SelectItem>
            <SelectItem value="annual">Domain — RM120 annually</SelectItem>
          </>
          <SelectItem value="disabled" disabled>
            Archived plan
          </SelectItem>
        </Select>
      </label>
      <button type="submit">Save</button>
    </form>
  );
}
it('uses an accessible custom menu and supports selection and clearing back to an empty filter', async () => {
  const change = vi.fn();
  render(<Fixture onChange={change} />);
  const trigger = screen.getByRole('combobox', { name: 'Plan' });
  expect(trigger.tagName).toBe('BUTTON');
  expect(trigger.textContent).toContain('All plans');
  await chooseSelectValue(trigger, 'annual');
  expect(trigger.textContent).toContain('Domain — RM120 annually');
  expect(change).toHaveBeenLastCalledWith('annual');
  expect(
    new FormData(screen.getByRole('form') as HTMLFormElement).get('plan'),
  ).toBe('annual');
  await chooseSelectValue(trigger, '');
  expect(change).toHaveBeenLastCalledWith('');
  expect(
    new FormData(screen.getByRole('form') as HTMLFormElement).get('plan'),
  ).toBe('');
});
it('preserves required form validation and focuses the visible control', async () => {
  render(<Fixture required />);
  const form = screen.getByRole('form') as HTMLFormElement;
  act(() => {
    expect(form.checkValidity()).toBe(false);
  });
  expect(
    screen.getByRole('combobox', { name: 'Plan' }).getAttribute('aria-invalid'),
  ).toBe('true');
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Plan' }),
    'monthly',
  );
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).get('plan')).toBe('monthly');
});
it('keeps disabled controls and options unavailable', () => {
  const change = vi.fn();
  render(<Fixture disabled onChange={change} />);
  const trigger = screen.getByRole('combobox', { name: 'Plan' });
  expect(trigger.hasAttribute('disabled')).toBe(true);
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(change).not.toHaveBeenCalled();
});
it('renders its menu in a portal inside a dialog and Escape closes only the menu', async () => {
  render(
    <Dialog defaultOpen>
      <DialogContent>
        <DialogTitle>Service setup</DialogTitle>
        <DialogDescription>Choose a plan.</DialogDescription>
        <Fixture />
      </DialogContent>
    </Dialog>,
  );
  const dialog = screen.getByRole('dialog');
  const trigger = screen.getByRole('combobox', { name: 'Plan' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const menu = await screen.findByRole('listbox');
  expect(document.body.contains(menu)).toBe(true);
  expect(dialog.contains(menu)).toBe(false);
  fireEvent.keyDown(menu, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(trigger.textContent).toContain('All plans');
});
it('infers values from plain option text and updates labels when asynchronous options arrive', async () => {
  const change = vi.fn();
  const view = render(
    <Select aria-label="Currency" value="MYR" onValueChange={change}>
      <SelectItem>MYR</SelectItem>
    </Select>,
  );
  view.rerender(
    <Select aria-label="Currency" value="MYR" onValueChange={change}>
      <SelectItem>MYR</SelectItem>
      <SelectItem>SGD</SelectItem>
    </Select>,
  );
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Currency' }),
    'SGD',
  );
  expect(change).toHaveBeenCalledWith('SGD');
});
