import { fireEvent, screen, waitFor } from '@testing-library/react';

// jsdom does not implement the browser layout/pointer APIs used by Radix Select.
if (!Element.prototype.scrollIntoView)
  Element.prototype.scrollIntoView = () => {};
if (!Element.prototype.hasPointerCapture)
  Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture)
  Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture)
  Element.prototype.releasePointerCapture = () => {};
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

export async function chooseSelectValue(control: HTMLElement, value: string) {
  await waitFor(() => {
    if (control.matches(':disabled'))
      throw new Error('Select is still disabled');
  });
  fireEvent.keyDown(control, { key: 'ArrowDown' });
  let option: HTMLElement | undefined;
  await waitFor(() => {
    option = screen
      .getAllByRole('option')
      .find((item) => item.dataset.value === value);
    if (!option) throw new Error('Option has not loaded: ' + value);
  });
  fireEvent.keyDown(option!, { key: 'Enter' });
}
