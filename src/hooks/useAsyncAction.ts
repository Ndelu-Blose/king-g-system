import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

const GENERIC_ERROR = 'Something went wrong. Please try again or contact support.';

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim();
    if (/^API \d{3}$/.test(msg) || /prisma|supabase|postgres|pgrst/i.test(msg)) {
      return GENERIC_ERROR;
    }
    return msg;
  }
  return GENERIC_ERROR;
}

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
