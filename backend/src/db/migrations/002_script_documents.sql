-- Documento .docx gerado automaticamente a partir do roteiro do vídeo.
-- Cada vídeo tem no máximo um documento, sempre em sincronia com o texto do
-- roteiro: ao salvar o roteiro, o arquivo é regerado e substituído.

ALTER TABLE video_ideas ADD COLUMN script_doc_url TEXT;
ALTER TABLE video_ideas ADD COLUMN script_doc_name TEXT;
ALTER TABLE video_ideas ADD COLUMN script_doc_size_bytes INTEGER;
ALTER TABLE video_ideas ADD COLUMN script_doc_updated_at TEXT;
