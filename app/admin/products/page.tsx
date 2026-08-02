/**
 * Console · Products (admin-only). The catalog: what we sell and its
 * commercial attributes. Stock lives on the Inventory page, not here.
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { ButtonLink } from '@/components/ui/Button';
import { Plus } from '@/components/icons';
import { ProductsList } from './ProductList';
import { ProductsImport } from './ProductsImport';


export const metadata = {
  title: 'Products',
};

export default async function ConsoleProductsPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (session.role !== 'ADMIN') redirect('/admin/overview');

  return (
    <>
      <PageHead
        title="Products"
        subtitle="The catalog — pricing, photos, prescription flags, and lifecycle status."
        actions={
          <>
            <ProductsImport />
            <ButtonLink href="/admin/products/new" leadingIcon={<Plus size={14} />}>
              New product
            </ButtonLink>
          </>
        }
      />
      <ProductsList />
    </>
  );
}