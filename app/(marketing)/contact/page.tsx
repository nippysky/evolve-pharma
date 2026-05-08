'use client';

import { useActionState } from 'react';
import { Container, Section } from '@/components/ui/Layout';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Mail, Phone, MapPin, Send, CheckCircle } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { contactAction } from '@/lib/actions';
import { SITE } from '@/lib/constants';
import type { ActionResult } from '@/lib/actions';

const initial: ActionResult = { ok: false, message: '' };

export default function ContactPage() {
  const toast = useToast();
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await contactAction(prev, fd);
    if (r.ok) {
      toast.show({
        tone: 'success',
        title: 'Message sent',
        description: "We'll be in touch within one business day.",
      });
    } else {
      toast.show({ tone: 'error', title: "Couldn't send", description: r.message });
    }
    return r;
  }, initial);

  const fieldErrors = !state.ok ? state.fieldErrors : undefined;
  const sent = state.ok;

  return (
    <Section tight>
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              Contact
            </span>
            <h1 className="display-serif mt-3 text-[clamp(2rem,5vw,3rem)] leading-[1.1] tracking-[-0.02em] text-ink">
              Talk to a human, not a help desk.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-2">
              Whether you&apos;re evaluating Envolve for your pharmacy or you need urgent
              support, our team responds within one business day — usually faster.
            </p>

            <ul className="mt-10 flex flex-col gap-5">
              <li className="flex items-start gap-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
                  <Mail size={16} />
                </span>
                <div>
                  <strong className="block text-sm font-semibold text-ink">Email us</strong>
                  <span className="text-sm text-ink-2">{SITE.email}</span>
                </div>
              </li>
              <li className="flex items-start gap-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
                  <Phone size={16} />
                </span>
                <div>
                  <strong className="block text-sm font-semibold text-ink">Call us</strong>
                  <span className="text-sm text-ink-2">{SITE.phone} · Mon–Fri, 08:00–18:00 WAT</span>
                </div>
              </li>
              <li className="flex items-start gap-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
                  <MapPin size={16} />
                </span>
                <div>
                  <strong className="block text-sm font-semibold text-ink">Visit us</strong>
                  <span className="text-sm text-ink-2">{SITE.address}</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-md sm:p-8">
            {sent ? (
              <div className="py-8 text-center">
                <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-leaf-100 text-leaf-700">
                  <CheckCircle size={28} />
                </span>
                <h2 className="display-serif text-2xl tracking-tight text-ink">Message sent.</h2>
                <p className="mt-2 text-sm text-ink-2">
                  We&apos;ll get back to you within one business day.
                </p>
              </div>
            ) : (
              <form action={formAction} noValidate>
                <h2 className="mb-6 text-base font-medium tracking-tight text-ink">
                  Send us a message
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Your name" htmlFor="name" required error={fieldErrors?.name?.[0]}>
                    <Input id="name" name="name" placeholder="Adaobi Okonkwo" autoComplete="name" required />
                  </Field>
                  <Field label="Work email" htmlFor="email" required error={fieldErrors?.email?.[0]}>
                    <Input id="email" name="email" type="email" placeholder="you@pharmacy.ng" autoComplete="email" required />
                  </Field>
                </div>
                <Field label="Pharmacy / company" htmlFor="company" error={fieldErrors?.company?.[0]}>
                  <Input id="company" name="company" placeholder="Greenleaf Pharmacy Ltd." />
                </Field>
                <Field label="Message" htmlFor="message" required error={fieldErrors?.message?.[0]}>
                  <Textarea id="message" name="message" rows={5} placeholder="Tell us a bit about what you need…" required />
                </Field>
                <Button
                  type="submit"
                  loading={pending}
                  fullWidth
                  size="lg"
                  trailingIcon={<Send size={16} />}
                >
                  Send message
                </Button>
              </form>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
