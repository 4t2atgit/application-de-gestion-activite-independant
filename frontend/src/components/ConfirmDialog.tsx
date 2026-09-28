import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onClose} maxWidth="md">
      <p className="text-sm text-body">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={onClose}>Annuler</button>
        <button className="rounded-xl bg-danger-strong px-4 py-2 text-sm font-medium text-white hover:bg-danger-strong-hover" type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
