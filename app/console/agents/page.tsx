/**
 * /console/agents → /console/staff
 *
 * Sales agents are now managed under the unified "Staff" page.
 * This redirect keeps old links working.
 */

import { redirect } from 'next/navigation';

export default function ConsoleAgentsPage() {
  redirect('/console/staff');
}
