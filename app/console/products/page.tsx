/**
 * Console · Products (admin-only).
 *
 * Server component handles RBAC server-side; the interactive list
 * (search + category filter) lives in `ProductsList.tsx` as a client
 * component which imports its own data — keeping the boundary thin.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { ButtonLink } from '@/components/ui/Button';
import { Plus } from '@/components/icons';
import { ProductsList } from './ProductList';


export const metadata = {
  title: 'Products',
};

export default async function ConsoleProductsPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/console/overview');

  return (
    <>
      <PageHead
        title="Products"
        subtitle="Catalog SKUs available for order. Edit pricing, photos, and prescription flags."
        actions={
          <ButtonLink href="/console/products/new" leadingIcon={<Plus size={14} />}>
            New product
          </ButtonLink>
        }
      />
      <ProductsList />
    </>
  );
}