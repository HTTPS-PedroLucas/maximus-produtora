const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = require('docx');
const { UPLOADS_DIR } = require('../middleware/upload');
const { formatBR } = require('./date');

// Os roteiros ficam num bucket próprio, separado das imagens.
const SCRIPTS_DIR = path.join(UPLOADS_DIR, 'scripts');
fs.mkdirSync(SCRIPTS_DIR, { recursive: true });

/** Nome de arquivo legível: "Video-01_SOS-Farma_2026-08-24.docx". */
function buildFileName({ number, clientName, date }) {
  const slug = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

  const parts = [`Video-${String(number || 1).padStart(2, '0')}`, slug(clientName), date].filter(Boolean);
  return `Roteiro_${parts.join('_')}.docx`;
}

/**
 * Converte a marcação simples que a equipe costuma colar (**negrito**,
 * *itálico*) em formatação real do Word, em vez de deixar os asteriscos à
 * mostra. O texto sem marcação passa intacto.
 */
function inlineRuns(text, base = {}) {
  const runs = [];
  const padrao = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_/g;
  let ultimo = 0;
  let achado;

  while ((achado = padrao.exec(text)) !== null) {
    if (achado.index > ultimo) {
      runs.push(new TextRun({ text: text.slice(ultimo, achado.index), ...base }));
    }

    const negrito = achado[1] ?? achado[2];
    const italico = achado[3] ?? achado[4];
    runs.push(
      new TextRun({
        text: negrito ?? italico,
        ...base,
        ...(negrito !== undefined ? { bold: true } : { italics: true }),
      })
    );

    ultimo = achado.index + achado[0].length;
  }

  if (ultimo < text.length) runs.push(new TextRun({ text: text.slice(ultimo), ...base }));
  if (runs.length === 0) runs.push(new TextRun({ text, ...base }));
  return runs;
}

/** Um parágrafo do roteiro, reconhecendo títulos (#) e listas (-). */
function scriptParagraph(line) {
  const titulo = line.match(/^(#{1,6})\s+(.*)$/);
  if (titulo) {
    const nivel = titulo[1].length;
    return new Paragraph({
      spacing: { before: nivel <= 2 ? 240 : 200, after: 120 },
      children: inlineRuns(titulo[2], { bold: true, size: nivel <= 2 ? 28 : 26 }),
    });
  }

  const item = line.match(/^\s*[-*+]\s+(.*)$/);
  if (item) {
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 80, line: 300 },
      children: inlineRuns(item[1], { size: 24 }),
    });
  }

  return new Paragraph({
    spacing: { after: 120, line: 320 },
    children: inlineRuns(line, { size: 24 }),
  });
}

/**
 * Monta o .docx do roteiro: capa curta com os dados da captação e o texto
 * do roteiro preservando os parágrafos originais.
 */
function buildDocument({ number, title, script, clientName, date, startTime, notes }) {
  const heading = (text, options = {}) =>
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text, bold: true, size: 32, ...options })],
    });

  const meta = (label, value) =>
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20, color: '666666' }),
        new TextRun({ text: String(value), size: 20, color: '666666' }),
      ],
    });

  const children = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: 'MÁXIMUS PRODUTORA', bold: true, size: 18, color: 'A803D2' })],
    }),
    heading(`Vídeo ${String(number || 1).padStart(2, '0')}${title ? ` — ${title}` : ''}`),
  ];

  if (clientName) children.push(meta('Cliente', clientName));
  if (date) children.push(meta('Data da captação', formatBR(date)));
  if (startTime) children.push(meta('Horário', startTime));

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      children: [new TextRun({ text: 'Roteiro', bold: true, size: 26 })],
    })
  );

  // Cada linha do roteiro vira um parágrafo, mantendo a formatação que a
  // equipe digitou (inclusive as linhas em branco entre blocos).
  for (const line of String(script || '').split(/\r?\n/)) {
    children.push(scriptParagraph(line));
  }

  if (notes && notes.trim()) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 120 },
        children: [new TextRun({ text: 'Observações', bold: true, size: 26 })],
      })
    );
    for (const line of notes.split(/\r?\n/)) {
      children.push(
        new Paragraph({
          spacing: { after: 100, line: 300 },
          children: inlineRuns(line, { size: 22, color: '444444' }),
        })
      );
    }
  }

  return new Document({
    creator: 'Máximus Produtora',
    title: `Roteiro — Vídeo ${String(number || 1).padStart(2, '0')}`,
    description: 'Documento gerado automaticamente pelo sistema da Máximus Produtora.',
    sections: [{ properties: {}, children }],
  });
}

/**
 * Gera (ou regera) o .docx do roteiro e devolve os dados para salvar no banco.
 * Retorna null quando o roteiro está vazio — nesse caso não existe documento.
 */
async function generateScriptDoc(video) {
  if (!video.script || !video.script.trim()) return null;

  const doc = buildDocument(video);
  const buffer = await Packer.toBuffer(doc);

  const fileName = buildFileName(video);
  const storedName = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.docx`;
  await fs.promises.writeFile(path.join(SCRIPTS_DIR, storedName), buffer);

  return {
    url: `/uploads/scripts/${storedName}`,
    name: fileName,
    size: buffer.length,
  };
}

module.exports = { generateScriptDoc, buildFileName, SCRIPTS_DIR };
