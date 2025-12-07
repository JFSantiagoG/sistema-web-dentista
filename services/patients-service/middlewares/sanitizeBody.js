// middlewares/sanitizeBody.js

// Sanitiza strings "normales"
function sanitizeString(str, options = {}) {
  let s = String(str);

  if (options.trim) {
    s = s.trim();
  }

  if (options.maxLength && s.length > options.maxLength) {
    s = s.slice(0, options.maxLength);
  }

  if (options.escapeHtml) {
    s = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return s;
}

// 👇 Cualquier clave que contenga "firma" la vamos a respetar
function isFirmaKey(keyPath) {
  return /firma|signature/i.test(keyPath);
}

// 👇 Detectar dataURL de imagen (PNG, JPG, WEBP, etc.)
function isImageBase64(value) {
  if (typeof value !== 'string') return false;
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value.trim());
}

function sanitizeValue(value, keyPath, options) {
  if (value == null) return value;

  const t = typeof value;

  // 🔹 STRINGS
  if (t === 'string') {

    // ✅ 1) NUNCA tocar firmas (por clave)
    if (isFirmaKey(keyPath)) {
      return value; // 🔥 pasa INTACTO
    }

    // ✅ 2) NUNCA tocar imágenes base64 (aunque la key no diga "firma")
    if (isImageBase64(value)) {
      return value; // 🔥 pasa INTACTO
    }

    // ✅ 3) Todo lo demás sí se sanitiza
    return sanitizeString(value, options);
  }

  // 🔹 NUMBERS / BOOLEANS
  if (t === 'number' || t === 'boolean') return value;

  // 🔹 ARRAYS
  if (Array.isArray(value)) {
    return value.map((item, idx) =>
      sanitizeValue(item, `${keyPath}[${idx}]`, options)
    );
  }

  // 🔹 OBJECTS
  if (t === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const childPath = keyPath ? `${keyPath}.${k}` : k;
      out[k] = sanitizeValue(v, childPath, options);
    }
    return out;
  }

  return value;
}

// Middleware principal
function sanitizeBody(options = {}) {
  const finalOptions = {
    trim: true,
    maxLength: 500000000000,
    escapeHtml: true,
    ...options
  };

  return function (req, res, next) {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body, '', finalOptions);
      }
    } catch (err) {
      console.error('❌ Error en sanitizeBody:', err);
      // fallback: no romper request
    }
    next();
  };
}

module.exports = { sanitizeBody };
