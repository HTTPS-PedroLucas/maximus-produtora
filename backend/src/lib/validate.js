// Validação simples e explícita — mesma ideia do Zod (schema declarativo),
// sem adicionar dependência à stack já existente do repositório.

class ValidationError extends Error {
  constructor(errors) {
    super('Dados inválidos.');
    this.status = 400;
    this.errors = errors;
  }
}

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {object} data
 * @param {object} schema  { campo: { required, type, min, max, enum, default } }
 */
function parse(data, schema) {
  const errors = {};
  const output = {};

  for (const [field, rules] of Object.entries(schema)) {
    const raw = data?.[field];
    const isEmpty = raw === undefined || raw === null || raw === '';

    if (isEmpty) {
      if (rules.required) {
        errors[field] = rules.message || 'Campo obrigatório.';
        continue;
      }
      output[field] = rules.default !== undefined ? rules.default : null;
      continue;
    }

    switch (rules.type) {
      case 'number': {
        const num = Number(raw);
        if (Number.isNaN(num)) { errors[field] = 'Informe um número.'; continue; }
        if (rules.min !== undefined && num < rules.min) { errors[field] = `Mínimo ${rules.min}.`; continue; }
        if (rules.max !== undefined && num > rules.max) { errors[field] = `Máximo ${rules.max}.`; continue; }
        output[field] = num;
        break;
      }
      case 'boolean': {
        output[field] = raw === true || raw === 1 || raw === '1' || raw === 'true' ? 1 : 0;
        break;
      }
      case 'email': {
        const value = str(raw).toLowerCase();
        if (!EMAIL.test(value)) { errors[field] = 'E-mail inválido.'; continue; }
        output[field] = value;
        break;
      }
      case 'color': {
        const value = str(raw);
        if (!HEX_COLOR.test(value)) { errors[field] = 'Use uma cor no formato #RRGGBB.'; continue; }
        // Atalhos de 3 dígitos viram 6 para o banco guardar sempre o mesmo formato.
        const full =
          value.length === 4
            ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
            : value;
        output[field] = full.toUpperCase();
        break;
      }
      case 'date': {
        const value = str(raw);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { errors[field] = 'Data inválida.'; continue; }
        output[field] = value;
        break;
      }
      case 'time': {
        const value = str(raw);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) { errors[field] = 'Horário inválido.'; continue; }
        output[field] = value;
        break;
      }
      case 'url': {
        const value = str(raw);
        try {
          const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocolo');
          output[field] = parsed.toString();
        } catch {
          errors[field] = 'Link inválido.';
        }
        break;
      }
      case 'array': {
        if (!Array.isArray(raw)) { errors[field] = 'Formato inválido.'; continue; }
        output[field] = raw;
        break;
      }
      default: {
        const value = str(raw);
        if (rules.min !== undefined && value.length < rules.min) {
          errors[field] = `Use ao menos ${rules.min} caracteres.`;
          continue;
        }
        if (rules.max !== undefined && value.length > rules.max) {
          errors[field] = `Use no máximo ${rules.max} caracteres.`;
          continue;
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors[field] = `Valor inválido.`;
          continue;
        }
        output[field] = value;
      }
    }
  }

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return output;
}

/** Extrai o domínio de um link de referência (instagram.com, tiktok.com...). */
function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

module.exports = { parse, ValidationError, domainOf };
