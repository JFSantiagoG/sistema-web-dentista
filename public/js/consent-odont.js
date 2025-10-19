// public/js/consent-odont.js
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token') || '';
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // --- refs
  const form = document.getElementById('consentForm');
  const pacienteSelect = document.getElementById('pacienteSelect'); // oculto, para compatibilidad
  const nombreVis = document.getElementById('nombrePacienteVisible'); // visible, readonly
  const fechaInput = document.getElementById('fechaRegistroInput');
  const numeroPacienteInput = document.getElementById('numeroPacienteInput');

  const confirmNombre = document.getElementById('confirmNombrePaciente');
  const confirmFecha  = document.getElementById('confirmFecha');
  const confirmNum    = document.getElementById('confirmNumeroPaciente');

  const tratInput   = document.getElementById('tratamientoInput');
  const montoInput  = document.getElementById('montoInput');
  const ausenInput  = document.getElementById('ausenciaInput');

  const confirmTrat = document.getElementById('confirmTratamiento');
  const confirmMonto= document.getElementById('confirmMonto');
  const confirmAus  = document.getElementById('confirmAusencia');

  const step1 = document.getElementById('doctor-step');
  const step2 = document.getElementById('patient-step');
  const ind1  = document.getElementById('step1-indicator');
  const ind2  = document.getElementById('step2-indicator');

  // --- paciente_id desde URL
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');

  // --- util
  const todayISO = () => {
    const now = new Date();
    const z = new Date(now.getTime() - now.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  };
  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ').trim();

  async function cargarPacienteYPrefill() {
    if (!pacienteId) {
      await Swal.fire({
        icon: 'warning',
        title: 'Falta el ID del paciente',
        text: 'Agrega ?paciente_id=<id> en la URL.',
      });
      return;
    }
    // Fecha = HOY (readonly)
    if (fechaInput) {
      const iso = todayISO();
      fechaInput.value = iso;
      fechaInput.readOnly = true;
      fechaInput.min = iso;
      fechaInput.max = iso;
    }
    // Número de paciente = id
    if (numeroPacienteInput) {
      numeroPacienteInput.value = String(pacienteId);
      numeroPacienteInput.readOnly = true;
    }

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, {
        headers: { Accept: 'application/json', ...authHeaders }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      const nombre = buildNombre(p) || '(Sin nombre)';

      // Visible
      if (nombreVis) nombreVis.value = nombre;

      // Select oculto (para compatibilidad con tu showPatientStep)
      if (pacienteSelect) {
        pacienteSelect.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = String(pacienteId);
        opt.textContent = nombre;
        opt.selected = true;
        pacienteSelect.appendChild(opt);
      }
    } catch (e) {
      console.error('Error cargando paciente:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el paciente.' });
    }
  }

  // --- navegación pasos
  window.showPatientStep = function showPatientStep() {
    // Lee del select (compat) y del visible
    const nombrePaciente = (function() {
      if (pacienteSelect && pacienteSelect.selectedIndex >= 0) {
        return pacienteSelect.options[pacienteSelect.selectedIndex].text;
      }
      return nombreVis?.value || '';
    })();

    const fecha = fechaInput?.value || todayISO();
    const numero = numeroPacienteInput?.value || String(pacienteId);
    const tratamiento = tratInput?.value || '';
    const monto = montoInput?.value || '';
    const ausenciaDias = ausenInput?.value || '';

    // Validación mínima antes de pasar
    if (!nombrePaciente || !fecha || !tratamiento || monto === '' || ausenciaDias === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completa nombre, fecha, tratamiento, monto y ausencia.',
      });
      return;
    }

    // Pasar valores a paso 2
    if (confirmNombre) confirmNombre.value = nombrePaciente;
    if (confirmFecha)  confirmFecha.value  = fecha;
    if (confirmNum)    confirmNum.value    = numero;
    if (confirmTrat)   confirmTrat.value   = tratamiento;
    if (confirmMonto)  confirmMonto.textContent = monto || '0.00';
    if (confirmAus)    confirmAus.textContent   = ausenciaDias || '0';

    // Mostrar paso 2
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';
    ind1?.classList.remove('active');
    ind2?.classList.add('active');
  };

  window.showDoctorStep = function showDoctorStep() {
    if (step2) step2.style.display = 'none';
    if (step1) step1.style.display = 'block';
    ind2?.classList.remove('active');
    ind1?.classList.add('active');
  };

  // --- submit: guardar en BD (SIN firma)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombrePaciente = confirmNombre?.value || nombreVis?.value || '';
    const fecha = confirmFecha?.value || fechaInput?.value || todayISO();
    const numero = confirmNum?.value || numeroPacienteInput?.value || String(pacienteId);
    const tratamiento = confirmTrat?.value || tratInput?.value || '';
    const monto = (confirmMonto?.textContent ?? montoInput?.value ?? '').trim();
    const ausenciaDias = (confirmAus?.textContent ?? ausenInput?.value ?? '').trim();

    const autorizacion = document.getElementById('autorizacionCheck')?.checked || false;
    const economico    = document.getElementById('economicoCheck')?.checked || false;
    const ausencia     = document.getElementById('ausenciaCheck')?.checked || false;

    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID inválido', text:'Falta ?paciente_id en la URL.' });
      return;
    }
    if (!nombrePaciente || !fecha || !tratamiento || monto === '' || ausenciaDias === '') {
      await Swal.fire({ icon:'warning', title:'Faltan datos', text:'Completa la información requerida.' });
      return;
    }

    const confirm = await Swal.fire({
      title: '¿Guardar consentimiento?',
      text: 'Se almacenará en la base de datos.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirm.isConfirmed) return;

    const body = {
      fecha,
      numero_paciente: numero,
      tratamiento,
      monto,
      ausencia_dias: ausenciaDias,
      autorizacion,
      economico,
      ausencia
      // sin firma en BD por ahora
    };

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/consent-odont`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      await Swal.fire({
        icon:'success',
        title:'Guardado',
        text:`Folio ${json.formulario_id ?? '—'} creado correctamente`
      });

      // Opcional: redirigir al perfil para ver la tabla actualizada
      // location.href = `/paciente.html?id=${encodeURIComponent(pacienteId)}`;
    } catch (err) {
      console.error('Error al guardar consentimiento:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar el consentimiento.' });
    }
  });

  // --- Descargar PDF (con firma SOLO para el PDF)
  document.querySelector('.btn-info')?.addEventListener('click', async () => {
    const nombre = confirmNombre?.value || nombreVis?.value || '';
    const fecha  = confirmFecha?.value  || fechaInput?.value || todayISO();
    const numero = confirmNum?.value    || numeroPacienteInput?.value || String(pacienteId);
    const tratamiento = confirmTrat?.value || tratInput?.value || '';
    const monto = (confirmMonto?.textContent ?? montoInput?.value ?? '').trim();
    const ausencia = (confirmAus?.textContent ?? ausenInput?.value ?? '').trim();

    // Firma del paciente (solo PDF)
    const canvas = document.getElementById('signature-pad');
    const firmaPaciente = canvas ? canvas.toDataURL('image/png') : null;

    if (!nombre || !fecha || !tratamiento || monto === '' || ausencia === '') {
      await Swal.fire({ icon:'warning', title:'Faltan datos', text:'Completa la información para el PDF.' });
      return;
    }

    try {
      const res = await fetch('/api/pdf/consentimiento/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: { nombre, fecha, numeroPaciente: numero },
          tratamiento,
          monto,
          ausencia,
          firmaPaciente
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      await Swal.fire({ icon:'success', title:'PDF generado' });
    } catch (err) {
      console.error('Error generando PDF:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  });

  // --- botón limpiar firma (lo maneja firma.js si lo tienes; por si acaso)
  document.getElementById('clearSignature-pad')?.addEventListener('click', () => {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
  });

  // GO
  cargarPacienteYPrefill();
});
