import Image from 'next/image';
import { Container, Section } from '@/components/ui/Layout';
import { Stat } from '@/components/ui/Primitives';
import { Shield, Truck, Sparkle } from '@/components/icons';

export const metadata = {
  title: 'About',
  description:
    'Envolve is rebuilding pharmaceutical wholesale for licensed Nigerian pharmacies — authentic medicines, transparent pricing, in-house logistics.',
};

const STATS = [
  { label: 'Pharmacies served', value: '320+' },
  { label: 'SKUs in catalog', value: '1,400+' },
  { label: 'Cities covered', value: '14' },
  { label: 'Avg. delivery time', value: '<24h' },
];

const COMMITMENTS = [
  {
    Icon: Shield,
    title: 'Authentic medicines, batch by batch',
    body:
      'Every shipment carries a verifiable batch number. We onboard manufacturers directly — no middlemen, no mystery.',
  },
  {
    Icon: Truck,
    title: 'Logistics built for the Nigerian map',
    body:
      'Same-day Abuja, 24–72hr nationwide. Cold-chain SKUs travel in temperature-monitored vans with our own drivers.',
  },
  {
    Icon: Sparkle,
    title: 'Pricing that doesn\'t reward the loudest haggler',
    body:
      'Transparent bulk tiers, automatic at checkout. The price you see is the price you pay, no exceptions.',
  },
];

export default function AboutPage() {
  return (
    <>
      <Section tight>
        <Container>
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              About Envolve
            </span>
            <h1 className="display-serif mt-3 text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.1] tracking-[-0.02em] text-ink">
              We&apos;re rebuilding pharmaceutical wholesale, one pharmacy at a time.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-2">
              Envolve was founded by pharmacists and operators who watched community pharmacies
              waste hours on procurement that should take minutes. We built the platform we
              wished existed: authentic medicines, transparent pricing, and logistics that
              actually show up.
            </p>
          </div>
        </Container>
      </Section>

      <Container>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          <Image
            src="https://images.unsplash.com/photo-1583912267550-d6c2ac3196c0?w=1600&q=80"
            alt="Pharmacy team at work"
            width={1600}
            height={900}
            className="h-[clamp(280px,40vw,520px)] w-full object-cover"
          />
        </div>
      </Container>

      <Section>
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-white p-6">
                <Stat label={s.label} value={s.value} />
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              Commitments
            </span>
            <h2 className="display-serif mt-3 text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.15] tracking-tight text-ink">
              How we earn the trust of the pharmacies we serve.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {COMMITMENTS.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-white p-7">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-leaf-100 text-leaf-700">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-lg font-medium tracking-tight text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
