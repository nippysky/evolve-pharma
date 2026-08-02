/**
 * Console · Product Detail / Edit
 *
 * Full implementation in Module 4 — fetches from GET /api/products/:sku
 * and submits edits to PATCH /api/products/:sku.
 */

import { PageHead }   from '@/components/shared/PageHead';
import { EmptyState } from '@/components/ui/Primitives';
import { Box }        from '@/components/icons';

interface Props {
  params: Promise<{ sku: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { sku } = await params;

  return (
    <>
      <PageHead
        title={`Product — ${sku}`}
        subtitle="Product detail and edit form."
      />
      <EmptyState
        icon={<Box size={24} />}
        title="Product detail coming soon"
        description="Full edit form wired in Module 4."
      />
    </>
  );
}
