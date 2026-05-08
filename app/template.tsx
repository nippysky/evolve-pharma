/**
 * Page transition template.
 *
 * Re-mounts on every route change (unlike layout.tsx), which gives us a
 * clean opportunity to fade content in. The motion is intentionally tiny:
 * 4px translate + opacity, ~280ms, smooth ease-out curve. Anything more
 * starts to feel theatrical instead of considered.
 */

import type { ReactNode } from 'react';

export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}