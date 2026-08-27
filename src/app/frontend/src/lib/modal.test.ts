import { describe, expect, it, vi } from 'vitest';
import { activateModal, handleModalKeydown } from './modal';

function modalFixture() {
  document.body.innerHTML = `
    <button id="before">Before</button>
    <div id="dialog" tabindex="-1">
      <button id="first">First</button>
      <button id="last">Last</button>
    </div>
  `;
  return {
    before: document.querySelector<HTMLElement>('#before')!,
    dialog: document.querySelector<HTMLElement>('#dialog')!,
    first: document.querySelector<HTMLElement>('#first')!,
    last: document.querySelector<HTMLElement>('#last')!,
  };
}

describe('modal keyboard utilities', () => {
  it('moves focus into the modal and restores the previous control', () => {
    const { before, dialog, first } = modalFixture();
    before.focus();

    const restore = activateModal(dialog);
    expect(document.activeElement).toBe(first);

    restore();
    expect(document.activeElement).toBe(before);
  });

  it('closes on Escape', () => {
    const { dialog } = modalFixture();
    const close = vi.fn();
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

    handleModalKeydown(event, dialog, close);

    expect(close).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps Tab focus from the last control to the first', () => {
    const { dialog, first, last } = modalFixture();
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });

    handleModalKeydown(event, dialog, vi.fn());

    expect(document.activeElement).toBe(first);
    expect(event.defaultPrevented).toBe(true);
  });
});
