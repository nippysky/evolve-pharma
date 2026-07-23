import type { ReactNode } from 'react';
import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';
import { getSession } from '@/lib/auth';

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <>
      <Header session={session} />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
