import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** Pixel height. Width auto-scales based on the PNG's aspect ratio. */
  height?: number;
  /** 'mark' renders a more compact version. */
  variant?: 'full' | 'mark';
  /** Inverts the logo to white. Best paired with a transparent PNG. */
  monochrome?: boolean;
  className?: string;
}

export function Logo({
  height = 36,
  variant = 'full',
  monochrome = false,
  className,
}: LogoProps) {
  const h = variant === 'mark' ? Math.min(height, 26) : height;
  // Native aspect of the wordmark + descender — roughly 2.5:1
  const w = Math.round(h * 2.5);

  return (
    <Image
      src="/images/Evolve_Pharm.png"
      alt="Envolve Pharmaceuticals"
      width={w * 2}
      height={h * 2}
      priority
      className={cn(
        'block w-auto select-none',
        monochrome && 'brightness-0 invert',
        className,
      )}
      style={{ height: `${h}px`, width: 'auto' }}
    />
  );
}