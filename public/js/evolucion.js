// public/js/evolucion.js
document.addEventListener('DOMContentLoaded', () => {
  // --- Auth
  const token = localStorage.getItem('token');
  const roles = JSON.parse(localStorage.getItem('roles') || '[]');
  if (!token || roles.length === 0) {
    location.href = '/login.html';
    return;
  }
  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // --- Refs
  const pacienteSelect = document.getElementById('pacienteSelect');
  const numeroPacienteInput = document.getElementById('numeroPacienteInput');
  const fechaRegistroInput  = document.getElementById('fechaRegistroInput');
  const fechaInicio = document.getElementById('fechaInicio');
  const fechaFin    = document.getElementById('fechaFin');
  const tbody   = document.getElementById('evolucionTableBody');
  const btnAdd  = document.getElementById('btnAddRow');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnEnviar  = document.getElementById('btnEnviar');
  const btnPDF     = document.getElementById('btnPDF');

  // Firma (solo PDF)
  const canvas = document.getElementById('signature-pad');
  const clearBtn = document.getElementById('clearSignature-pad');

  if (canvas) {
    canvas.addEventListener('click', () => { canvas.dataset.sigEnabled = '1'; }, { once: true });
    clearBtn?.addEventListener('click', () => { delete canvas.dataset.sigEnabled; });
  }

  // --- Estado
  let contadorFilas = 0;
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id') || '';
  const SS_KEY = (pid) => `evolucion:formId:${pid}`;
  let formularioId = pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null;

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('evoluciones') : null;
  function notificarGuardado(pid, folio) {
    try {
      localStorage.setItem(`evolucion:saved:${pid}`, String(Date.now()));
      bc?.postMessage?.({ type: 'evolucion-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // --- SweetAlert helpers (usamos SweetAlert2 del CDN)
  const info = (title, text='')  => Swal.fire({ icon: 'info',    title, text });
  const ok   = (title, text='')  => Swal.fire({ icon: 'success', title, text });
  const err  = (title, text='')  => Swal.fire({ icon: 'error',   title, text });
  const warn = (title, text='')  => Swal.fire({ icon: 'warning', title, text });
  const ask  = async (title, text='', confirm='Sí', cancel='Cancelar') => {
    const r = await Swal.fire({
      title, text, icon: 'question',
      showCancelButton: true,
      confirmButtonText: confirm,
      cancelButtonText: cancel
    });
    return r.isConfirmed;
  };

  // --- Utilidades
  const todayISO = () => {
    const now = new Date();
    const z = new Date(now.getTime() - now.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
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

  // ====== UI: una sola fila al entrar ======
  function crearFila(){
    contadorFilas++;
    const filaId = `fila-${contadorFilas}`;
    const tr = document.createElement('tr');
    tr.id = filaId;
    tr.innerHTML = `
      <td><input type="date" name="fecha" class="form-control form-control-sm required-field" required></td>
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
      <td><input type="number" name="costo" class="form-control form-control-sm" placeholder="0.00" min="0" step="0.01"></td>
      <td><input type="text" name="ac" class="form-control form-control-sm" placeholder="Antecedentes/Comentarios"></td>
      <td><textarea name="proxima" class="form-control form-control-sm" rows="2" placeholder="Próxima cita y tratamiento..."></textarea></td>
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
  }

  function eliminarFila(id){ document.getElementById(id)?.remove(); }

  tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const id = btn.getAttribute('data-del');
    ask('Eliminar', '¿Deseas eliminar esta evolución?', 'Sí, eliminar')
      .then(ok => { if (ok) eliminarFila(id); });
  });
  btnAdd?.addEventListener('click', crearFila);

  // ====== Cargar paciente ======
  async function cargarPaciente(){
    fechaRegistroInput.value = todayISO();
    if (pacienteId){
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
      } catch(e) {
        console.error('Error cargando paciente:', e);
        await err('Error', 'No se pudo cargar el paciente.');
      }
    }
  }
  cargarPaciente();

  // ====== Helpers ======
  function buildEvolucionesArray(){
    const rows = [...tbody.querySelectorAll('tr')];
    return rows.map(tr=>{
      const fecha = tr.querySelector('[name="fecha"]').value;
      const sel   = tr.querySelector('[name="tratamiento"]');
      const otro  = tr.querySelector('[name="otro"]').value.trim();
      const costo = tr.querySelector('[name="costo"]').value;
      const ac    = tr.querySelector('[name="ac"]').value;
      const prox  = tr.querySelector('[name="proxima"]').value;
      let tratamiento = sel.value;
      if (tratamiento === 'Otro' && otro) tratamiento = otro;
      return { fecha, tratamiento, costo: costo ? Number(costo) : 0, ac, proxima: prox };
    });
  }

  function validarMinimo(){
    const req = tbody.querySelectorAll('.required-field');
    for (const el of req) if (!el.value.trim()) return false;
    return true;
  }

  // ====== Guardar (sin firma)
  async function guardarEnBD(){
    if (!pacienteId) return warn('Falta ID', 'Agrega ?paciente_id en la URL.');
    if (!pacienteSelect.value) return warn('Paciente', 'Selecciona un paciente.');
    if (!validarMinimo()) return warn('Campos', 'Completa al menos la fecha.');

    if (formularioId){
      const nuevo = await ask(`Folio ${formularioId} ya creado.`, '¿Deseas crear otra evolución?', 'Sí, crear otra');
      if (!nuevo) return;
      formularioId = null;
      sessionStorage.removeItem(SS_KEY(pacienteId));
    }

    const payload = {
      fecha_registro: fechaRegistroInput.value,
      evoluciones: buildEvolucionesArray()
    };

    console.log('📩 Enviando a BD /evoluciones:', JSON.stringify(payload));

    try {
      const res = await fetch(`/api/patients/${pacienteId}/evoluciones`, {
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
      return formularioId;
    } catch (e) {
      console.error('Error guardando evolución:', e);
      await err('Error', 'No se pudo guardar la evolución.');
      return null;
    }
  }

  // ====== Enviar (simulado)
  async function enviarFormulario(){
    if (!formularioId){
      const folio = await guardarEnBD();
      if (!folio) return;
    }
    await ok('Formulario enviado', `Folio ${formularioId}`);
  }

  // ====== PDF (con firma solo PDF)
  btnPDF?.addEventListener('click', async () => {
    if (!pacienteSelect.value) return warn('Paciente', 'Selecciona/carga un paciente válido.');
    if (!validarMinimo()) return warn('Campos', 'Completa al menos la fecha.');

    const selected = pacienteSelect.options[pacienteSelect.selectedIndex];
    const nombrePaciente = selected.text;
    const idPaciente = selected.value;
    const evoluciones = buildEvolucionesArray();

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

  btnGuardar?.addEventListener('click', guardarEnBD);
  btnEnviar?.addEventListener('click', enviarFormulario);

  // ====== Init
  (function init() {
    fechaRegistroInput.value = todayISO();
    crearFila(); // ✅ solo una fila
  })();
});
