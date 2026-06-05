'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Upload } from '@/components/icons';
import { SheetImporter } from '@/components/console/SheetImporter';
import { productImportRowSchema, type ProductImportRow } from '@/lib/schemas';
import { importProductsAction } from '@/lib/actions/console';

const COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'sku', label: 'SKU', required: true },
  { key: 'description', label: 'Description', required: true },
  { key: 'price', label: 'Price', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'manufacturer', label: 'Manufacturer', required: true },
  { key: 'form', label: 'Form', required: true },
  { key: 'strength', label: 'Strength' },
  { key: 'pack_size', label: 'Pack size' },
  { key: 'prescription_required', label: 'Rx (yes/no)' },
  { key: 'image_url', label: 'Image URL' },
  { key: 'status', label: 'Status (active/draft/discontinued)' },
];

export function ProductsImport() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" leadingIcon={<Upload size={14} />} onClick={() => setOpen(true)}>
        Import
      </Button>
      <SheetImporter<ProductImportRow>
        open={open}
        onClose={() => setOpen(false)}
        title="Import products"
        columns={COLUMNS}
        schema={productImportRowSchema}
        action={importProductsAction}
        templateName="products_template.xlsx"
      />
    </>
  );
}