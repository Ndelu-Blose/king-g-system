import { useEffect, useRef, useCallback } from 'react';

function dialogIsOpen() {
  return document.querySelector('[role="dialog"]') != null;
}

export function useScanFocusLock(options: {
  enabled: boolean;
  isBlocked: boolean; // true when Payment modal / Manual mode open
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const focusScan = useCallback(() => {
    if (!options.enabled || options.isBlocked) return;
    if (dialogIsOpen()) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [options.enabled, options.isBlocked]);

  useEffect(() => {
    focusScan();
  }, [focusScan]);

  useEffect(() => {
    if (!options.enabled || options.isBlocked) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        focusScan();
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      if (dialogIsOpen()) return;
      const el = e.target as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const isFormField =
        tag === 'input' ||
        tag === 'textarea' ||
        (el as HTMLElement & { isContentEditable?: boolean }).isContentEditable;
      if (!isFormField) focusScan();
    };

    // After the cashier closes Open Shift, focus often falls on the page body.
    const onFocusIn = () => {
      if (dialogIsOpen()) return;
      const active = document.activeElement;
      if (active === inputRef.current) return;
      if (active === document.body || active === document.documentElement) focusScan();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [options.enabled, options.isBlocked, focusScan]);

  return { inputRef, focusScan };
}
