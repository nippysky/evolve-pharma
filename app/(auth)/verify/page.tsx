'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Mail } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { sleep } from '@/lib/utils';

const LEN = 6;

export default function VerifyPage() {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState<string[]>(Array(LEN).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const updateAt = (i: number, v: string) => {
    const next = [...code];
    next[i] = v.slice(-1).replace(/\D/, '');
    setCode(next);
    if (next[i] && i < LEN - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN);
    if (text) {
      e.preventDefault();
      const next = Array(LEN).fill('');
      text.split('').forEach((c, i) => (next[i] = c));
      setCode(next);
      refs.current[Math.min(text.length, LEN - 1)]?.focus();
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.some((c) => c === '')) {
      toast.show({ tone: 'warning', title: 'Code incomplete', description: 'Enter all 6 digits.' });
      return;
    }
    setSubmitting(true);
    await sleep(1000);
    toast.show({ tone: 'success', title: 'Email verified', description: 'Welcome to Envolve.' });
    router.push('/portal/catalog');
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-104" noValidate>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        <Mail size={12} /> Verify email
      </span>
      <h1 className="display-serif mt-2 text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        Check your inbox.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        We sent a 6-digit code to your email. Enter it below to verify and continue.
        <br />
        <span className="text-xs text-ink-3">(Demo: any 6 digits will work.)</span>
      </p>

      <div className="my-6 flex justify-between gap-2">
        {code.map((c, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={c}
            onChange={(e) => updateAt(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={onPaste}
            aria-label={`Digit ${i + 1}`}
            className="aspect-square w-full rounded-md border border-line bg-white text-center font-display text-2xl text-ink outline-none focus:border-brand-500 focus:shadow-glow"
          />
        ))}
      </div>

      <Button type="submit" loading={submitting} fullWidth size="lg" trailingIcon={<ArrowRight size={16} />}>
        Verify and continue
      </Button>

      <p className="mt-6 text-center text-sm text-ink-2">
        Didn&apos;t receive the code?{' '}
        <Link
          href="/verify"
          onClick={(e) => { e.preventDefault(); toast.show({ tone: 'info', title: 'Code resent' }); }}
          className="font-medium text-brand-600 hover:underline hover:underline-offset-2"
        >
          Resend
        </Link>
      </p>
    </form>
  );
}
