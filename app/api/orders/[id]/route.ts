/**
 * GET /api/orders/[id] — single order detail (Admin/Staff or the owning Customer)
 */

import { NextRequest } from 'next/server';
import { db }          from '@/lib/db';
import { getSession }  from '@/lib/auth';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
} from '@/lib/api/response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(req);
    if (!session) return apiUnauthorized();

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) return apiNotFound('Order');

    const order = await db.order.findUnique({
      where:   { id: orderId },
      include: {
        customer: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true, email: true, phone: true } },
          },
        },
        items: {
          include: {
            product: {
              select: {
                sku:        true,
                brand_name: true,
                generic_name: true,
                images:     { where: { is_primary: true }, take: 1 },
              },
            },
          },
        },
        delivery: {
          include: {
            driver: {
              include: { user: { select: { first_name: true, last_name: true, phone: true } } },
            },
          },
        },
      },
    });

    if (!order) return apiNotFound('Order');

    // Customers can only view their own orders
    if (session.role === 'CUSTOMER' && order.customer.user.id !== session.userId) {
      return apiForbidden();
    }

    return apiSuccess({
      order: {
        id:               order.id,
        uuid:             order.uuid,
        order_number:     order.order_number,
        status:           order.status,
        payment_status:   order.payment_status,
        payment_reference:order.payment_reference,
        delivery_address: order.delivery_address,
        delivery_city:    order.delivery_city,
        delivery_state:   order.delivery_state,
        subtotal:         Number(order.subtotal),
        discount:         Number(order.discount),
        delivery_fee:     Number(order.delivery_fee),
        total:            Number(order.total),
        notes:            order.notes,
        created_at:       order.created_at,
        updated_at:       order.updated_at,
        customer: {
          id:           order.customer.id,
          company_name: order.customer.company_name,
          first_name:   order.customer.user.first_name,
          last_name:    order.customer.user.last_name,
          email:        order.customer.user.email,
          phone:        order.customer.user.phone,
        },
        items: order.items.map(item => ({
          id:          item.id,
          quantity:    item.quantity,
          unit_price:  Number(item.unit_price),
          subtotal:    Number(item.subtotal),
          product: {
            sku:           item.product.sku,
            brand_name:    item.product.brand_name,
            generic_name:  item.product.generic_name,
            primary_image: item.product.images[0]?.url ?? null,
          },
        })),
        delivery: order.delivery ? {
          id:           order.delivery.id,
          uuid:         order.delivery.uuid,
          tracking_code:order.delivery.tracking_code,
          status:       order.delivery.status,
          dispatched_at:order.delivery.dispatched_at,
          delivered_at: order.delivery.delivered_at,
          notes:        order.delivery.notes,
          driver: order.delivery.driver ? {
            id:         order.delivery.driver.id,
            first_name: order.delivery.driver.user.first_name,
            last_name:  order.delivery.driver.user.last_name,
            phone:      order.delivery.driver.user.phone,
          } : null,
        } : null,
      },
    });
  } catch (err) {
    console.error('[GET /api/orders/[id]]', err);
    return apiInternalError();
  }
}
