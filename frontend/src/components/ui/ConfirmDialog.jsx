import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/** Confirmação usada antes de qualquer exclusão. */
export default function ConfirmDialog({
  open,
  title = 'Confirmar exclusão',
  message,
  detail,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  danger = true,
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : ''}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="modal-body">
        <div className={`alert ${danger ? 'alert-danger' : 'alert-warning'}`}>
          <AlertTriangle size={17} />
          <div>
            <strong>{message}</strong>
            {detail && <p className="mt-8">{detail}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
