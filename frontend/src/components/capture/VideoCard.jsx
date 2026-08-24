import { useEffect, useRef, useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, Copy, Download, ExternalLink, FileText, ImagePlus,
  Info, Link2, Loader2, Maximize2, Trash2, X,
} from 'lucide-react';
import api, { assetUrl, errorMessage } from '../../api';
import { useToast } from '../../context/ToastContext';
import { updatedAtLabel } from '../../lib/date';
import { Field } from '../ui';
import Modal from '../ui/Modal';

const AUTOSAVE_DELAY = 800;

/** Tamanho do arquivo em formato legível (12 kB, 1,2 MB). */
function fileSizeLabel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Documento .docx do roteiro, gerado pelo sistema a cada salvamento.
 * Não há botão de "gerar": ele acompanha o texto automaticamente.
 */
function ScriptDocument({ video, saving, hasScript, onGenerate, generating }) {
  if (!video.script_doc_url) {
    if (!hasScript) return null;

    // Enquanto o roteiro está sendo salvo, o documento vem logo atrás.
    if (saving || generating) {
      return (
        <div className="script-doc is-pending">
          <Loader2 size={15} className="spin" />
          <span className="small">Gerando o documento do roteiro…</span>
        </div>
      );
    }

    // Roteiro salvo mas sem documento: acontece com textos escritos antes
    // desta funcionalidade. Um clique resolve, sem precisar reeditar o texto.
    return (
      <div className="script-doc is-pending">
        <FileText size={16} strokeWidth={1.75} />
        <span className="script-doc-info">
          <span className="small">Este roteiro ainda não tem documento.</span>
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onGenerate}>
          Gerar agora
        </button>
      </div>
    );
  }

  return (
    <div className="script-doc">
      <span className="script-doc-icon" aria-hidden="true">
        <FileText size={17} strokeWidth={1.75} />
      </span>

      <span className="script-doc-info">
        <strong className="truncate">{video.script_doc_name}</strong>
        <span className="tiny muted">
          {saving ? 'Atualizando…' : `Atualizado em ${updatedAtLabel(video.script_doc_updated_at)}`}
          {video.script_doc_size_bytes ? ` · ${fileSizeLabel(video.script_doc_size_bytes)}` : ''}
        </span>
      </span>

      <a
        className="btn btn-secondary btn-sm"
        href={assetUrl(video.script_doc_url)}
        download={video.script_doc_name}
        title="Baixar o roteiro em Word"
      >
        <Download size={14} />
        Baixar
      </a>
    </div>
  );
}

/** Um contêiner de vídeo: roteiro, observações, links e imagens de apoio. */
export default function VideoCard({ video, index, total, onChanged, onRemove, onMove, onDuplicate }) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    title: video.title || '',
    script: video.script || '',
    notes: video.notes || '',
  });
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [linkUrl, setLinkUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const fileRef = useRef(null);
  const dirty = useRef(false);
  const savedTimer = useRef(null);

  // Quando outra pessoa altera o mesmo vídeo, o texto é atualizado
  // (sem sobrescrever o que está sendo digitado agora).
  useEffect(() => {
    if (dirty.current) return;
    setDraft({ title: video.title || '', script: video.script || '', notes: video.notes || '' });
  }, [video.title, video.script, video.notes]);

  // Salvamento automático.
  useEffect(() => {
    if (!dirty.current) return undefined;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.put(`/videos/${video.id}`, draft);
        dirty.current = false;
        setSaveState('saved');
        onChanged?.(data);
        clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveState('idle'), 2200);
      } catch (err) {
        setSaveState('idle');
        toast.error(errorMessage(err, 'Não foi possível salvar o vídeo.'));
      }
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(timer);
  }, [draft, video.id, onChanged, toast]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  function update(key, value) {
    dirty.current = true;
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** Salva o roteiro como está, o que faz o servidor gerar o documento. */
  async function generateDoc() {
    setGeneratingDoc(true);
    try {
      const { data } = await api.put(`/videos/${video.id}`, draft);
      onChanged?.(data);
      toast.success('Documento do roteiro gerado.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível gerar o documento.'));
    } finally {
      setGeneratingDoc(false);
    }
  }

  async function toggleDone(done) {
    try {
      const { data } = await api.patch(`/videos/${video.id}/done`, { done });
      onChanged?.(data.video, data);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível atualizar o vídeo.'));
    }
  }

  async function addLink(event) {
    event.preventDefault();
    if (!linkUrl.trim()) return;
    setAddingLink(true);
    try {
      const { data } = await api.post(`/videos/${video.id}/references`, { url: linkUrl.trim() });
      setLinkUrl('');
      onChanged?.(data);
      toast.success('Referência adicionada.');
    } catch (err) {
      toast.error(errorMessage(err, 'Link inválido.'));
    } finally {
      setAddingLink(false);
    }
  }

  async function removeLink(referenceId) {
    try {
      const { data } = await api.delete(`/videos/references/${referenceId}`);
      onChanged?.(data);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível remover a referência.'));
    }
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;

    setUploading(true);
    const form = new FormData();
    for (const file of files) form.append('files', file);

    try {
      const { data } = await api.post(`/videos/${video.id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChanged?.(data);
      toast.success(`${files.length} imagem(ns) adicionada(s).`);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível enviar as imagens.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAttachment(attachmentId) {
    try {
      const { data } = await api.delete(`/videos/attachments/${attachmentId}`);
      onChanged?.(data);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível remover a imagem.'));
    }
  }

  const isEmpty =
    !draft.title.trim() &&
    !draft.script.trim() &&
    !draft.notes.trim() &&
    video.references.length === 0 &&
    video.attachments.length === 0;

  const number = String(video.number ?? index + 1).padStart(2, '0');

  return (
    <article className={`video-card ${video.done ? 'is-done' : ''}`} aria-label={`Vídeo ${number}`}>
      <header className="video-head">
        <span className="video-number">Vídeo {number}</span>

        <label className="checkbox">
          <input type="checkbox" autoComplete="off" checked={Boolean(video.done)} onChange={(event) => toggleDone(event.target.checked)} />
          Concluído
        </label>

        <span className={`save-state ${saveState === 'saved' ? 'is-saved' : ''}`} aria-live="polite">
          {saveState === 'saving' && (
            <>
              <Loader2 size={13} className="spin" /> Salvando…
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check size={13} /> Salvo
            </>
          )}
        </span>

        <div className="video-head-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={() => onMove(video, -1)}
            disabled={index === 0}
            aria-label={`Mover Vídeo ${number} para cima`}
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => onMove(video, 1)}
            disabled={index === total - 1}
            aria-label={`Mover Vídeo ${number} para baixo`}
          >
            <ChevronDown size={16} />
          </button>
          <button type="button" className="btn-icon" onClick={() => onDuplicate(video)} aria-label={`Duplicar Vídeo ${number}`}>
            <Copy size={15} />
          </button>
          <button type="button" className="btn-icon" onClick={() => onRemove(video)} aria-label={`Excluir Vídeo ${number}`}>
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className="video-body">
        {isEmpty && (
          <div className="alert alert-info">
            <Info size={16} />
            <span>Este vídeo ainda está vazio. Tudo bem salvar assim — dá para preencher só o link de referência depois.</span>
          </div>
        )}

        <Field label="Título" hint="Opcional" htmlFor={`title-${video.id}`}>
          <input
            id={`title-${video.id}`}
            className="input"
            value={draft.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder="Ex.: Oferta do dia"
          />
        </Field>

        <div className="script-block">
          <div className="script-block-head">
            <label className="field-label" htmlFor={`script-${video.id}`}>
              Roteiro
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFullscreen(true)}
              title="Abrir o roteiro em tela cheia"
            >
              <Maximize2 size={14} />
              Tela cheia
            </button>
          </div>

          <textarea
            id={`script-${video.id}`}
            className="textarea"
            value={draft.script}
            onChange={(event) => update('script', event.target.value)}
            placeholder="Cole ou escreva o roteiro aqui — o documento .docx é criado sozinho."
          />
          <span className="field-hint">
            Opcional — alguns vídeos são só trend ou referência. Ao salvar, o documento abaixo é gerado
            automaticamente.
          </span>

          <ScriptDocument
            video={video}
            saving={saveState === 'saving'}
            hasScript={Boolean(draft.script.trim())}
            onGenerate={generateDoc}
            generating={generatingDoc}
          />
        </div>

        <Field label="Observações" hint="Opcional" htmlFor={`notes-${video.id}`}>
          <textarea
            id={`notes-${video.id}`}
            className="textarea"
            style={{ minHeight: 64 }}
            value={draft.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Detalhes de gravação, equipamentos, cuidados…"
          />
        </Field>

        <div className="col gap-6">
          <span className="section-label">
            <Link2 size={14} />
            Links de referência
          </span>

          {video.references.length > 0 && (
            <div className="reference-list">
              {video.references.map((reference) => (
                <div className="reference-item" key={reference.id}>
                  <span className="ref-domain">
                    <ExternalLink size={13} />
                    {reference.domain || 'link'}
                  </span>
                  <span className="ref-url">{reference.url}</span>
                  <a href={reference.url} target="_blank" rel="noreferrer noopener" className="btn btn-ghost btn-sm">
                    Abrir
                  </a>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => removeLink(reference.id)}
                    aria-label="Remover referência"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="reference-form" onSubmit={addLink}>
            <input
              className="input"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Cole o link do Instagram, TikTok, YouTube…"
              aria-label="Novo link de referência"
            />
            <button type="submit" className="btn btn-secondary" disabled={addingLink || !linkUrl.trim()}>
              {addingLink ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />}
              Adicionar
            </button>
          </form>
        </div>

        <div className="col gap-6">
          <span className="section-label">
            <ImagePlus size={14} />
            Imagens de apoio
          </span>

          <div className="attachment-grid">
            {video.attachments.map((attachment) => (
              <div className="attachment" key={attachment.id}>
                <a href={assetUrl(attachment.file_url)} target="_blank" rel="noreferrer noopener">
                  <img src={assetUrl(attachment.file_url)} alt={attachment.file_name || 'Imagem de apoio'} loading="lazy" />
                </a>
                <button
                  type="button"
                  className="remove"
                  onClick={() => removeAttachment(attachment.id)}
                  aria-label={`Remover ${attachment.file_name || 'imagem'}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            <button
              type="button"
              className={`upload-tile ${dragOver ? 'is-dragover' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                uploadFiles(event.dataTransfer.files);
              }}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
              {uploading ? 'Enviando…' : 'Adicionar imagem'}
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => uploadFiles(event.target.files)}
          />
        </div>
      </div>

      <footer className="video-foot">
        <span>
          Criado por {video.created_by_name || 'equipe'}
          {video.updated_by_name ? ` · última alteração por ${video.updated_by_name}` : ''}
        </span>
        <span>{updatedAtLabel(video.updated_at)}</span>
      </footer>

      <Modal
        open={fullscreen}
        title={`Vídeo ${number}${video.title ? ` — ${video.title}` : ''}`}
        description="Roteiro em tela cheia — o texto é salvo e o documento atualizado automaticamente."
        onClose={() => setFullscreen(false)}
        size="full"
        footer={
          <>
            <span className="footer-note">
              {saveState === 'saving' && 'Salvando…'}
              {saveState === 'saved' && 'Salvo — documento atualizado.'}
            </span>
            {video.script_doc_url && (
              <a
                className="btn btn-secondary"
                href={assetUrl(video.script_doc_url)}
                download={video.script_doc_name}
              >
                <Download size={15} />
                Baixar .docx
              </a>
            )}
            <button type="button" className="btn" onClick={() => setFullscreen(false)}>
              Fechar
            </button>
          </>
        }
      >
        <div className="modal-body script-fullscreen">
          <textarea
            className="textarea script-fullscreen-text"
            value={draft.script}
            onChange={(event) => update('script', event.target.value)}
            placeholder="Cole ou escreva o roteiro aqui — o documento .docx é criado sozinho."
            aria-label="Roteiro em tela cheia"
          />
        </div>
      </Modal>
    </article>
  );
}
