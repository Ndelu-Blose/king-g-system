import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { friendlyErrorMessage } from '@/lib/friendly-error';

export { friendlyErrorMessage };

export type AsyncActionOptions = {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

/**
 * Wraps an async handler with loading state and duplicate-click prevention.
 */
export function useAsyncAction<T extends unknown[]>(
  action: (...args: T) => Promise<void>,
  options: AsyncActionOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (...args: T) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      try {
        await action(...args);
        if (options.successMessage) toast.success(options.successMessage);
        options.onSuccess?.();
      } catch (error) {
        const message = options.errorMessage ?? friendlyErrorMessage(error);
        toast.error(message);
        options.onError?.(error);
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [action, options]
  );

  return { run, loading };
}
