import { redirect } from 'next/navigation';

/** /admin/agents is an alias for /admin/staff */
export default function AgentsPage() {
  redirect('/admin/staff');
}
