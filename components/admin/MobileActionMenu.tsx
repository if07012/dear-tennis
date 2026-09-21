'use client';

import { useEffect, useRef, useState } from 'react';
import { Fragment } from 'react';
import { XIcon } from '@/components/ui/Icons';

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
    <div className="admin-action-menu">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="admin-action-menu-button"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="admin-action-menu-content"
        >
          {actions.map((action, idx) => (
            <Fragment key={idx}>
              {idx > 0 && actions[idx - 1].destructive !== action.destructive && (
                <div className="admin-action-menu-divider" role="separator" />
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleAction(action)}
                disabled={action.disabled}
                className={[
                  'admin-action-menu-item',
                  action.destructive && 'admin-action-menu-item-destructive',
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