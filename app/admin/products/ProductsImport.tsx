'use client';

/**
 * Products · Bulk Import
 *
 * Full implementation in Module 4 — wired to POST /api/products/bulk-import.
 * Renders a clean empty state until then.
 */

import { Upload } from '@/components/icons';
import { EmptyState } from '@/components/ui/Primitives';

export function ProductsImport() {
  return (
    <EmptyState
      icon={<Upload size={22} />}
      title="Bulk import coming soon"
      description="Upload a spreadsheet to add multiple products at once. Available in Module 4."
    />
  );
}
