/**
 * Standardised API response helpers
 *
 * All API routes return the same envelope:
 *   { status: "success" | "error", message: "...", data: {...} }
 *
 * Paginated list responses use:
 *   { status: "success", message: "...", data: { records: [...], pagination: {...} } }
 *
 * Usage (in route handlers):
 *   return apiSuccess({ user }, 201);
 *   return apiError('Email already exists', 409);
 *   return apiPaginated(records, { current_page: 1, per_page: 20, total: 100 });
 */

import { NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Success ──────────────────────────────────────────────────────────────────

export function apiSuccess<T>(
  data:    T,
  status = 200,
  message = 'Success',
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ status: 'success', message, data }, { status });
}

// ─── Paginated success ────────────────────────────────────────────────────────

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

// ─── Error ────────────────────────────────────────────────────────────────────

export function apiError(
  message: string,
  status  = 400,
  errors?: Record<string, string[]>,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { status: 'error', message };
  if (errors) body.errors = errors;
  return NextResponse.json(body, { status });
}

// ─── Common error shortcuts ───────────────────────────────────────────────────

export const apiUnauthorized = (msg = 'Unauthorized') =>
  apiError(msg, 401);

export const apiForbidden = (msg = 'Forbidden — insufficient permissions') =>
  apiError(msg, 403);

export const apiNotFound = (entity = 'Resource') =>
  apiError(`${entity} not found`, 404);

export const apiInternalError = (msg = 'Internal server error') =>
  apiError(msg, 500);

// ─── Parse pagination query params ───────────────────────────────────────────

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number } = {},
): { page: number; limit: number; skip: number } {
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? String(defaults.page  ?? 1),  10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(defaults.limit ?? 20), 10)));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}
