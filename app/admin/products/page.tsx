import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PageHead } from '@/components/shared/PageHead';
import { ButtonLink } from '@/components/ui/Button';
import { Plus } from '@/components/icons';
import { ProductsList } from './ProductList';
import { ProductsImport } from './ProductsImport';
import { QuickProductsImport } from './QuickProductsImport';

export const metadata = {
  title: 'Products',
};

export default async function ConsoleProductsPage() {
  const session = await getSession();
  if (!session) redirect('/staff/sign-in');
  if (!['ADMIN', 'STAFF'].includes(session.role)) redirect('/admin/overview');

  const isAdmin = session.role === 'ADMIN';

  return (
    <>
      <PageHead
        title="Products"
        subtitle="The catalog — pricing, photos, prescription flags, and lifecycle status."
        actions={
          isAdmin ? (
            <>
              <QuickProductsImport />
              <ProductsImport />
              <ButtonLink href="/admin/products/new" leadingIcon={<Plus size={14} />}>
                New product
              </ButtonLink>
            </>
          ) : undefined
        }
      />
      <ProductsList isAdmin={isAdmin} />
    </>
  );
}