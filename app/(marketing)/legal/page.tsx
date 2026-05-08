import type { Metadata } from 'next';
import { Container, Section } from '@/components/ui/Layout';

export const metadata: Metadata = {
  title: 'Legal',
  description:
    'Terms of service, privacy policy, and cookies policy for Envolve Pharmaceuticals.',
};

export default function LegalPage() {
  return (
    <Section tight>
      <Container narrow>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          Legal
        </span>
        <h1 className="display-serif mt-3 text-[clamp(2rem,5vw,3rem)] leading-[1.1] tracking-[-0.02em] text-ink">
          Terms, privacy, and cookies.
        </h1>
        <p className="mt-3 text-sm text-ink-3">
          Last updated:{' '}
          {new Date().toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <article className="prose-envolve mt-12 flex flex-col gap-5 text-sm leading-relaxed text-ink-2">
          <h2>Terms of Service</h2>
          <p>
            By accessing the Envolve Pharmaceuticals platform you confirm that you are operating
            as a representative of a licensed Nigerian pharmacy in good standing with the
            Pharmacists Council of Nigeria (PCN). Any use that violates this premise is
            prohibited and may result in account termination.
          </p>
          <p>
            Pricing, availability, and batch information are provided in good faith and refreshed
            in near real-time. Envolve reserves the right to correct pricing errors and to cancel
            orders that result from clear typographical mistakes.
          </p>

          <h2>Privacy Policy</h2>
          <p>
            We collect only the information needed to verify your pharmacy and process your
            orders: contact details, PCN certificate, billing information, and order history. We
            do not sell user data or share it with non-essential third parties.
          </p>
          <p>
            Payment processing is handled by Paystack and other PCI-DSS compliant partners. We
            never store full card numbers.
          </p>

          <h2>Cookies</h2>
          <p>
            We use first-party cookies for authentication and remembering basic preferences (such
            as the active dashboard view). We use minimal analytics cookies, anonymized at
            collection, to improve the platform.
          </p>
          <p>
            You can manage or block cookies through your browser. Disabling authentication
            cookies will prevent you from staying signed in.
          </p>

          <h2>Contact</h2>
          <p>
            For questions about these policies, email{' '}
            <a href="mailto:legal@envolvepharm.com.ng">legal@envolvepharm.com.ng</a>.
          </p>
        </article>
      </Container>
    </Section>
  );
}
