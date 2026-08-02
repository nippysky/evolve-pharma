import Link from 'next/link';
import { ArrowLeft } from '@/components/icons';
import { PageHead } from '@/components/shared/PageHead';
import { ProductForm } from '@/components/console/ProductForm';

export default function NewProductPage() {
  return (
    <>
      <Link
        href="/admin/products"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to products
      </Link>

      <PageHead title="New product" subtitle="Add a SKU to the catalog." />

      <div className="max-w-3xl">
        <ProductForm mode="create" />
      </div>
    </>
  );
}
