import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: 'md' | 'lg' | 'xl';
}

const widths = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
};

export function Modal({ title, description, children, onClose, maxWidth = 'lg' }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-modal="true" aria-labelledby="modal-title" className={`my-4 w-full ${widths[maxWidth]} rounded-2xl bg-surface p-6 shadow-2xl sm:my-8`} role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-xl font-semibold text-heading">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button ref={closeButtonRef} title="Fermer" aria-label="Fermer" className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-muted p-2 text-body hover:bg-surface-hover" type="button" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}
