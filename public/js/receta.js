document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('recetaForm');
  if (!form) return console.error('❌ No se encontró #recetaForm');

  // --- refs del DOM
  const nombreEl   = form.querySelector('[name="nombrePaciente"]');
  const fechaEl    = form.querySelector('[name="fecha"]');
  const edadEl     = form.querySelector('[name="edad"]');
  const hiddenId   = document.getElementById('pacienteId');
  const tablaBody  = document.querySelector('#tablaMedicamentos tbody');
  const addBtn     = document.getElementById('addMedicamentoBtn');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnEnviar  = document.getElementById('btnEnviar');
  const canvas     = document.getElementById('signature-pad');
  const btnClear   = document.getElementById('clearSignature-pad');
  const firmaImg   = document.getElementById('firmaRecetaImg');

  const FIRMA_BASE_URL = '/api/patients/uploads';

  // --- QueryString
  const qs = new URLSearchParams(location.search);
  const pacienteIdQS   = qs.get('paciente_id') || qs.get('id');
  const formularioIdQS = qs.get('formulario_id');

  if (hiddenId && pacienteIdQS) hiddenId.value = pacienteIdQS;

  const SS_KEY   = (pid) => `receta:formId:${pid}`;
  const SAVE_KEY = (pid) => `receta:saved:${pid}`;
  let formularioId = formularioIdQS
    ? Number(formularioIdQS)
    : (pacienteIdQS ? Number(sessionStorage.getItem(SS_KEY(pacienteIdQS))) || null : null);

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('recetas') : null;
  function notificarRecetaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      if (bc) bc.postMessage({ type: 'receta-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // --- Fecha de hoy
  const hoyISO = (() => {
    const now = new Date();
    const iso = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return iso;
  })();

  // --- Auth
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // --- Helpers
  function setInput(el, val) {
    if (el) el.value = val ?? '';
  }

  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno]
      .filter(Boolean)
      .join(' ')
      .trim();

  // === MEDICAMENTOS PREDEFINIDOS ===
  const medicamentosData = {
    "Amoxicilina": {
      dosis: "500 mg",
      frecuencia: "Cada 8 horas",
      duracion: "5–7 días",
      indicaciones: "Infecciones dentales (abscesos, celulitis, periodontitis aguda)."
    },
    "Amoxicilina + Ácido clavulánico": {
      dosis: "500/125 mg o 875/125 mg",
      frecuencia: "Cada 8 o 12 horas (según formulación)",
      duracion: "5–7 días",
      indicaciones: "Infecciones moderadas a severas, o cuando se sospecha resistencia bacteriana."
    },
    "Clindamicina": {
      dosis: "300 mg",
      frecuencia: "Cada 6–8 horas",
      duracion: "5–7 días",
      indicaciones: "Alternativa en pacientes alérgicos a penicilinas."
    },
    "Ibuprofeno": {
      dosis: "400–600 mg",
      frecuencia: "Cada 6–8 horas (máx. 2400 mg/día)",
      duracion: "3–5 días (solo mientras persista el dolor/inflamación)",
      indicaciones: "Dolor postoperatorio, inflamación."
    },
    "Paracetamol": {
      dosis: "500–1000 mg",
      frecuencia: "Cada 6–8 horas (máx. 4000 mg/día)",
      duracion: "3–5 días",
      indicaciones: "Dolor leve a moderado; alternativa si hay contraindicación para AINEs."
    },
    "Ibuprofeno + Paracetamol": {
      dosis: "Ibuprofeno 400 mg + Paracetamol 500–650 mg",
      frecuencia: "Cada 8 horas (alternando o combinando según protocolo)",
      duracion: "2–5 días",
      indicaciones: "Manejo del dolor dental postoperatorio (sinergia analgésica)."
    },
    "Metronidazol": {
      dosis: "500 mg",
      frecuencia: "Cada 8 horas",
      duracion: "5–7 días",
      indicaciones: "Infecciones anaerobias (ej. periodontitis aguda, abscesos pericoronarios). Usualmente en combinación con amoxicilina."
    },
    "Diclofenaco sódico": {
      dosis: "50 mg",
      frecuencia: "Cada 8 horas",
      duracion: "3–5 días",
      indicaciones: "Dolor e inflamación postoperatoria."
    },
    "Dexametasona": {
      dosis: "4–8 mg (dosis única o dividida)",
      frecuencia: "Una sola dosis o dividida en 2–3 tomas el primer día",
      duracion: "1–3 días (generalmente solo el día de la cirugía y el siguiente)",
      indicaciones: "Reducción de edema postoperatorio (ej. tras extracciones complejas o cirugía de terceros molares)."
    },
    "Enjuague bucal con clorhexidina al 0.12%": {
      dosis: "15 mL",
      frecuencia: "Enjuague durante 30 segundos, 2 veces al día (mañana y noche)",
      duracion: "7–14 días (no más de 2 semanas continuas para evitar manchas dentales)",
      indicaciones: "Prevención de infecciones, control de placa postoperatoria."
    }
  };

  // === CREAR FILA DE MEDICAMENTO ===
  function crearFila() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select class="form-control medicamento-select" name="medicamento[]">
          <option value="" selected disabled>Seleccionar medicamento...</option>
          <option value="Amoxicilina">Amoxicilina</option>
          <option value="Amoxicilina + Ácido clavulánico">Amoxicilina + Ácido clavulánico</option>
          <option value="Clindamicina">Clindamicina</option>
          <option value="Ibuprofeno">Ibuprofeno</option>
          <option value="Paracetamol">Paracetamol</option>
          <option value="Ibuprofeno + Paracetamol">Ibuprofeno + Paracetamol</option>
          <option value="Metronidazol">Metronidazol</option>
          <option value="Diclofenaco sódico">Diclofenaco sódico</option>
          <option value="Dexametasona">Dexametasona</option>
          <option value="Enjuague bucal con clorhexidina al 0.12%">Enjuague bucal con clorhexidina al 0.12%</option>
          <option value="Otros">Otros</option>
        </select>
        <input type="text" class="form-control medicamento-otro-input mt-1" placeholder="Especificar medicamento..." style="display:none;">
      </td>
      <td><input type="text" class="form-control dosis-input" name="dosis[]" placeholder="Ej: 500 mg"></td>
      <td><input type="text" class="form-control frecuencia-input" name="frecuencia[]" placeholder="Ej: Cada 8 horas"></td>
      <td><input type="text" class="form-control duracion-input" name="duracion[]" placeholder="Ej: 5–7 días"></td>
      <td><input type="text" class="form-control indicaciones-input" name="indicaciones[]" placeholder="Indicaciones..."></td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-danger btn-delete-row">🗑️</button>
      </td>`;
    return tr;
  }

  // === MANEJAR CAMBIO EN SELECT ===
  function llenarCamposMedicamento(selectElement) {
    const medicamentoNombre = selectElement.value;
    const fila = selectElement.closest('tr');
    const otroInput = fila.querySelector('.medicamento-otro-input');

    if (medicamentoNombre === 'Otros') {
      otroInput.style.display = 'block';
      otroInput.focus();
      // Limpiar campos
      ['dosis-input', 'frecuencia-input', 'duracion-input', 'indicaciones-input'].forEach(cls => {
        const el = fila.querySelector(`.${cls}`);
        if (el) el.value = '';
      });
    } else {
      otroInput.style.display = 'none';
      otroInput.value = '';
      if (medicamentosData[medicamentoNombre]) {
        fila.querySelector('.dosis-input').value = medicamentosData[medicamentoNombre].dosis;
        fila.querySelector('.frecuencia-input').value = medicamentosData[medicamentoNombre].frecuencia;
        fila.querySelector('.duracion-input').value = medicamentosData[medicamentoNombre].duracion;
        fila.querySelector('.indicaciones-input').value = medicamentosData[medicamentoNombre].indicaciones;
      } else {
        ['dosis-input', 'frecuencia-input', 'duracion-input', 'indicaciones-input'].forEach(cls => {
          const el = fila.querySelector(`.${cls}`);
          if (el) el.value = '';
        });
      }
    }
  }

  // === CAPTURAR INPUT EN "OTROS" (opcional, solo UX) ===
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('medicamento-otro-input')) {
      // No es necesario modificar el <select>, porque buildData lo maneja
    }
  });

  // === FIRMA ===
  async function getFirmaBase64() {
    // 1) Desde imagen guardada
    if (firmaImg && firmaImg.src && firmaImg.style.display !== 'none') {
      try {
        const resp = await fetch(firmaImg.src);
        if (resp.ok) {
          const blob = await resp.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          return base64;
        }
      } catch (e) {
        console.warn('Error al obtener firma desde imagen:', e);
      }
    }

    // 2) Desde canvas
    if (canvas && !canvas.classList.contains('d-none')) {
      try {
        return canvas.toDataURL('image/png');
      } catch (e) {
        console.warn('Error al leer canvas:', e);
      }
    }

    return null;
  }

  // === BUILD DATA ===
  const buildData = () => {
    const data = {
      pacienteId: pacienteIdQS || null,
      nombrePaciente: nombreEl?.value || '',
      fecha: fechaEl?.value || '',
      edad: edadEl?.value || '',
      nombreMedico: form.nombreMedico.value,
      cedula: form.cedula.value,
      medicamentos: []
    };

    tablaBody.querySelectorAll('tr').forEach(fila => {
      const select = fila.querySelector('.medicamento-select');
      const otroInput = fila.querySelector('.medicamento-otro-input');
      let nombreMed = select?.value || '';

      if (nombreMed === 'Otros' && otroInput?.value?.trim()) {
        nombreMed = otroInput.value.trim();
      }

      data.medicamentos.push({
        nombre: nombreMed,
        dosis: fila.querySelector('[name="dosis[]"]')?.value || '',
        frecuencia: fila.querySelector('[name="frecuencia[]"]')?.value || '',
        duracion: fila.querySelector('[name="duracion[]"]')?.value || '',
        indicaciones: fila.querySelector('[name="indicaciones[]"]')?.value || ''
      });
    });

    return data;
  };

  // === UTILS ===
  function stripAccents(str = '') {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function firstAndLast(full = '') {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: '', last: '' };
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts[0], last: parts[parts.length - 1] };
  }
  function yyyymmdd(dStr) {
    const s = (dStr || '').replaceAll('-', '');
    if (s && s.length === 8) return s;
    return hoyISO.replaceAll('-', '');
  }
  function buildFilename({ fecha, formKey, fullName }) {
    const { first, last } = firstAndLast(fullName || '');
    const base = `${yyyymmdd(fecha)}_${formKey}_${[first, last].filter(Boolean).join('_')}`;
    return stripAccents(base).replace(/\s+/g, '_');
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // === TELÉFONO ===
  function normalizarTelefono(telefonoRaw) {
    if (!telefonoRaw) return null;
    const limpio = String(telefonoRaw).replace(/\D/g, '');
    if (limpio.length === 10) return '52' + limpio;
    if (limpio.length >= 11 && limpio.length <= 15) return limpio;
    return null;
  }
  function extraerTelefonoDeObjeto(p) {
    if (!p) return null;
    return (
      normalizarTelefono(p.telefono_principal) ||
      normalizarTelefono(p.telefono_secundario) ||
      normalizarTelefono(p.telefono) ||
      normalizarTelefono(p.celular) ||
      normalizarTelefono(p.whatsapp)
    );
  }

  async function setNumeroWhatsApp(btn, raw) {
    if (!btn) return;
    let numero =
      extraerTelefonoDeObjeto(raw?.paciente) ||
      extraerTelefonoDeObjeto(raw) ||
      null;

    if (!numero && raw?.paciente_id) {
      try {
        const res = await fetch(`/api/patients/${raw.paciente_id}`, { headers: authHeaders });
        if (res.ok) {
          const p = await res.json();
          numero = extraerTelefonoDeObjeto(p);
        }
      } catch (e) {
        console.warn('No se pudo obtener teléfono:', e);
      }
    }

    if (numero) {
      btn.setAttribute('data-numero-paciente', numero);
    } else {
      btn.removeAttribute('data-numero-paciente');
    }
  }

  // === MODO NUEVO ===
  async function cargarPaciente() {
    if (!pacienteIdQS) return;
    try {
      const res = await fetch(`/api/patients/${pacienteIdQS}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      if (nombreEl) nombreEl.value = buildNombre(p) || '';
      if (edadEl) edadEl.value = (p?.edad != null) ? `${p.edad} años` : '— años';
      await setNumeroWhatsApp(btnEnviar, p);
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la información del paciente.' });
    }
  }

  if (fechaEl && !formularioIdQS) {
    fechaEl.value = hoyISO;
    fechaEl.readOnly = true;
  }
  [nombreEl, edadEl].forEach(el => el && (el.readOnly = true));

  // === MODO VISUALIZAR ===
  function normMed(m = {}) {
    return {
      medicamento: m.medicamento ?? m.nombre ?? m.nombre_medicamento ?? m.drug ?? '',
      dosis: m.dosis ?? m.dose ?? '',
      frecuencia: m.frecuencia ?? m.freq ?? m.frecuencia_texto ?? '',
      duracion: m.duracion ?? m.dias ?? m.duracion_dias ?? '',
      indicaciones: m.indicaciones ?? m.indicacion ?? m.notas ?? ''
    };
  }

  function renderMedicamentos(tbody, meds = []) {
    tbody.innerHTML = '';

    if (!Array.isArray(meds) || meds.length === 0) {
      tbody.appendChild(crearFila());
      return;
    }

    const nombresPredefinidos = Object.keys(medicamentosData);

    meds.forEach(raw => {
      const m = normMed(raw);
      const esOtro = !nombresPredefinidos.includes(m.medicamento);
      const valorSelect = esOtro ? 'Otros' : m.medicamento;
      const valorOtro = esOtro ? m.medicamento : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="form-control medicamento-select" name="medicamento[]" ${formularioIdQS ? 'disabled' : ''}>
            <option value="" disabled>Seleccionar medicamento...</option>
            <option value="Amoxicilina"${valorSelect === "Amoxicilina" ? ' selected' : ''}>Amoxicilina</option>
            <option value="Amoxicilina + Ácido clavulánico"${valorSelect === "Amoxicilina + Ácido clavulánico" ? ' selected' : ''}>Amoxicilina + Ácido clavulánico</option>
            <option value="Clindamicina"${valorSelect === "Clindamicina" ? ' selected' : ''}>Clindamicina</option>
            <option value="Ibuprofeno"${valorSelect === "Ibuprofeno" ? ' selected' : ''}>Ibuprofeno</option>
            <option value="Paracetamol"${valorSelect === "Paracetamol" ? ' selected' : ''}>Paracetamol</option>
            <option value="Ibuprofeno + Paracetamol"${valorSelect === "Ibuprofeno + Paracetamol" ? ' selected' : ''}>Ibuprofeno + Paracetamol</option>
            <option value="Metronidazol"${valorSelect === "Metronidazol" ? ' selected' : ''}>Metronidazol</option>
            <option value="Diclofenaco sódico"${valorSelect === "Diclofenaco sódico" ? ' selected' : ''}>Diclofenaco sódico</option>
            <option value="Dexametasona"${valorSelect === "Dexametasona" ? ' selected' : ''}>Dexametasona</option>
            <option value="Enjuague bucal con clorhexidina al 0.12%"${valorSelect === "Enjuague bucal con clorhexidina al 0.12%" ? ' selected' : ''}>Enjuague bucal con clorhexidina al 0.12%</option>
            <option value="Otros"${valorSelect === "Otros" ? ' selected' : ''}>Otros</option>
          </select>
          <input type="text" class="form-control medicamento-otro-input mt-1" value="${valorOtro}" placeholder="Especificar medicamento..." style="display:${esOtro ? 'block' : 'none'};">
        </td>
        <td><input type="text" class="form-control" name="dosis[]" value="${m.dosis}"></td>
        <td><input type="text" class="form-control" name="frecuencia[]" value="${m.frecuencia}"></td>
        <td><input type="text" class="form-control" name="duracion[]" value="${m.duracion}"></td>
        <td><input type="text" class="form-control" name="indicaciones[]" value="${m.indicaciones}"></td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete-row">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  async function populateFromDetalle(raw) {
    const nombre = buildNombre(raw.paciente) || raw.nombrePaciente || '—';
    setInput(nombreEl, nombre);
    setInput(fechaEl, (raw.fecha || '').slice(0, 10));
    setInput(edadEl, (raw?.paciente?.edad != null) ? `${raw.paciente.edad} años` : '— años');

    renderMedicamentos(tablaBody, raw.medicamentos || []);

    // Ocultar canvas, mostrar firma guardada
    if (canvas) canvas.classList.add('d-none');
    if (btnClear) btnClear.classList.add('d-none');

    const firmaPath = raw.firma_path || raw.firmaPath || raw.firma_archivo || raw.firma;
    if (firmaImg) {
      if (firmaPath) {
        firmaImg.src = `${FIRMA_BASE_URL}/${encodeURIComponent(firmaPath)}`;
        firmaImg.style.display = 'block';
      } else {
        firmaImg.style.display = 'none';
      }
    }

    await setNumeroWhatsApp(btnEnviar, raw);
  }

  async function cargarParaVisualizar(formId) {
    try {
      const res = await fetch(`/api/patients/forms/receta/${encodeURIComponent(formId)}`, {
        headers: { Accept: 'application/json', ...authHeaders }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await populateFromDetalle(json);
    } catch (e) {
      console.error('No se pudo visualizar la receta:', e);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la receta para visualizar.' });
    }
  }

  // === LISTENERS ===
  addBtn?.addEventListener('click', () => {
    const tr = crearFila();
    tablaBody.appendChild(tr);
    Swal.fire({ icon: 'success', title: 'Medicamento agregado', timer: 900, showConfirmButton: false });
  });

  tablaBody.addEventListener('click', (e) => {
    if (e.target.closest('.btn-delete-row')) {
      const tr = e.target.closest('tr');
      if (tablaBody.rows.length === 1) {
        tr.querySelectorAll('input').forEach(i => (i.value = ''));
      } else {
        tr.remove();
      }
      Swal.fire({ icon: 'info', title: 'Fila eliminada', timer: 800, showConfirmButton: false });
    }
  });

  // Listener para los selects (incluyendo los nuevos)
  tablaBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('medicamento-select')) {
      llenarCamposMedicamento(e.target);
    }
  });

  // === GUARDAR ===
  async function guardarRecetaEnBD() {
    const data = buildData();
    const pacienteId = pacienteIdQS;

    if (!pacienteId) {
      await Swal.fire({ icon: 'warning', title: 'ID no encontrado', text: 'La URL debe incluir ?paciente_id=<id>' });
      return null;
    }

    const firma = await getFirmaBase64();
    if (firma) data.firmaBase64 = firma;

    if (!data.medicamentos.length || !data.medicamentos.some(m => m.nombre?.trim())) {
      await Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Agrega al menos un medicamento.' });
      return null;
    }

    btnGuardar && (btnGuardar.disabled = true);
    try {
      const res = await fetch(`/api/patients/${pacienteId}/recetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      formularioId = Number(json.formulario_id) || null;

      if (formularioId && pacienteId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarRecetaGuardada(pacienteId, formularioId);
      }

      await Swal.fire({ icon: 'success', title: 'Guardado', text: `Folio: ${formularioId ?? '—'}` });
      return formularioId;
    } catch (e) {
      console.error('Error al guardar receta:', e);
      await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar la receta.' });
      return null;
    } finally {
      btnGuardar && (btnGuardar.disabled = false);
    }
  }

  btnGuardar?.addEventListener('click', guardarRecetaEnBD);

  // === ENVIAR POR WHATSAPP ===
  btnEnviar?.addEventListener('click', async () => {
    const numero = btnEnviar.getAttribute('data-numero-paciente');
    if (!numero || !/^\d{10,15}$/.test(numero)) {
      await Swal.fire({ icon: 'warning', title: 'Número no disponible', text: 'El paciente no tiene un número de WhatsApp válido registrado.' });
      return;
    }

    const mensaje = encodeURIComponent('Hola, adjunto su receta médica.');
    const url = `https://wa.me/${numero}?text=${mensaje}`;
    window.open(url, '_blank');
  });

  // === PDF ===
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formularioId) {
      await Swal.fire({ title: 'Primero guarda la receta', text: 'Para generar el PDF necesitas guardar la receta y obtener un folio.', icon: 'warning' });
      return;
    }

    const pre = await Swal.fire({ icon: 'info', title: 'Se abrirá el PDF en otra pestaña', text: 'Al regresar, podrás descargarlo desde aquí con un nombre sugerido.', confirmButtonText: 'Entendido' });
    if (!pre.isConfirmed) return;

    const data = buildData();
    const firma = await getFirmaBase64();
    if (firma) data.firmaMedico = firma;
    data.formularioId = formularioId;

    try {
      const res = await fetch('/api/pdf/receta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      const fullName = (nombreEl?.value || '').trim();
      const fecha = fechaEl?.value || hoyISO;
      const filename = buildFilename({ fecha, formKey: 'receta', fullName });

      await Swal.fire({
        icon: 'success',
        title: 'PDF listo',
        html: `<p>El PDF se abrió en otra pestaña.</p><p class="mb-1"><small>Nombre sugerido:</small></p><code style="user-select:all">${filename}.pdf</code>`,
        showCancelButton: true,
        confirmButtonText: '⬇️ Descargar PDF',
        cancelButtonText: 'Cerrar'
      }).then((r) => {
        if (r.isConfirmed) downloadBlob(blob, filename);
      });

      URL.revokeObjectURL(viewUrl);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el PDF.' });
    }
  });

  // === FLUJO INICIAL ===
  if (formularioIdQS) {
    // Modo visualizar
    btnGuardar?.classList.add('d-none');
    addBtn?.classList.add('d-none');
    btnClear?.classList.add('d-none');
    await cargarParaVisualizar(formularioIdQS);

    // Bloquear campos
    form.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.type !== 'hidden') {
        el.setAttribute('readonly', 'true');
        el.setAttribute('disabled', 'true');
        el.classList.add('bg-light');
      }
    });
    tablaBody.querySelectorAll('.btn-delete-row').forEach(btn => btn.style.display = 'none');

  } else if (pacienteIdQS) {
    await cargarPaciente();
  }
});

document.getElementById('anio-actual').textContent = new Date().getFullYear();