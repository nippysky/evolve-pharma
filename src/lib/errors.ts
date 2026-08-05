
export function parseError(err: unknown): string {
  const raw = extractMessage(err);
  return humanise(raw);
}

function extractMessage(err: unknown): string {
  if (!err) return '';

  // Standard Error objects
  if (err instanceof Error) return err.message.trim();

  // Plain strings
  if (typeof err === 'string') return err.trim();

  // Objects with a message field (e.g. API response bodies thrown as objects)
  if (typeof err === 'object' && 'message' in err) {
    return String((err as Record<string, unknown>).message).trim();
  }

  return '';
}

function humanise(msg: string): string {
  if (!msg) return 'An unexpected error occurred. Please try again.';

  const lo = msg.toLowerCase();

  // ── Network / connectivity ─────────────────────────────────────────────────
  if (
    lo.includes('failed to fetch') ||
    lo.includes('network error') ||
    lo.includes('networkerror') ||
    lo.includes('econnrefused') ||
    lo.includes('enotfound') ||
    lo.includes('unable to reach')
  ) {
    return 'Could not connect to our servers. Please check your internet connection and try again.';
  }

  // ── Timeout / abort ───────────────────────────────────────────────────────
  if (lo.includes('timeout') || lo.includes('aborted') || lo.includes('abortError'.toLowerCase())) {
    return 'The request took too long. Please try again.';
  }

  // ── Internal server error (generic) ──────────────────────────────────────
  if (lo.includes('internal server error') || lo === '500' || lo.includes('server error')) {
    return 'Something went wrong on our end. Please try again, or contact support if this keeps happening.';
  }

  // ── Service unavailable ───────────────────────────────────────────────────
  if (
    lo.includes('temporarily unavailable') ||
    lo.includes('service unavailable') ||
    lo === '502' ||
    lo === '503' ||
    lo === '504'
  ) {
    return 'Our servers are temporarily unavailable. Please try again in a moment.';
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (lo.includes('too many requests') || lo.includes('rate limit') || lo === '429') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  // ── Not implemented (dev stub leaked) ────────────────────────────────────
  if (lo.includes('not implemented') || lo.includes('stub')) {
    return 'This feature is currently unavailable. Please try again shortly.';
  }

  // ── Prisma / database errors ──────────────────────────────────────────────
  if (lo.startsWith('p2') || lo.includes('unique constraint') || lo.includes('foreign key')) {
    return 'A database conflict occurred. Please try again or contact support.';
  }

  // ── Good message from our API — pass through unchanged ────────────────────
  return msg;
}

/**
 * Maps login errors to display categories.
 * Returns `'credentials'`, `'pending'`, `'suspended'`, `'rate_limit'`,
 * `'network'`, or `'generic'`.
 */
export type LoginErrorKind =
  | 'credentials'
  | 'pending'
  | 'suspended'
  | 'rate_limit'
  | 'network'
  | 'generic';

export function classifyLoginError(err: unknown): { kind: LoginErrorKind; message: string } {
  const raw = extractMessage(err);
  const lo  = raw.toLowerCase();

  if (lo.includes('pending') || lo.includes('under review') || lo.includes('awaiting')) {
    return { kind: 'pending', message: raw };
  }

  if (lo.includes('suspended') || lo.includes('deactivated')) {
    return {
      kind: 'suspended',
      message: raw || 'Your account has been suspended. Please contact support.',
    };
  }

  if (
    lo.includes('invalid') ||
    lo.includes('incorrect') ||
    lo.includes('wrong') ||
    lo.includes('not found') ||
    lo.includes('credential')
  ) {
    return {
      kind: 'credentials',
      message: 'Incorrect email or password. Please double-check and try again.',
    };
  }

  if (lo.includes('too many') || lo.includes('rate') || lo === '429') {
    return {
      kind: 'rate_limit',
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    };
  }

  if (lo.includes('fetch') || lo.includes('network') || lo.includes('connect')) {
    return {
      kind: 'network',
      message:
        'Our servers appear to be temporarily unavailable. Please try again in a moment.',
    };
  }

  return { kind: 'generic', message: humanise(raw) };
}
