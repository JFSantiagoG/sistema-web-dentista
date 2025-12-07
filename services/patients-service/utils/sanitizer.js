// utils/sanitizer.js

function sanitizeString(value, options = {}) {
  if (typeof value !== 'string') return value;

  const {
    maxLength = 5000,
    escapeHtml = true,
    trim = true
  } = options;

  let clean = value;

  if (trim) {
    clean = clean.trim();
  }

  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }

  if (escapeHtml) {
    clean = clean
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return clean;
}

function sanitizeDeep(data, options = {}, parentKey = '') {
  if (Array.isArray(data)) {
    return data.map(item => sanitizeDeep(item, options, parentKey));
  }

  if (data !== null && typeof data === 'object') {
    const sanitized = {};
    for (const key in data) {
      sanitized[key] = sanitizeDeep(data[key], options, key);
    }
    return sanitized;
  }

  if (typeof data === 'string') {
    // ⛔ NO tocar firmas en base64
    if (parentKey && /firma/i.test(parentKey)) {
      // si quieres, solo trim:
      return data.trim();
    }
    return sanitizeString(data, options);
  }

  return data;
}


module.exports = {
  sanitizeDeep
};
