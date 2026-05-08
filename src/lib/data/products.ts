/**
 * ENVOLVE PHARMACEUTICALS — Mock Product Catalog
 *
 * Replace this file's exports with real API calls when the PHP backend
 * is ready. Function signatures (`getAllProducts`, `getProductBySku`)
 * stay stable — only their bodies change.
 */

import type { Product } from '@/types';

const now = new Date().toISOString();

export const PRODUCTS: Product[] = [
  {
    id: 1,
    uuid: 'p-001',
    name: 'Amoxicillin 500mg',
    description:
      'Broad-spectrum penicillin antibiotic for bacterial infections of the respiratory tract, ear, urinary tract and skin. WHO-prequalified manufacturer; supplied in moisture-resistant blister packs.',
    sku: 'AMX-500-30',
    price: 4_800,
    category: 'Antibiotics',
    manufacturer: 'GSK Nigeria',
    form: 'Capsule',
    strength: '500mg',
    pack_size: '30 capsules / pack',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 2,
    uuid: 'p-002',
    name: 'Paracetamol 500mg',
    description:
      'Fast-acting analgesic and antipyretic. Trusted relief for fever, headache and mild-to-moderate pain. Compliant with NAFDAC standards.',
    sku: 'PCM-500-100',
    price: 1_200,
    category: 'Analgesics',
    manufacturer: 'Emzor Pharmaceuticals',
    form: 'Tablet',
    strength: '500mg',
    pack_size: '100 tablets / pack',
    prescription_required: false,
    image_url:
      'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 3,
    uuid: 'p-003',
    name: 'Artemether-Lumefantrine 80/480mg',
    description:
      'First-line ACT therapy for uncomplicated Plasmodium falciparum malaria. Co-formulated for adherence; suitable for adults and adolescents.',
    sku: 'ALU-80480-24',
    price: 2_900,
    category: 'Antimalarials',
    manufacturer: 'May & Baker',
    form: 'Tablet',
    strength: '80/480mg',
    pack_size: '24 tablets / pack',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 4,
    uuid: 'p-004',
    name: 'Vitamin C 1000mg Effervescent',
    description:
      'High-strength vitamin C with bioflavonoids. Supports immune function and antioxidant defence. Effervescent format for rapid absorption.',
    sku: 'VTC-1000-20',
    price: 3_400,
    category: 'Vitamins & Supplements',
    manufacturer: 'Bayer',
    form: 'Tablet',
    strength: '1000mg',
    pack_size: '20 effervescent tabs',
    prescription_required: false,
    image_url:
      'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 5,
    uuid: 'p-005',
    name: 'Lisinopril 10mg',
    description:
      'ACE inhibitor for the management of hypertension and heart failure. Once-daily dosing for steady blood pressure control.',
    sku: 'LSP-10-30',
    price: 5_600,
    category: 'Cardiovascular',
    manufacturer: 'Fidson Healthcare',
    form: 'Tablet',
    strength: '10mg',
    pack_size: '30 tablets / pack',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 6,
    uuid: 'p-006',
    name: 'Metformin 500mg',
    description:
      'First-line oral antihyperglycaemic agent for type 2 diabetes. Improves glycaemic control with minimal hypoglycaemia risk.',
    sku: 'MTF-500-100',
    price: 4_200,
    category: 'Antidiabetics',
    manufacturer: 'Neimeth',
    form: 'Tablet',
    strength: '500mg',
    pack_size: '100 tablets / pack',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1626716493137-b67fe9501e76?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 7,
    uuid: 'p-007',
    name: 'Salbutamol Inhaler 100mcg',
    description:
      'Short-acting bronchodilator for the relief of bronchospasm in asthma and COPD. CFC-free metered-dose inhaler.',
    sku: 'SLB-100-200D',
    price: 6_800,
    category: 'Respiratory',
    manufacturer: 'GSK Nigeria',
    form: 'Inhaler',
    strength: '100mcg/dose',
    pack_size: '200-dose canister',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 8,
    uuid: 'p-008',
    name: 'Omeprazole 20mg',
    description:
      'Proton pump inhibitor for gastro-oesophageal reflux disease, peptic ulcer disease and Zollinger-Ellison syndrome.',
    sku: 'OMP-20-28',
    price: 3_900,
    category: 'Gastrointestinal',
    manufacturer: 'Sanofi',
    form: 'Capsule',
    strength: '20mg',
    pack_size: '28 capsules / pack',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 9,
    uuid: 'p-009',
    name: 'Hydrocortisone 1% Cream',
    description:
      'Topical corticosteroid for short-term relief of mild eczema, contact dermatitis and insect-bite reactions.',
    sku: 'HCT-1-30G',
    price: 2_100,
    category: 'Dermatologicals',
    manufacturer: 'Pfizer',
    form: 'Cream',
    strength: '1%',
    pack_size: '30g tube',
    prescription_required: false,
    image_url:
      'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 10,
    uuid: 'p-010',
    name: 'Fluconazole 150mg',
    description:
      'Single-dose triazole antifungal for vulvovaginal candidiasis. Also indicated for systemic mycoses.',
    sku: 'FLZ-150-1',
    price: 1_800,
    category: 'Antifungals',
    manufacturer: 'Pfizer',
    form: 'Capsule',
    strength: '150mg',
    pack_size: '1 capsule',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 11,
    uuid: 'p-011',
    name: 'Multivitamin Syrup',
    description:
      'Paediatric multivitamin syrup with iron and B-complex. Pleasant orange flavour; gluten-free.',
    sku: 'MVS-100ML',
    price: 2_700,
    category: 'Vitamins & Supplements',
    manufacturer: 'Emzor Pharmaceuticals',
    form: 'Syrup',
    strength: 'Multi',
    pack_size: '100ml bottle',
    prescription_required: false,
    image_url:
      'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
  {
    id: 12,
    uuid: 'p-012',
    name: 'Ciprofloxacin 500mg',
    description:
      'Fluoroquinolone antibiotic for urinary, respiratory and gastrointestinal infections. Reserved per stewardship guidelines.',
    sku: 'CPF-500-10',
    price: 2_400,
    category: 'Antibiotics',
    manufacturer: 'May & Baker',
    form: 'Tablet',
    strength: '500mg',
    pack_size: '10 tablets / pack',
    prescription_required: true,
    image_url:
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_by: 1,
    created_at: now,
    updated_at: now,
  },
];

// ---------- Query helpers (swap with real fetches later) ----------------

export function getAllProducts(): Product[] {
  return PRODUCTS;
}

export function getProductBySku(sku: string): Product | null {
  return PRODUCTS.find((p) => p.sku === sku) ?? null;
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

export function searchProducts(q: string): Product[] {
  const term = q.trim().toLowerCase();
  if (!term) return PRODUCTS;
  return PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.manufacturer.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term),
  );
}

export function getRelatedProducts(sku: string, n = 4): Product[] {
  const target = getProductBySku(sku);
  if (!target) return [];
  return PRODUCTS.filter((p) => p.category === target.category && p.sku !== sku).slice(0, n);
}
