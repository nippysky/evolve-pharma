import { redirect } from 'next/navigation';

/**
 * Admin order detail — handled via the slide-over panel in AdminOrdersView.
 * Direct navigation to /admin/orders/[id] redirects back to the list.
 */
export default async function AdminOrderDetailPage() {
  // The slide-over in AdminOrdersView handles per-order detail.
  // Deep-linking to individual IDs redirects back to the orders list.
  redirect(`/admin/orders`);
}
