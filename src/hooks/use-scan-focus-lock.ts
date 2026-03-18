import { useEffect, useRef, useCallback } from 'react';

export function useScanFocusLock(options: {
  enabled: boolean;
  isBlocked: boolean; // true when Payment modal / Manual mode open
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const focusScan = useCallback(() => {
    if (!options.enabled || options.isBlocked) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [options.enabled, options.isBlocked]);

  useEffect(() => {
    focusScan();
  }, [focusScan]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (options.isBlocked) return;
      if (e.key === 'F2') {
        e.preventDefault();
        focusScan();
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      if (options.isBlocked) return;
      const el = e.target as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const isFormField =
        tag === 'input' ||
        tag === 'textarea' ||
        (el as HTMLElement & { isContentEditable?: boolean }).isContentEditable;
      if (!isFormField) focusScan();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [options.enabled, options.isBlocked, focusScan]);

  return { inputRef, focusScan };
}
