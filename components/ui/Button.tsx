import { forwardRef } from 'react';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'full';

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-paprika text-white hover:bg-paprika-hover hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
  secondary:
    'bg-hunter-green text-white hover:bg-hunter-green-dark hover:-translate-y-0.5 hover:shadow-lg',
  outline:
    'border-2 border-paprika text-paprika hover:bg-paprika hover:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-base',
  full: 'w-full px-8 py-4 text-base',
};

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = ButtonBaseProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonBaseProps>;

type ButtonAsLink = ButtonBaseProps & {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

function classes(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return [baseClasses, variantClasses[variant], sizeClasses[size], extra ?? '']
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonAsButton>(function Button(
  { variant = 'primary', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={classes(variant, size, className)} {...rest}>
      {children}
    </button>
  );
});

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  href,
}: ButtonAsLink) {
  // External (e.g. mailto:) or in-page anchor: use a plain anchor
  if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
    return (
      <a href={href} className={classes(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}
