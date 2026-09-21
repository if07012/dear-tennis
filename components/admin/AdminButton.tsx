import { forwardRef } from 'react';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type AdminButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'filter' | 'pagination' | 'menu-item';
type AdminButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const baseClasses = 'inline-flex items-center gap-1.5 font-medium leading-5 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap admin-touch-target focus:outline-none';

const variantClasses: Record<AdminButtonVariant, string> = {
  primary:
    'text-white box-border border border-transparent bg-paprika hover:bg-paprika-hover focus:ring-4 focus:ring-brand-medium shadow-xs ',
  secondary:
    'text-dark-gray box-border border border-light-gray bg-white hover:border-hunter-green hover:text-hunter-green focus:ring-4 focus:ring-brand-medium shadow-xs ',
  destructive:
    'text-paprika box-border border border-paprika bg-white hover:bg-paprika hover:text-white focus:ring-4 focus:ring-brand-medium shadow-xs ',
  ghost:
    'text-dark-gray box-border border border-transparent bg-transparent hover:bg-hunter-green/10 hover:text-hunter-green focus:ring-4 focus:ring-brand-medium shadow-xs ',
  filter:
    'text-dark-gray box-border border border-light-gray bg-white hover:border-hunter-green hover:text-hunter-green focus:ring-4 focus:ring-brand-medium shadow-xs ',
  pagination:
    'text-dark-gray box-border border border-light-gray bg-off-white hover:bg-light-gray focus:ring-4 focus:ring-brand-medium shadow-xs ',
  'menu-item':
    'text-graphite box-border border border-transparent bg-transparent hover:bg-hunter-green/5 hover:text-hunter-green focus:ring-4 focus:ring-brand-medium shadow-xs w-full justify-start',
};

const sizeClasses: Record<AdminButtonSize, string> = {
  xs: 'px-3 py-1 text-xs rounded-full',
  sm: 'px-3 py-1.5 text-xs rounded-full',
  md: 'px-4 py-2.5 text-sm rounded-full',
  lg: 'px-6 py-3 text-base rounded-full',
};

const filterActiveClasses = 'bg-hunter-green text-white border-hunter-green';
const filterInactiveClasses = 'bg-white text-dark-gray border-light-gray';

const paginationActiveClasses = 'bg-hunter-green text-white';
const paginationInactiveClasses = 'bg-off-white text-dark-gray';

type AdminButtonBaseProps = {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  className?: string;
  children: ReactNode;
  isActive?: boolean; // For filter and pagination variants
};

type AdminButtonAsButton = AdminButtonBaseProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<'button'>, keyof AdminButtonBaseProps | 'ref'>;

type AdminButtonAsLink = AdminButtonBaseProps & {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  isActive?: boolean;
};

function classes(
  variant: AdminButtonVariant,
  size: AdminButtonSize,
  isActive?: boolean,
  extra?: string
) {
  let variantClass = variantClasses[variant];
  
  if (variant === 'filter' && isActive) {
    variantClass = `${variantClass} ${filterActiveClasses}`;
  } else if (variant === 'filter' && !isActive) {
    variantClass = `${variantClass} ${filterInactiveClasses}`;
  }
  
  if (variant === 'pagination' && isActive) {
    variantClass = `${variantClass} ${paginationActiveClasses}`;
  } else if (variant === 'pagination' && !isActive) {
    variantClass = `${variantClass} ${paginationInactiveClasses}`;
  }
  
  return [baseClasses, variantClass, sizeClasses[size], extra ?? '']
    .filter(Boolean)
    .join(' ');
}

export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonAsButton>(function AdminButton(
  { variant = 'primary', size = 'md', className, children, isActive, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={classes(variant, size, isActive, className)} {...rest}>
      {children}
    </button>
  );
});

AdminButton.displayName = 'AdminButton';

export function AdminLinkButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  href,
  isActive,
}: AdminButtonAsLink) {
  // External (e.g. mailto:) or in-page anchor: use a plain anchor
  if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
    return (
      <a href={href} className={classes(variant, size, isActive, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes(variant, size, isActive, className)}>
      {children}
    </Link>
  );
}
