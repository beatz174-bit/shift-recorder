import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ isOpen, title, onClose, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-900/50 px-4 py-8 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-midnight-700 dark:bg-midnight-950"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-midnight-800 dark:hover:text-neutral-50"
            aria-label="Close dialog"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
