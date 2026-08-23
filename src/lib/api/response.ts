import { NextResponse } from 'next/server';

export interface PaginationMeta {
  current_page: number;
  per_page:     number;
  total:        number;
  total_pages:  number;
}

export interface ApiSuccessBody<T = unknown> {
  status:  'success';
  message: string;
  data:    T;
}

export interface ApiErrorBody {
  status:  'error';
  message: string;
  errors?: Record<string, string[]>; // field-level validation errors
}

export interface PaginatedData<T> {
  records:    T[];
  pagination: PaginationMeta;
}

export function apiSuccess<T>(
  data:    T,
  status = 200,
  message = 'Success',
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ status: 'success', message, data }, { status });
}

export function apiPaginated<T>(
  records: T[],
  meta: {
    page:    number;
    limit:   number;
    total:   number;
  },
  message = 'Success',
): NextResponse<ApiSuccessBody<PaginatedData<T>>> {
  return NextResponse.json({
    status: 'success',
    message,
    data: {
      records,
      pagination: {
        current_page: meta.page,
        per_page:     meta.limit,
        total:        meta.total,
        total_pages:  Math.ceil(meta.total / meta.limit),
      },
    },
  });
}

export function apiError(
  message: string,
  status  = 400,
  errors?: Record<string, string[]>,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { status: 'error', message };
  if (errors) body.errors = errors;
  return NextResponse.json(body, { status });
}

export const apiUnauthorized = (msg = 'Your session has expired. Please sign in again.') =>
  apiError(msg, 401);

export const apiForbidden = (msg = 'You don\'t have permission to perform this action.') =>
  apiError(msg, 403);

export const apiNotFound = (entity = 'Resource') =>
  apiError(`${entity} not found.`, 404);

export const apiInternalError = (
  msg = 'Something went wrong on our end. Please try again, or contact support if this keeps happening.',
) => apiError(msg, 500);

/**
 * Maps known Prisma error codes to user-readable API errors.
 * Returns `null` if `err` is not a recognised Prisma error — callers
 * should fall back to `apiInternalError()` in that case.
 *
 * Usage:
 *   } catch (err) {
 *     console.error('[route]', err);
 *     return handlePrismaError(err) ?? apiInternalError();
 *   }
 */
export function handlePrismaError(err: unknown): NextResponse<ApiErrorBody> | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, unknown>;
  if (typeof e.code !== 'string') return null;

  switch (e.code) {
    case 'P2002': {
      // Unique constraint violation — inspect the target fields
      const rawTarget = (e.meta as Record<string, unknown>)?.target;
      const targets: string[] = Array.isArray(rawTarget) ? (rawTarget as string[]) : [];
      if (targets.some((f) => f.includes('email'))) {
        return apiError('An account with this email address already exists.', 409);
      }
      if (targets.some((f) => f.includes('identity_key'))) {
        return apiError(
          'This product is already in the catalogue — same manufacturer, brand, strength and pack size.',
          409,
        );
      }
      if (targets.some((f) => f.includes('sku'))) {
        return apiError('A product with this SKU already exists.', 409);
      }
      if (targets.some((f) => f.includes('phone'))) {
        return apiError('An account with this phone number already exists.', 409);
      }
      return apiError('A record with these details already exists.', 409);
    }

    case 'P2025':
      // Record not found — triggered by update/delete on non-existent row
      return apiError('The record you\'re looking for could not be found.', 404);

    case 'P2003':
      // Foreign key constraint failed
      return apiError('A required related record was not found. Please refresh and try again.', 400);

    case 'P2016':
      // Query interpretation error
      return apiError('The requested record could not be found.', 404);

    case 'P2034':
      // Transaction conflict (serialization failure — safe to retry)
      return apiError('A temporary conflict occurred. Please try again.', 409);

    default:
      return null;
  }
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number } = {},
): { page: number; limit: number; skip: number } {
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? String(defaults.page  ?? 1),  10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(defaults.limit ?? 20), 10)));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}
