/**
 * ENVOLVE PHARMACEUTICALS — Zod Schemas
 * Same schemas validate on the client AND the server. One contract.
 */

import { z } from 'zod';

// ---------- Primitives ----------------------------------------------------

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[0-9]/, 'Include at least one number');

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .regex(/^[0-9]+$/, 'Phone number must contain digits only — remove spaces, dashes, or country codes')
  .min(10, 'Phone number is too short — enter a 10 or 11-digit number (e.g. 08012345678)')
  .max(11, 'Phone number is too long — enter a 10 or 11-digit number (e.g. 08012345678)');

// ---------- Auth ----------------------------------------------------------

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional().default(false),
});
export type SignInInput = z.infer<typeof signInSchema>;

// ---------- Self-onboarding (Customer) -----------------------------------

const nameField = (label: string) =>
  z.string().trim()
    .min(1, `${label} is required`)
    .max(60, `${label} is too long`)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, `${label} should only contain letters`);

const customerRegistrationFields = z.object({
  first_name: nameField('First name'),
  middle_name: z.string().trim().max(60).regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'Middle name should only contain letters').optional(),
  last_name: nameField('Last name'),
  company_name: z.string().trim().min(2, 'Pharmacy name must be at least 2 characters').max(120),
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().trim().min(5, 'Enter your full street address').max(240),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'Please select a state'),
  gender: z.string().trim().max(20).optional(),
  referral_code: z.string().trim().max(30)
    .regex(/^[a-zA-Z0-9]*$/, 'Referral code should only contain letters and numbers').optional(),
  pcn_cert_url: z.string().min(1, 'Upload your PCN certificate to continue').url('Must be a valid file URL'),
  password: passwordSchema,
  confirm_password: z.string().min(1, 'Please confirm your password'),
  accept_terms: z.boolean().refine((v) => v === true, { message: 'You must accept the terms to continue' }),
});

export const customerDetailsSchema = customerRegistrationFields.pick({
  first_name: true,
  middle_name: true,
  last_name: true,
  company_name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  referral_code: true,
});
export type CustomerDetailsInput = z.infer<typeof customerDetailsSchema>;

export const customerRegistrationSchema = customerRegistrationFields.refine(
  (data) => data.password === data.confirm_password,
  { message: 'Passwords do not match', path: ['confirm_password'] },
);
export type CustomerRegistrationInput = z.infer<typeof customerRegistrationSchema>;

// ---------- Sales agent (admin invite + import) --------------------------

export const agentInviteSchema = z.object({
  first_name: nameField('First name'),
  last_name: nameField('Last name'),
  email: emailSchema,
  phone: phoneSchema,
  region: z.string().trim().max(80).optional(),
});
export type AgentInviteInput = z.infer<typeof agentInviteSchema>;
export const agentImportRowSchema = agentInviteSchema;

// ---------- Internal staff (admin invite + import) -----------------------

export const staffInviteSchema = z.object({
  first_name: nameField('First name'),
  middle_name: z.string().trim().max(60).regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'Middle name should only contain letters').optional(),
  last_name: nameField('Last name'),
  email: emailSchema,
  phone: phoneSchema,
  department: z.string().trim().min(1, 'Department is required').max(80),
  job_title: z.string().trim().min(1, 'Job title is required').max(80),
});
export type StaffInviteInput = z.infer<typeof staffInviteSchema>;
export const staffImportRowSchema = staffInviteSchema;

// ---------- Customer (admin / agent onboarding + import) -----------------

export const customerOnboardSchema = z.object({
  first_name:   nameField('First name'),
  middle_name:  z.string().trim().max(60)
                  .regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'Middle name: letters only, no numbers or special characters')
                  .optional(),
  last_name:    nameField('Last name'),
  company_name: z.string().trim()
                  .min(2, 'Pharmacy / company name is required')
                  .max(120, 'Company name is too long (max 120 characters)'),
  email:        emailSchema,
  phone:        phoneSchema,
  address:      z.string().trim()
                  .min(5, 'Street address is too short — enter the full address')
                  .max(240, 'Address is too long'),
  // Relaxed: allow commas, brackets, etc. for real city names like "Abuja, FCT"
  city:         z.string().trim()
                  .min(2, 'City is required')
                  .max(80, 'City name is too long'),
  state:        z.string().trim()
                  .min(2, 'Please select a state from the dropdown'),
});
export type CustomerOnboardInput = z.infer<typeof customerOnboardSchema>;
export const customerImportRowSchema = customerOnboardSchema;

// ---------- Agent-led onboarding (legacy form) ---------------------------

export const agentOnboardSchema = z.object({
  company_name: z.string().min(2).max(120),
  company_address: z.string().min(8).max(240),
  fname: z.string().min(1).max(60),
  lname: z.string().min(1).max(60),
  email: emailSchema,
  phone: phoneSchema,
  pcn_cert_url: z.string().url(),
  send_invite: z.boolean().default(true),
});
export type AgentOnboardInput = z.infer<typeof agentOnboardSchema>;

// ---------- Profile -------------------------------------------------------

export const updateProfileSchema = z.object({
  fname: z.string().min(1).max(60),
  lname: z.string().min(1).max(60),
  phone: phoneSchema,
  company_address: z.string().min(8).max(240).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------- Product (Admin CRUD) -----------------------------------------

export const productSchema = z.object({
  name: z.string().min(2, 'Brand name is required').max(160),
  generic_name: z.string().min(1, 'Generic/INN name is required').max(160),
  sku: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, 'SKU may contain only A-Z, 0-9 and dashes'),
  cost_price: z.coerce.number().nonnegative('Cost price must be 0 or more').max(10_000_000),
  selling_price: z.coerce.number().positive('Selling price must be positive').max(10_000_000),
  category: z.string().min(1, 'Choose a category'),
  manufacturer: z.string().min(1).max(120),
  form: z.string().min(1).max(60),
  strength: z.string().min(1, 'Strength is required (use "N/A" if not applicable)').max(40),
  /** "1 x 6 x 25" format */
  pack_size: z.string().min(1, 'Pack size is required (e.g. "1 x 6 x 25")').max(60),
  shelf_location: z.string().trim().max(20).optional(),
  min_stock_level: z.coerce.number().int().nonnegative().optional(),
  reorder_qty: z.coerce.number().int().nonnegative().optional(),
  prescription_required: z.boolean().default(false),
  image_url: z.string().url('Provide a valid image URL'),
  status: z.enum(['active', 'draft', 'discontinued']).default('draft'),
});
export type ProductInput = z.infer<typeof productSchema>;

// Bulk-import variant: every cell arrives as a string, so coerce/normalize.
const PRODUCT_STATUS_VALUES = ['active', 'draft', 'discontinued'];
const TRUTHY = new Set(['true', 'yes', 'y', '1', 'rx', 'required']);

export const productImportRowSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(160),
  generic_name: z.string().trim().min(1, 'Generic name is required').max(160),
  sku: z
    .string()
    .trim()
    .min(3, 'SKU is required')
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, 'SKU: letters, numbers and dashes only'),
  cost_price: z.coerce.number().nonnegative('Cost price must be 0 or more').max(10_000_000),
  selling_price: z.coerce.number().positive('Selling price must be positive').max(10_000_000),
  category: z.string().trim().min(1, 'Category is required').max(80),
  manufacturer: z.string().trim().min(1, 'Manufacturer is required').max(120),
  form: z.string().trim().min(1, 'Form is required').max(60),
  strength: z.string().trim().max(40).optional(),
  pack_size: z.string().trim().max(60).optional(),
  shelf_location: z.string().trim().max(20).optional(),
  min_stock_level: z.coerce.number().int().nonnegative().optional(),
  reorder_qty: z.coerce.number().int().nonnegative().optional(),
  prescription_required: z.preprocess(
    (v) => TRUTHY.has(String(v ?? '').trim().toLowerCase()),
    z.boolean(),
  ),
  image_url: z.string().trim().optional(),
  status: z.preprocess((v) => {
    const s = String(v ?? '').trim().toLowerCase();
    return PRODUCT_STATUS_VALUES.includes(s) ? s : 'draft';
  }, z.enum(['active', 'draft', 'discontinued'])),
});
export type ProductImportRow = z.infer<typeof productImportRowSchema>;

// ---------- Inventory (Admin) --------------------------------------------

export const inventoryBatchSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  batch_no: z.string().min(1).max(40),
  quantity: z.coerce.number().int().positive(),
  expiry_date: z
    .string()
    .min(1, 'Expiry date is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
    .refine((v) => new Date(v) > new Date(), 'Expiry must be in the future'),
});
export type InventoryBatchInput = z.infer<typeof inventoryBatchSchema>;

// Receive stock (manual) + import (bulk) — keyed by SKU for human entry.
export const batchReceiveSchema = z.object({
  sku: z.string().trim().min(3, 'SKU is required').max(40),
  batch_no: z.string().trim().min(1, 'Batch number is required').max(40),
  quantity: z.coerce.number().int().positive('Quantity must be a positive whole number'),
  expiry_date: z
    .string()
    .trim()
    .min(1, 'Expiry date is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Use a valid date (YYYY-MM-DD)')
    .refine((v) => new Date(v) > new Date(), 'Expiry must be in the future'),
});
export type BatchReceiveInput = z.infer<typeof batchReceiveSchema>;
export const batchImportRowSchema = batchReceiveSchema;

// ---------- Basket / Order -----------------------------------------------

export const basketItemSchema = z.object({
  product_id: z.number().int().positive(),
  sku: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  image: z.string().url(),
  quantity: z.number().int().min(1).max(9999),
  pack_size: z.string(),
});
export type BasketItemSchema = z.infer<typeof basketItemSchema>;

export const checkoutSchema = z.object({
  state:            z.string().min(1, 'Please select your state'),
  city:             z.string().trim().min(2, 'Enter your city / LGA'),
  street_address:   z.string().trim().min(8, 'Enter a more complete street address'),
  contact_phone:    z.string().trim().regex(
                      /^(\+?234|0)[789]\d{9}$/,
                      'Enter a valid Nigerian phone number (e.g. 08012345678)',
                    ),
  delivery_notes:   z.string().max(500).optional(),
  payment_method:   z.enum(['paystack', 'bank_transfer', 'cash_on_delivery']),
  po_number:        z.string().max(40).optional(),
  paystack_reference: z.string().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ---------- Review --------------------------------------------------------

export const reviewSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(8, 'Comment must be at least 8 characters').max(1000),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

// ---------- Contact -------------------------------------------------------

export const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: emailSchema,
  company: z.string().max(120).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
});
export type ContactInput = z.infer<typeof contactSchema>;