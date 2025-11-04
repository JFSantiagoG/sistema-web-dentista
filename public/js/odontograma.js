/***************** ========= HELPERS ========= *****************/
function yyyymmdd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}
function nombreTitulo(str = '') {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
}
function buildOdontogramaPdfName({ paciente }) {
  const fecha = yyyymmdd(new Date());
  const nombre = nombreTitulo(paciente || 'Paciente');
  return `${fecha}_odontograma_${nombre}.pdf`;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/***************** ========= APP ========= *****************/
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('odontogramaForm');

  // Inputs
  const nombreEl = form.querySelector('#nombrePaciente');
  const fechaEl  = form.querySelector('#fechaTermino');

  // Botones
  const btnGuardar = document.getElementById('btnGuardarOdonto');
  const btnPdf     = document.getElementById('btnDescargarPDF');

  // Query params y auth
  const qs = new URLSearchParams(location.search);
  const pacienteIdQS   = qs.get('paciente_id');
  const formularioIdQS = qs.get('formulario_id');

  // Modo
  const ES_MODO_VISUALIZAR = Boolean(formularioIdQS);
  const ES_MODO_CREAR      = Boolean(pacienteIdQS) && !formularioIdQS;

  // Auth
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Estado (folio)
  const SS_KEY   = (pid) => `odonto:formId:${pid}`;
  const SAVE_KEY = (pid) => `odonto:saved:${pid}`;
  let formularioId = ES_MODO_VISUALIZAR
    ? Number(formularioIdQS)
    : (pacienteIdQS ? Number(sessionStorage.getItem(SS_KEY(pacienteIdQS))) || null : null);

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('odontograma') : null;
  function notificarGuardado(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      if (bc) bc.postMessage({ type: 'odontograma-final-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  /*************** Interacción visual con los dientes ***************/
  function activarInteraccionDientes(activo) {
    document.querySelectorAll('.diente').forEach(diente => {
      diente.style.cursor = activo ? 'pointer' : 'default';
      diente.onclick = null;
      if (activo) diente.addEventListener('click', onClickDiente);
    });

    document.querySelectorAll('.tratamientos-tabla input[type="checkbox"]').forEach(checkbox => {
      checkbox.onchange = null;
      checkbox.disabled = !activo;
      if (activo) {
        checkbox.addEventListener('change', function () {
          const dienteId = this.getAttribute('data-diente');
          const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
          if (dienteElement) {
            dienteElement.classList.toggle('tratamiento-asignado', this.checked);
            dienteElement.classList.remove('pendiente');
          }
        });
      }
    });
  }
  function onClickDiente(e) {
    const diente = e.currentTarget;
    diente.classList.toggle('tratamiento-asignado');
    diente.classList.remove('pendiente');
  }

  /*************** Cargar nombre del paciente (modo crear) ***************/
  async function cargarPaciente() {
    if (!ES_MODO_CREAR) return;
    if (!pacienteIdQS) {
      await Swal.fire({ icon:'warning', title:'ID faltante', text:'Incluye ?paciente_id=<id> en la URL.' });
      return;
    }
    try {
      const res = await fetch(`/api/patients/${pacienteIdQS}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();

      const nombreCompleto = [p?.nombre, p?.apellido].filter(Boolean).join(' ').trim();
      if (nombreEl) {
        nombreEl.value = nombreCompleto || '';
        nombreEl.readOnly = true;
      }
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el paciente.' });
    }
  }

  /*************** Recolectar datos ***************/
  function recolectarTratamientosPorDiente() {
    const tpd = {};
    document.querySelectorAll('.tratamientos-tabla tbody tr').forEach(fila => {
      const nombreTratamiento = fila.querySelector('td')?.textContent.trim();
      fila.querySelectorAll('input[type="checkbox"][data-diente]').forEach(checkbox => {
        const dienteId = checkbox.getAttribute('data-diente');
        if (checkbox.checked) {
          if (!tpd[dienteId]) tpd[dienteId] = [];
          tpd[dienteId].push(nombreTratamiento);
        }
      });
    });
    return tpd;
  }
  function recolectarEstadoEncia() {
    const estado = {};
    document.querySelectorAll('.encia-table tbody tr').forEach(fila => {
      const condicion = fila.querySelector('td')?.textContent.trim();
      const valor     = fila.querySelector('input')?.value.trim();
      if (condicion) estado[condicion] = valor || '';
    });
    return estado;
  }
  async function capturarOdontogramaVisual() {
    const odontogramaContainer = document.querySelector('.dientes-container');
    if (!odontogramaContainer) return null;
    const odontogramaCanvas = await html2canvas(odontogramaContainer, { backgroundColor: null, useCORS: true });
    return odontogramaCanvas.toDataURL('image/png');
  }
  function payloadComun() {
    const nombrePaciente = nombreEl?.value.trim();
    const fechaTermino   = fechaEl?.value.trim();
    return {
      paciente: { nombre: nombrePaciente, fechaTermino },
      tratamientosPorDiente: recolectarTratamientosPorDiente(),
      estadoEncia: recolectarEstadoEncia()
    };
  }

  /*************** Guardar en BD (sólo crear) ***************/
  async function guardarOdontogramaEnBD() {
    if (!ES_MODO_CREAR) return null;
    if (!pacienteIdQS) {
      await Swal.fire({ icon:'warning', title:'ID faltante', text:'Incluye ?paciente_id=<id> en la URL.' });
      return null;
    }
    const nombrePaciente = nombreEl?.value.trim();
    const fechaTermino   = fechaEl?.value.trim();
    if (!nombrePaciente || !fechaTermino) {
      await Swal.fire({ icon:'warning', title:'Campos faltantes', text:'Completa el nombre y la fecha de término.' });
      return null;
    }

    if (formularioId) {
      const r = await Swal.fire({
        icon:'question',
        title:`Este odontograma ya fue guardado (folio ${formularioId}).`,
        text:'¿Deseas guardar uno nuevo?',
        showCancelButton:true,
        confirmButtonText:'Sí, crear otro',
        cancelButtonText:'Cancelar'
      });
      if (!r.isConfirmed) return null;
    }

    const base = payloadComun();
    const body = {
      nombre_paciente: base.paciente.nombre,
      fecha_termino: base.paciente.fechaTermino,
      tratamientos_por_diente: base.tratamientosPorDiente,
      estado_encia: base.estadoEncia
    };

    try {
      const res = await fetch(`/api/patients/${pacienteIdQS}/odontograma`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      formularioId = Number(json.formulario_id) || null;
      if (formularioId) {
        sessionStorage.setItem(SS_KEY(pacienteIdQS), String(formularioId));
        notificarGuardado(pacienteIdQS, formularioId);
      }

      await Swal.fire({ icon:'success', title:'Guardado', text:`Folio: ${formularioId ?? '—'}` });
      return formularioId;
    } catch (e) {
      console.error('Error al guardar odontograma:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar el odontograma final.' });
      return null;
    }
  }

  /*************** PDF ***************/
  async function generarPDF() {
    if (!formularioId) {
      await Swal.fire({ icon:'info', title:'Primero guarda', text:'Necesitas un folio para generar el PDF.' });
      return;
    }

    const pre = await Swal.fire({
      icon:'info',
      title:'Se abrirá el PDF en otra pestaña',
      text:'Al regresar, podrás descargarlo con un nombre sugerido.',
      confirmButtonText:'Entendido'
    });
    if (!pre.isConfirmed) return;

    const base = payloadComun();
    const odontogramaImg = await capturarOdontogramaVisual();
    const dataPdf = {
      paciente: base.paciente,
      tratamientosPorDiente: base.tratamientosPorDiente,
      estadoEncia: base.estadoEncia,
      odontogramaVisual: odontogramaImg,
      formularioId
    };

    try {
      const res = await fetch('/api/pdf/odontograma/generate', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(dataPdf)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      const filename = buildOdontogramaPdfName({ paciente: base.paciente.nombre });
      const post = await Swal.fire({
        icon:'success',
        title:'PDF listo',
        html: `
          <p>El PDF se abrió en otra pestaña.</p>
          <p class="mb-1"><small>Nombre sugerido:</small></p>
          <code style="user-select:all">${filename}</code>
        `,
        showCancelButton:true,
        confirmButtonText:'⬇️ Descargar PDF',
        cancelButtonText:'Cerrar'
      });
      if (post.isConfirmed) downloadBlob(blob, filename);

      URL.revokeObjectURL(viewUrl);
    } catch (e) {
      console.error('Error al generar PDF:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  }

  /*************** Cargar datos en modo VISUALIZAR ***************/
  async function cargarFormularioSiAplica() {
    if (!ES_MODO_VISUALIZAR) return;

    try {
      const res = await fetch(`/api/patients/forms/odontograma/${formularioIdQS}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (nombreEl) {
        nombreEl.value = (data?.paciente || '').trim();
        nombreEl.readOnly = true;
      }
      if (fechaEl) {
        const ft = (data?.fecha_termino || '').slice(0,10);
        fechaEl.value = ft || '';
        fechaEl.readOnly = true;
      }

      // Encía
      const enciaMap = data?.datos?.estado_encia || {};
      document.querySelectorAll('.encia-table tbody tr').forEach(fila => {
        const condicion = fila.querySelector('td')?.textContent.trim();
        const input     = fila.querySelector('input');
        if (condicion && input) input.value = enciaMap[condicion] ?? '';
      });

      // Tratamientos por diente
      const tpd = data?.datos?.tratamientos_por_diente || {};
      document.querySelectorAll('.tratamientos-tabla input[type="checkbox"]').forEach(chk => chk.checked = false);
      document.querySelectorAll('.diente').forEach(d => d.classList.remove('tratamiento-asignado'));

      for (const dienteId of Object.keys(tpd)) {
        const tratamientos = tpd[dienteId] || [];
        if (tratamientos.length) {
          const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
          if (dienteElement) dienteElement.classList.add('tratamiento-asignado');
        }
        tratamientos.forEach(trat => {
          document.querySelectorAll('.tratamientos-tabla tbody tr').forEach(fila => {
            const nombreTrat = fila.querySelector('td')?.textContent.trim();
            if (nombreTrat === trat) {
              const chk = fila.querySelector(`input[type="checkbox"][data-diente="${dienteId}"]`);
              if (chk) chk.checked = true;
            }
          });
        });
      }

      // VISUALIZAR: deshabilitar campos, ocultar Guardar, mantener Enviar visible y FUNCIONAL
      form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);

      if (btnGuardar) btnGuardar.style.display = 'none';

      const btnSubmit = form.querySelector('button[type="submit"]');
      if (btnSubmit) {
        btnSubmit.style.display = 'inline-block';   // visible
        btnSubmit.disabled = false;                 // funcional
      }

      if (btnPdf) {
        btnPdf.disabled = false;
        btnPdf.style.display = 'inline-block';
      }

      activarInteraccionDientes(false);
    } catch (err) {
      console.error('cargarFormularioSiAplica error:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el odontograma para visualizar.' });
    }
  }

  /*************** Eventos ***************/
  if (btnGuardar) {
    btnGuardar.addEventListener('click', async () => {
      if (!ES_MODO_CREAR) return;
      await guardarOdontogramaEnBD();
    });
  }

  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      if (!formularioId && ES_MODO_CREAR) {
        const folio = await guardarOdontogramaEnBD();
        if (!folio) return;
      }
      await generarPDF();
    });
  }

  // Enviar: ahora funciona en ambos modos
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (ES_MODO_VISUALIZAR) {
      // En visualización NO guarda ni modifica, solo "envía" (simulado)
      await Swal.fire({
        icon:'success',
        title:'📤 Enviado',
        text:'El odontograma ha sido enviado al paciente (simulado).'
      });
      return;
    }

    // Crear: si no hay folio, guarda y luego “envía”
    if (!formularioId) {
      const folio = await guardarOdontogramaEnBD();
      if (!folio) return;
    }
    await Swal.fire({ icon:'success', title:'📤 Enviado', text:'(Simulado) Formulario enviado.' });
  });

  /*************** Arranque ***************/
  if (ES_MODO_VISUALIZAR) {
    activarInteraccionDientes(false);
    cargarFormularioSiAplica();
  } else if (ES_MODO_CREAR) {
    activarInteraccionDientes(true);
    cargarPaciente();
  } else {
    Swal.fire({ icon:'warning', title:'Parámetros faltantes', text:'Usa ?formulario_id= para visualizar o ?paciente_id= para crear.' });
    activarInteraccionDientes(false);
  }
});
