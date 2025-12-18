// public/js/evolucion.js
// Modo crear:   /forms/evolucion.html?paciente_id=12
// Visualizar:   /forms/evolucion.html?formulario_id=116
// Append:       /forms/evolucion.html?formulario_id=116&append=1
// Reglas:
// - "Agregar evolución" solo crea FILA en UI (no guarda).
// - "Guardar" escribe en BD:
//     * crear  -> POST /api/patients/:pacienteId/evoluciones
//     * append -> PUT  /api/patients/evoluciones/:formularioId  (solo nuevas filas)
// - "Enviar" siempre es simulación (no guarda)

document.addEventListener('DOMContentLoaded', () => {
  // --- Auth
  const token = localStorage.getItem('token');
  let roles = [];
  try { roles = JSON.parse(localStorage.getItem('roles') || '[]'); } catch {}
  if (!token || roles.length === 0) { location.href = '/login.html'; return; }
  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // --- Refs
  const pacienteSelect      = document.getElementById('pacienteSelect');
  const numeroPacienteInput = document.getElementById('numeroPacienteInput');
  const fechaRegistroInput  = document.getElementById('fechaRegistroInput');

  const fechaInicio         = document.getElementById('fechaInicio');
  const fechaFin            = document.getElementById('fechaFin');
  const btnFiltrar          = document.getElementById('btnFiltrar');
  const btnLimpiarFiltros   = document.getElementById('btnLimpiarFiltros');

  const tbody               = document.getElementById('evolucionTableBody');
  const btnAdd              = document.getElementById('btnAddRow');
  const btnGuardar          = document.getElementById('btnGuardar');
  const btnEnviar           = document.getElementById('btnEnviar');
  const btnPDF              = document.getElementById('btnPDF');

  // --- teléfono helpers (igual que en receta.js)
  function normalizarTelefono(telefonoRaw) {
    if (!telefonoRaw) return null;
    const limpio = String(telefonoRaw).replace(/\D/g, '');
    if (limpio.length === 10) {
      return '52' + limpio; // MX nacional
    }
    if (limpio.length >= 11 && limpio.length <= 15) {
      return limpio;
    }
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

    if (!numero) {
      const pid = raw?.paciente_id || pacienteId;
      if (pid) {
        try {
          const res = await fetch(`/api/patients/${pid}`, { headers: authHeaders });
          if (res.ok) {
            const p = await res.json();
            numero = extraerTelefonoDeObjeto(p);
          }
        } catch (e) {
          console.warn('No se pudo obtener teléfono desde /api/patients/', e);
        }
      }
    }

    if (numero) {
      btn.setAttribute('data-numero-paciente', numero);
    } else {
      btn.removeAttribute('data-numero-paciente');
    }
  }

  // Firma (solo para PDF)
  const canvas   = document.getElementById('signature-pad');
  const clearBtn = document.getElementById('clearSignature-pad');
  if (canvas) {
    canvas.addEventListener('click', () => { canvas.dataset.sigEnabled = '1'; }, { once: true });
    clearBtn?.addEventListener('click', () => { delete canvas.dataset.sigEnabled; });
  }

  // --- Estado y modo
  const qs = new URLSearchParams(location.search);
  const pacienteId        = qs.get('paciente_id') || qs.get('id') || '';
  const formularioIdParam = qs.get('formulario_id') || '';
  const isAppendMode      = !!(formularioIdParam && qs.get('append') === '1');
  const isVisualizar      = !!(formularioIdParam && !isAppendMode);

  let contadorFilas = 0;
  const SS_KEY = (pid) => `evolucion:formId:${pid}`;
  let formularioId = pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null;

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('evoluciones') : null;
  function notificarGuardado(pid, folio) {
    try {
      localStorage.setItem(`evolucion:saved:${pid}`, String(Date.now()));
      bc?.postMessage?.({ type: 'evolucion-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // --- SweetAlert helpers
  const info = (title, text='')  => Swal.fire({ icon: 'info',    title, text });
  const ok   = (title, text='')  => Swal.fire({ icon: 'success', title, text });
  const err  = (title, text='')  => Swal.fire({ icon: 'error',   title, text });
  const warn = (title, text='')  => Swal.fire({ icon: 'warning', title, text });
  const ask  = async (title, text='', confirm='Sí', cancel='Cancelar') => {
    const r = await Swal.fire({ title, text, icon: 'question', showCancelButton: true, confirmButtonText: confirm, cancelButtonText: cancel });
    return r.isConfirmed;
  };

  // --- Utils
  const todayISO = () => {
    const now = new Date();
    const z = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0,10); // YYYY-MM-DD
  };
  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ').trim();

  function stripAccents(str=''){ return str.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function firstAndLast(full=''){
    const parts = (full||'').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return {first:'', last:''};
    if (parts.length===1) return {first:parts[0], last:''};
    return {first:parts[0], last:parts[parts.length-1]};
  }
  function yyyymmdd(dStr){ const s=(dStr||'').replaceAll('-',''); return (s && s.length===8)? s : todayISO().replaceAll('-',''); }
  function buildFilename({ fecha, formKey, fullName }){
    const { first, last } = firstAndLast(fullName||'');
    const base = `${yyyymmdd(fecha)}_${formKey}_${[first,last].filter(Boolean).join('_')}`;
    return stripAccents(base).replace(/\s+/g,'_');
  }
  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // ====== UI helpers ======
  function crearFila(values = {}, isNew = true) {
    // values.fecha DEBE venir como 'YYYY-MM-DD' si se pasa
    const vFecha = (values.fecha || '').slice(0,10);
    const vTrat  = values.tratamiento || '';
    const vCosto = (values.costo != null && values.costo !== '') ? Number(values.costo) : '';
    const vAC    = values.ac || '';
    const vProx  = values.proxima || '';

    contadorFilas++;
    const filaId = `fila-${contadorFilas}`;

    const tr = document.createElement('tr');
    tr.id = filaId;
    if (isNew) tr.dataset.new = '1'; // <- marcar nuevas filas para append

    tr.innerHTML = `
      <td><input type="date" name="fecha" class="form-control form-control-sm required-field" required value="${vFecha}"></td>
      <td>
        <select name="tratamiento" class="form-select form-select-sm tratamiento-select">
          <option value="">Seleccionar tratamiento...</option>
          <option value="Limpieza">Limpieza</option>
          <option value="Resina">Resina</option>
          <option value="Ortodoncia">Ortodoncia</option>
          <option value="Cirugía">Cirugía</option>
          <option value="Endodoncia">Endodoncia</option>
          <option value="Corona">Corona</option>
          <option value="Extracción">Extracción</option>
          <option value="Blanqueamiento">Blanqueamiento</option>
          <option value="Otro">Otro (especificar)</option>
        </select>
        <input type="text" name="otro" class="form-control form-control-sm mt-1 otro-tratamiento"
               placeholder="Especificar tratamiento..." style="display:none;">
      </td>
      <td><input type="number" name="costo" class="form-control form-control-sm" placeholder="0.00" min="0" step="0.01" value="${vCosto !== '' ? vCosto : ''}"></td>
      <td><input type="text" name="ac" class="form-control form-control-sm" placeholder="Antecedentes/Comentarios" value="${vAC}"></td>
      <td><textarea name="proxima" class="form-control form-control-sm" rows="2" placeholder="Próxima cita y tratamiento...">${vProx}</textarea></td>
      <td class="text-center">
        <button type="button" class="btn btn-remove-row" data-del="${filaId}" title="Eliminar entrada">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);

    const select = tr.querySelector('.tratamiento-select');
    const otro   = tr.querySelector('.otro-tratamiento');
    select.addEventListener('change', () => {
      otro.style.display = select.value === 'Otro' ? 'block' : 'none';
      if (select.value !== 'Otro') otro.value = '';
    });

    // Set opción si viene valor
    if (vTrat) {
      const options = [...select.options].map(o => o.value);
      if (options.includes(vTrat)) {
        select.value = vTrat;
      } else {
        select.value = 'Otro';
        otro.style.display = 'block';
        otro.value = vTrat;
      }
    }

    // Si la fila es "vieja" (no editable), bloquear inputs y ocultar borrar
    if (!isNew) {
      [...tr.querySelectorAll('input, select, textarea')].forEach(el => el.setAttribute('disabled','true'));
      tr.querySelector('.btn-remove-row').style.visibility = 'hidden';
      tr.querySelector('.btn-remove-row').disabled = true;
    }
  }

  function eliminarFila(id){ document.getElementById(id)?.remove(); }
  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const tr = document.getElementById(btn.getAttribute('data-del'));
    // Solo permitir borrar filas NUEVAS
    if (tr && tr.dataset.new === '1') {
      eliminarFila(tr.id);
    }
  });
  btnAdd?.addEventListener('click', () => crearFila({}, true));

  // ====== Cargar MODO CREAR
  async function cargarPaciente() {
    fechaRegistroInput.value = todayISO();
    if (!pacienteId) return;
    numeroPacienteInput.value = String(pacienteId);
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      const name = buildNombre(p) || '(Sin nombre)';
      pacienteSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = String(pacienteId);
      opt.textContent = name;
      opt.selected = true;
      pacienteSelect.appendChild(opt);
      await setNumeroWhatsApp(btnEnviar, p);
    } catch(e) {
      console.error('Error cargando paciente:', e);
      await err('Error', 'No se pudo cargar el paciente.');
    }
  }

  // ====== Cargar VISUALIZAR / APPEND
  async function cargarEvolucionVisualizar(formId) {
    try {
      const res = await fetch(`/api/patients/forms/evolucion/${encodeURIComponent(formId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      numeroPacienteInput.value = json.paciente_id || '';
      fechaRegistroInput.value  = (json.fecha_registro || todayISO()).slice(0,10);
      pacienteSelect.innerHTML  = '';
      const opt = document.createElement('option');
      opt.value = String(json.paciente_id || '');
      opt.textContent = json.paciente || '(Sin nombre)';
      opt.selected = true;
      pacienteSelect.appendChild(opt);
      pacienteSelect.disabled = true;

      // Pinta filas existentes como congeladas
      tbody.innerHTML = '';
      (json.evoluciones || []).forEach(ev => {
        // Normaliza fecha a YYYY-MM-DD
        const evNorm = { ...ev, fecha: (ev.fecha || '').slice(0,10) };
        crearFila(evNorm, false); // <- NO new
      });

      // Visualizar puro: ocultar agregar/guardar
      if (isVisualizar) {
        btnAdd?.classList.add('d-none');
        btnGuardar?.classList.add('d-none');
      }

      // Append: dejar visibles Agregar y Guardar para nuevas filas (las viejas siguen bloqueadas)
      if (isAppendMode) {
        btnAdd?.classList.remove('d-none');
        btnGuardar?.classList.remove('d-none');
      }

      formularioId = json.formulario_id || Number(formularioIdParam) || null;
    } catch (e) {
      console.error('Error cargar evolución visualizar:', e);
      await err('Error', 'No se pudo cargar la evolución.');
    }
    await setNumeroWhatsApp(btnEnviar, json); 
  }

  // ====== Construcción de payload
  function collectRows({ onlyNew = false } = {}) {
    const rows = [...tbody.querySelectorAll('tr')];
    return rows
      .filter(tr => !onlyNew || tr.dataset.new === '1')
      .map(tr => {
        const fecha = tr.querySelector('[name="fecha"]')?.value || '';
        const sel   = tr.querySelector('[name="tratamiento"]');
        const otro  = tr.querySelector('[name="otro"]')?.value.trim() || '';
        const costo = tr.querySelector('[name="costo"]')?.value || '';
        const ac    = tr.querySelector('[name="ac"]')?.value || '';
        const prox  = tr.querySelector('[name="proxima"]')?.value || '';
        let tratamiento = sel?.value || '';
        if (tratamiento === 'Otro' && otro) tratamiento = otro;
        return { fecha, tratamiento, costo: costo ? Number(costo) : 0, ac, proxima: prox };
      });
  }

  function validarMinimoFilaNueva(){
    const news = [...tbody.querySelectorAll('tr[data-new="1"]')];
    if (news.length === 0) return false;
    for (const tr of news) {
      const f = tr.querySelector('[name="fecha"]');
      if (!f || !f.value) return false;
    }
    return true;
  }

  // ====== Guardar
  async function guardarEnBD(){
    // Visualizar puro: no guarda
    if (isVisualizar) return;

    // Crear
    if (!formularioIdParam) {
      if (!pacienteId) return warn('Falta ID', 'Agrega ?paciente_id en la URL.');
      if (!pacienteSelect.value) return warn('Paciente', 'Selecciona un paciente.');
      if (![...tbody.querySelectorAll('tr')].length) return warn('Campos', 'Agrega al menos una evolución.');
      // Validación básica: fecha mínima
      const anyReq = [...tbody.querySelectorAll('.required-field')].some(el => !el.value.trim());
      if (anyReq) return warn('Campos', 'Completa al menos la fecha.');

      const payload = {
        fecha_registro: fechaRegistroInput.value,
        evoluciones: collectRows({ onlyNew: false })
      };

      try {
        const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/evoluciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        formularioId = Number(json.formulario_id) || null;
        if (formularioId){
          sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
          notificarGuardado(pacienteId, formularioId);
        }
        await ok('Guardado', `Folio: ${formularioId ?? '—'}`);
        // Redirigir a visualizar ese folio
        location.replace(`evolucion.html?formulario_id=${formularioId}`);
        return formularioId;
      } catch (e) {
        console.error('Error guardando evolución (crear):', e);
        await err('Error', 'No se pudo guardar la evolución.');
        return null;
      }
    }

    // Append al MISMO formulario
    if (isAppendMode) {
      const nuevas = collectRows({ onlyNew: true });
      if (nuevas.length === 0) return warn('Sin nuevas filas', 'Agrega al menos una evolución nueva.');
      if (!validarMinimoFilaNueva()) return warn('Campos', 'Cada fila nueva debe tener fecha.');

      const payload = { evoluciones: nuevas };

      try {
        const res = await fetch(`/api/patients/evoluciones/${encodeURIComponent(formularioIdParam)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        await ok('Guardado', `Se anexaron ${nuevas.length} evolución(es) al folio ${formularioIdParam}.`);
        // Refrescar a VISUALIZAR limpio (sin &append=1), para ver todo congelado
        location.replace(`evolucion.html?formulario_id=${formularioIdParam}`);
        return Number(formularioIdParam);
      } catch (e) {
        console.error('Error guardando evolución (append):', e);
        await err('Error', 'No se pudo anexar la(s) evolución(es).');
        return null;
      }
    }
  }

  // ====== Enviar por WhatsApp o simular
  async function enviarFormulario() {
    const numero = btnEnviar?.getAttribute('data-numero-paciente');
    const folio = formularioIdParam || formularioId || '(sin folio)';

    if (numero && /^\d{10,15}$/.test(numero)) {
      const mensaje = encodeURIComponent(`Hola, adjunto su hoja de evolución clínica. Folio: ${folio}`);
      const url = `https://wa.me/${numero}?text=${mensaje}`;
      window.open(url, '_blank');
    } else {
      await ok('📤 Contactar con paciente', `No se encontró número de WhatsApp.\nFolio: ${folio}\n\n(Puede descargar el PDF y enviarlo manualmente.)`);
    }
  }

  // ====== PDF (incluye TODO en append)
  btnPDF?.addEventListener('click', async () => {
    // En visualizar/append el paciente ya viene cargado en el select
    if (!pacienteSelect.value) return warn('Paciente', 'Selecciona/carga un paciente válido.');
    // En crear, pide al menos fecha en alguna fila
    if (!formularioIdParam) {
      const anyReq = [...tbody.querySelectorAll('.required-field')].some(el => !el.value.trim());
      if (anyReq) return warn('Campos', 'Completa al menos la fecha.');
    }

    const selected        = pacienteSelect.options[pacienteSelect.selectedIndex];
    const nombrePaciente  = selected?.text || '';
    const idPaciente      = selected?.value || '';
    // En append queremos PDF con TODO: filas viejas (congeladas) + nuevas
    const evoluciones     = collectRows({ onlyNew: false });

    let firmaPaciente = null;
    if (canvas?.dataset?.sigEnabled === '1') {
      try {
        const blank = document.createElement('canvas');
        blank.width = canvas.width; blank.height = canvas.height;
        if (canvas.toDataURL() !== blank.toDataURL()) {
          firmaPaciente = canvas.toDataURL('image/png');
        }
      } catch {}
    }

    const data = {
      idPaciente,
      nombrePaciente,
      numeroPaciente: numeroPacienteInput.value,
      fechaRegistro: fechaRegistroInput.value,
      evoluciones,
      firmaPaciente
    };

    await info('Generando PDF', 'Se abrirá en otra pestaña.');

    try {
      const res = await fetch('/api/pdf/evolucion/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      const filename = buildFilename({ fecha: data.fechaRegistro, formKey: 'evolucion', fullName: nombrePaciente });
      const { isConfirmed } = await Swal.fire({
        icon: 'success',
        title: 'PDF listo',
        html: `
          <p>El PDF se abrió en otra pestaña.</p>
          <p class="mb-1"><small>Nombre sugerido:</small></p>
          <code style="user-select:all">${filename}.pdf</code>
        `,
        showCancelButton: true,
        confirmButtonText: '⬇️ Descargar PDF',
        cancelButtonText: 'Cerrar'
      });
      if (isConfirmed) downloadBlob(blob, filename);
      URL.revokeObjectURL(viewUrl);
    } catch (e) {
      console.error('Error PDF evolución:', e);
      await err('Error', 'No se pudo generar el PDF.');
    }
  });

  // ====== Eventos
  btnGuardar?.addEventListener('click', guardarEnBD);
  btnEnviar?.addEventListener('click', enviarFormulario);

  // ====== Filtros (front-only)
  btnFiltrar?.addEventListener('click', () => {
    const fi = fechaInicio.value;
    const ff = fechaFin.value;
    if (!fi && !ff) return;
    [...tbody.querySelectorAll('tr')].forEach(tr => {
      const f = tr.querySelector('[name="fecha"]')?.value || '';
      let show = true;
      if (fi && f < fi) show = false;
      if (ff && f > ff) show = false;
      tr.style.display = show ? '' : 'none';
    });
  });
  btnLimpiarFiltros?.addEventListener('click', () => {
    fechaInicio.value = ''; fechaFin.value = '';
    [...tbody.querySelectorAll('tr')].forEach(tr => tr.style.display = '');
  });

  // ====== Init
  (async function init() {
    fechaRegistroInput.value = todayISO();

    if (formularioIdParam) {
      await cargarEvolucionVisualizar(formularioIdParam);
    } else {
      await cargarPaciente();
      crearFila({}, true); // una fila por defecto
    }
  })();
});
