'use client';

import { useEffect, useRef } from 'react';
import { XIcon } from '@/components/ui/Icons';
import { AdminButton } from './AdminButton';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  fullScreenOnMobile?: boolean; // default true
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'; // default '2xl'
};

export function ResponsiveModal({
  isOpen,
  onClose,
  title,
  children,
  fullScreenOnMobile = true,
  footer,
  maxWidth = '2xl',
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Trap focus
  useEffect(() => {
    if (!isOpen) return;

    const content = contentRef.current;
    if (!content) return;

    const focusableElements = content.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    content.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);
    firstElement?.focus();

    return () => {
      content.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      className="admin-modal-fullscreen"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={contentRef}
        className={[
          'admin-modal-fullscreen-content',
          widthClasses[maxWidth],
          fullScreenOnMobile ? '' : 'sm:max-w-2xl',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-modal-fullscreen-header">
          <h2 id="modal-title" className="admin-modal-fullscreen-title">
            {title}
          </h2>
          <AdminButton
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            aria-label="Close"
            className="admin-modal-fullscreen-close"
          >
            <XIcon size={20} />
          </AdminButton>
        </header>
        <div className="admin-modal-fullscreen-body">{children}</div>
        {footer && <footer className="admin-modal-fullscreen-footer">{footer}</footer>}
      </div>
    </div>
  );
}