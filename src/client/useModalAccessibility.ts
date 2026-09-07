import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Keeps keyboard focus inside the currently open application dialog. */
export function useModalAccessibility() {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let restoreElement: HTMLElement | null = null;
    let focusFrame = 0;

    const findDialog = () => {
      const semanticDialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (semanticDialog) return semanticDialog;
      const modalRoot = Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0.z-50')).find((root) => root.children.length > 0);
      return modalRoot?.lastElementChild as HTMLElement | null;
    };
    const focusables = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => element.offsetParent !== null);

    const syncDialog = () => {
      const dialog = findDialog();
      if (dialog === activeDialog) return;
      if (dialog) {
        if (!activeDialog) restoreElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        activeDialog = dialog;
        window.cancelAnimationFrame(focusFrame);
        focusFrame = window.requestAnimationFrame(() => {
          if (activeDialog !== dialog) return;
          focusables(dialog)[0]?.focus();
        });
      } else if (activeDialog) {
        activeDialog = null;
        const element = restoreElement;
        restoreElement = null;
        if (element?.isConnected) window.requestAnimationFrame(() => element.focus());
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = findDialog();
      if (!dialog) return;
      if (event.key === 'Escape') {
        const closeButton = dialog.querySelector<HTMLButtonElement>('[aria-label^="Tutup"], [title="Tutup"], button');
        if (closeButton) {
          event.preventDefault();
          closeButton.click();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusables(dialog);
      if (!elements.length) {
        event.preventDefault();
        dialog.focus();
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
    };

    const observer = new MutationObserver(syncDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('keydown', handleKeyDown);
    syncDialog();
    return () => {
      window.cancelAnimationFrame(focusFrame);
      observer.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
