const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.hasAttribute('hidden'));
}

export function activateModal(container: HTMLElement): () => void {
  const previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const first = focusableElements(container)[0] ?? container;
  first.focus();
  return () => previousFocus?.focus();
}

export function handleModalKeydown(
  event: KeyboardEvent,
  container: HTMLElement,
  close: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab') return;

  const elements = focusableElements(container);
  if (elements.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
