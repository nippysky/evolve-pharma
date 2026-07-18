'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Upload, FileText, CheckCircle, AlertTriangle, Shield } from '@/components/icons';
import { useToast } from '@/contexts/ToastContext';
import { useUploadPcn } from '@/hooks/auth/useCustomerAuth';
import { cn } from '@/lib/utils';

/**
 * PCN sticky gate page.
 *
 * Shown after login when:
 *  - Customer was bulk-imported by admin/staff and hasn't yet uploaded their cert
 *  - Customer abandoned the sign-up wizard before the PCN step
 *
 * After a successful upload the backend marks pcn_uploaded = true on the
 * customer record and refreshes the session, so the next portal navigation
 * passes the layout gate normally.
 */
export default function UploadPcnPage() {
  const router = useRouter();
  const toast = useToast();

  const [certFile, setCertFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState('');
  const [fileError, setFileError] = useState('');

  const uploadMutation = useUploadPcn();

  const handleSubmit = () => {
    if (!certFile) {
      setFileError('Please upload your PCN certificate to continue.');
      return;
    }
    setFileError('');
    setServerError('');

    uploadMutation.mutate(certFile, {
      onSuccess: () => {
        toast.show({
          tone: 'success',
          title: 'Certificate uploaded',
          description: 'Our team will verify it within 24 hours.',
        });
        setTimeout(() => router.push('/portal/catalog'), 500);
      },
      onError: (err: Error) => {
        setServerError(err.message ?? 'Upload failed. Please try again.');
      },
    });
  };

  return (
    <div className="w-full max-w-104">
      {/* Icon */}
      <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-700">
        <Shield size={22} />
      </span>

      <h1 className="display-serif mt-4 text-[clamp(1.75rem,3.5vw,2.25rem)] leading-[1.1] tracking-[-0.02em] text-ink">
        One last step.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        To comply with NAFDAC regulations, all pharmacy accounts must have a valid PCN
        (Pharmacists Council of Nigeria) certificate on file. Upload yours below to unlock
        your account.
      </p>

      <div className="mt-6 rounded-xl border border-line bg-bg-subtle p-4 text-sm text-ink-2">
        <p className="font-medium text-ink">Why we need this</p>
        <ul className="mt-2 space-y-1">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            Confirms you operate a licensed pharmacy in Nigeria
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            Required before we can fulfill prescription-grade orders
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            Reviewed by our compliance team — usually within 24 hours
          </li>
        </ul>
      </div>

      <div className="mt-6 space-y-4">
        {serverError && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-danger-soft px-3.5 py-3 text-sm text-red-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <Field
          label="PCN certificate"
          htmlFor="pcn_cert"
          required
          hint="PDF, JPG or PNG · Max 8 MB"
          error={fileError}
        >
          <label
            htmlFor="pcn_cert"
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-5 py-8 text-center transition-colors',
              certFile
                ? 'border-leaf-400 bg-leaf-50'
                : 'border-line-strong bg-white hover:border-brand-400 hover:bg-brand-50',
            )}
          >
            <span className={cn(
              'grid h-10 w-10 place-items-center rounded-full border',
              certFile ? 'border-leaf-300 bg-white text-leaf-600' : 'border-line bg-bg-subtle text-brand-600',
            )}>
              {certFile ? <CheckCircle size={18} /> : <Upload size={18} />}
            </span>

            <span className="text-sm font-medium text-ink">
              {certFile ? 'Certificate selected' : 'Click to upload your PCN certificate'}
            </span>
            <span className="text-xs text-ink-3">or drag and drop here</span>

            {certFile && (
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-leaf-700">
                <FileText size={13} />
                {certFile.name}
                <span className="text-ink-3">({(certFile.size / 1024).toFixed(0)} KB)</span>
              </span>
            )}
          </label>

          <input
            id="pcn_cert"
            name="pcn_cert"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              setCertFile(e.target.files?.[0] ?? null);
              setFileError('');
            }}
          />
        </Field>

        <Button
          type="button"
          fullWidth
          size="lg"
          loading={uploadMutation.isPending}
          onClick={handleSubmit}
        >
          Submit certificate
        </Button>

        <p className="text-center text-xs text-ink-3">
          You can also email it to{' '}
          <a href="mailto:compliance@ece.envolvepharm.com.ng" className="font-medium text-brand-600 hover:underline">
            compliance@ece.envolvepharm.com.ng
          </a>{' '}
          and we&apos;ll add it to your account.
        </p>
      </div>
    </div>
  );
}
