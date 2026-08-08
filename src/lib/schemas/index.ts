import { z } from 'zod';

/**
 * Shared Zod schemas.
 *
 * Only schemas with live consumers live here. API routes that validate their
 * own request bodies declare those schemas inline, next to the handler.
 */

const emailSchema = z
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

const nameField = (label: string) =>
  z.string().trim()
    .min(1, `${label} is required`)
    .max(60, `${label} is too long`)
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, `${label} should only contain letters`);

/** Step 1 of the public customer sign-up wizard. */
export const customerDetailsSchema = z.object({
  first_name:    nameField('First name'),
  middle_name:   z.string().trim().max(60)
                   .regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'Middle name should only contain letters')
                   .optional(),
  last_name:     nameField('Last name'),
  company_name:  z.string().trim().min(2, 'Pharmacy name must be at least 2 characters').max(120),
  email:         emailSchema,
  phone:         phoneSchema,
  address:       z.string().trim().min(5, 'Enter your full street address').max(240),
  city:          z.string().trim().min(2, 'City is required').max(80),
  state:         z.string().trim().min(2, 'Please select a state'),
  referral_code: z.string().trim().max(30)
                   .regex(/^[a-zA-Z0-9]*$/, 'Referral code should only contain letters and numbers')
                   .optional(),
});

/** Admin/staff onboarding a customer from the console, and the bulk-import row. */
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
export const customerImportRowSchema = customerOnboardSchema;

/** Customer checkout — delivery details plus payment selection. */
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
