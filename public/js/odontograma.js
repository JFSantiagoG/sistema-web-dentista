/***************** ========= HELPERS ========= *****************/
function yyyymmdd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}
// "ana maría lópez pérez" -> "Ana_Maria_Lopez_Perez"
function nombreTitulo(str = '') {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
}
// Nombre final para el archivo PDF
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

  // 👉 En tu HTML los inputs vienen con "name", no con "id"
  const nombreEl = form.querySelector('[name="nombrePaciente"]');
  const fechaEl  = form.querySelector('[name="fechaTermino"]');

  // 👉 Botones: usa clases, porque no hay IDs
  const btnGuardar = document.querySelector('.step-form .btn.btn-outline-secondary.btn-lg'); // "Guardar Borrador"
  const btnPdf     = document.querySelector('.step-form .btn.btn-info.btn-lg');             // "Descargar PDF"

  // paciente_id de la URL + auth
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Estado (folio) y canal de notificación
  const SS_KEY   = (pid) => `odonto:formId:${pid}`;
  const SAVE_KEY = (pid) => `odonto:saved:${pid}`;
  let formularioId = pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null;

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('odontograma') : null;
  function notificarGuardado(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      if (bc) bc.postMessage({ type: 'odontograma-final-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  /*************** Interacción visual con los dientes ***************/
  document.querySelectorAll('.diente').forEach(diente => {
    diente.addEventListener('click', () => {
      diente.classList.toggle('tratamiento-asignado');
      diente.classList.remove('pendiente');
    });
  });

  // Sincronizar tabla con dientes
  document.querySelectorAll('.tratamientos-tabla input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const dienteId = this.getAttribute('data-diente');
      const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
      if (dienteElement) {
        dienteElement.classList.toggle('tratamiento-asignado', this.checked);
      }
    });
  });

  /*************** Cargar nombre del paciente (solo nombre completo) ***************/
  async function cargarPaciente() {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID faltante', text:'Incluye ?paciente_id=<id> en la URL.' });
      return;
    }
    try {
      const res = await fetch(`/api/patients/${pacienteId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();

      const nombreCompleto = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno]
        .filter(Boolean).join(' ').trim();

      if (nombreEl) {
        nombreEl.value = nombreCompleto || '';
        nombreEl.readOnly = true; // ⛔ la fecha la pone el doctor, el nombre viene auto
      }
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el paciente.' });
    }
  }

  /*************** Recolectar datos del formulario ***************/
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
    const fechaTermino   = fechaEl?.value.trim(); // la pone el doctor/admin

    return {
      paciente: { nombre: nombrePaciente, fechaTermino },
      tratamientosPorDiente: recolectarTratamientosPorDiente(),
      estadoEncia: recolectarEstadoEncia()
      // odontogramaVisual se agrega solo al generar PDF
    };
  }

  /*************** Guardar en BD (genera folio) ***************/
  async function guardarOdontogramaEnBD() {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID faltante', text:'Incluye ?paciente_id=<id> en la URL.' });
      return null;
    }
    const nombrePaciente = nombreEl?.value.trim();
    const fechaTermino   = fechaEl?.value.trim();

    if (!nombrePaciente || !fechaTermino) {
      await Swal.fire({ icon:'warning', title:'Campos faltantes', text:'Completa el nombre y la fecha de término.' });
      return null;
    }

    // si ya había un folio, preguntar si crear otro
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

    // armamos payload de guardado (sin imagen)
    const base = payloadComun();
    const body = {
      nombre_paciente: base.paciente.nombre,
      fecha_termino: base.paciente.fechaTermino,
      tratamientos_por_diente: base.tratamientosPorDiente,
      estado_encia: base.estadoEncia
    };

    try {
      // ✅ Ruta corregida para coincidir con tu router:
      // router.post('/:id/odontograma', verificarToken, crearOdontogramaFinal);
      const res = await fetch(`/api/patients/${pacienteId}/odontograma`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      formularioId = Number(json.formulario_id) || null;
      if (formularioId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarGuardado(pacienteId, formularioId);
      }

      await Swal.fire({ icon:'success', title:'Guardado', text:`Folio: ${formularioId ?? '—'}` });
      return formularioId;
    } catch (e) {
      console.error('Error al guardar odontograma:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar el odontograma final.' });
      return null;
    }
  }

  /*************** PDF: abre en nueva pestaña y luego sugiere descarga ***************/
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
      formularioId // por si lo usas en el encabezado del PDF
    };

    try {
      const res = await fetch('/api/pdf/odontograma/generate', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(dataPdf)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      // abrir vista en nueva pestaña
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      // sugerir descarga
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

  /*************** Eventos ***************/
  if (btnGuardar) {
    btnGuardar.addEventListener('click', guardarOdontogramaEnBD);
  }

  // Botón azul: primero guarda (si no hay folio) y luego genera/abre PDF
  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      if (!formularioId) {
        const folio = await guardarOdontogramaEnBD();
        if (!folio) return;
      }
      await generarPDF();
    });
  }

  // Submit verde: “enviar formulario” (opcional)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Guardar si hace falta
    if (!formularioId) {
      const folio = await guardarOdontogramaEnBD();
      if (!folio) return;
    }
    await Swal.fire({ icon:'success', title:'📤 Enviado', text:'(Simulado) Formulario enviado.' });
  });

  // Arranque
  cargarPaciente();
});
