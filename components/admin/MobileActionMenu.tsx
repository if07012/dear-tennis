'use client';

import { useEffect, useRef, useState } from 'react';
import { Fragment } from 'react';
import { XIcon } from '@/components/ui/Icons';
import { AdminButton } from './AdminButton';

type ActionItem = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  trigger: React.ReactNode;
  actions: ActionItem[];
};

export function MobileActionMenu({ trigger, actions }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleAction = (action: ActionItem) => {
    action.onClick();
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-dark-gray box-border border border-light-gray bg-white hover:border-hunter-green hover:text-hunter-green focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-full text-sm focus:outline-none admin-touch-target"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-xl border border-light-gray bg-white py-2 shadow-xl"
        >
          {actions.map((action, idx) => (
            <Fragment key={idx}>
              {idx > 0 && actions[idx - 1].destructive !== action.destructive && (
                <div className="my-1 border-t border-light-gray" role="separator" />
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleAction(action)}
                disabled={action.disabled}
                className={[
                  'w-full px-4 py-2 text-left text-sm font-medium transition-colors',
                  action.destructive 
                    ? 'text-paprika hover:bg-paprika/5' 
                    : 'text-graphite hover:bg-hunter-green/5 hover:text-hunter-green',
                  action.disabled && 'opacity-50 cursor-not-allowed',
                ].join(' ')}
              >
                {action.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}