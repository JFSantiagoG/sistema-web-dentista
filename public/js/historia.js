/***************** ========= HELPERS GLOBALES (para HTML inline) ========= *****************/
window.toggleConditional = function (checkboxId, targetId) {
  const checkbox = document.getElementById(checkboxId);
  const target = document.getElementById(targetId);
  if (checkbox && target) target.style.display = checkbox.checked ? 'block' : 'none';
};
window.toggleFecha = function (radio, fechaId) {
  const fechaInput = document.getElementById(fechaId);
  if (fechaInput) {
    fechaInput.disabled = radio.value !== 'si';
    if (fechaInput.disabled) fechaInput.value = '';
  }
};
window.toggleCantidad = function (radio, cantId) {
  const cantInput = document.getElementById(cantId);
  if (cantInput) {
    cantInput.disabled = radio.value !== 'si';
    if (cantInput.disabled) cantInput.value = '';
  }
};

/***************** ========= GENERADORES DE TABLAS ========= *****************/
function generarFilasPatologicos() {
  const patologias = [
    "Enf. Infancia","Alergias","Asma","Cáncer","Hepatitis","Artritis",
    "Amigdalitis","Enf. de Transmisión Sexual","SIDA","Enf. Renales",
    "Enf. Cardíacas","Hipertensión","Diabetes","Epilepsia","Gastritis",
    "Tx. Quirúrgicos","Transfusiones","Traumatismos","Disfunciones Endocrinas","Otros"
  ];
  const tbody = document.getElementById('tablaPatologicos');
  if (!tbody) return;
  patologias.forEach(p => {
    const esOtro = p === "Otros";
    const idBase = p.replace(/[^a-zA-Z0-9]/g,'_');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p}${esOtro ? ' <input type="text" class="form-control form-control-sm mt-1" placeholder="Especificar">' : ''}</td>
      <td><input type="radio" name="pat_${idBase}" value="si" onchange="toggleFecha(this, 'fecha_${idBase}')"></td>
      <td><input type="radio" name="pat_${idBase}" value="no" onchange="toggleFecha(this, 'fecha_${idBase}')"></td>
      <td><input type="date" id="fecha_${idBase}" class="form-control form-control-sm" disabled></td>`;
    tbody.appendChild(tr);
  });
}
function generarFilasMujeres() {
  const condiciones = [
    "Fum (Fumar)","Menopausia","Embarazos","Hijos","Partos",
    "Cesáreas","Abortos","¿Está embarazada?","¿Usa anticonceptivos orales?"
  ];
  const tbody = document.getElementById('tablaMujeres');
  if (!tbody) return;
  condiciones.forEach(cond => {
    const idBase = cond.replace(/[^a-zA-Z0-9]/g,'_');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cond}</td>
      <td><input type="radio" name="muj_${idBase}" value="si" onchange="toggleFecha(this, 'muj_fecha_${idBase}')"></td>
      <td><input type="radio" name="muj_${idBase}" value="no" onchange="toggleFecha(this, 'muj_fecha_${idBase}')"></td>
      <td><input type="date" id="muj_fecha_${idBase}" class="form-control form-control-sm" disabled></td>`;
    tbody.appendChild(tr);
  });
}
function generarFilasNoPatologicos() {
  const habitos = ["Higiene Bucal","Alcoholismo","Tabaquismo","Toxicomanías","Inmunizaciones"];
  const tbody = document.getElementById('tablaNoPatologicos');
  if (!tbody) return;
  habitos.forEach(h => {
    const idBase = h.replace(/[^a-zA-Z0-9]/g,'_');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${h}</td>
      <td><input type="radio" name="hab_${idBase}" value="si" onchange="toggleCantidad(this, 'hab_cant_${idBase}')"></td>
      <td><input type="radio" name="hab_${idBase}" value="no" onchange="toggleCantidad(this, 'hab_cant_${idBase}')"></td>
      <td><input type="text" id="hab_cant_${idBase}" class="form-control form-control-sm" disabled placeholder="Ej: 2 veces/día"></td>`;
    tbody.appendChild(tr);
  });
}
function generarFilasFamiliares() {
  const patologias = [
    "Cardiopatías","Hipertensión Arterial","Diabetes","Alergias","Asma",
    "Artritis","Neoplasias","Epilepsia","Malformación","Fiebre Reumática",
    "Hepatitis","Enf. de la Tiroides","SIDA","Otras","Aparentemente Sano"
  ];
  const miembros = ["Madre","Abuela Materna","Abuelo Materno","Padre","Abuela Paterna","Abuelo Paterna","Hermano","Otros"];
  const tbody = document.getElementById('tablaFamiliares');
  if (!tbody) return;
  patologias.forEach(p => {
    const tr = document.createElement('tr');
    let html = `<td>${p}${p==="Otras" ? ' <input type="text" class="form-control form-control-sm" placeholder="Especificar">' : ''}</td>`;
    miembros.forEach(m => {
      const id = `${p.replace(/[^a-zA-Z0-9]/g,'_')}_${m.replace(/[^a-zA-Z0-9]/g,'_')}`;
      html += `<td><input type="checkbox" id="${id}"></td>`;
    });
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });
}

/***************** ========= RECOLECTORES ========= *****************/
function recolectarTablaPatologicos() {
  const filas = document.querySelectorAll('#tablaPatologicos tr');
  return Array.from(filas).map(tr => {
    const patologia = tr.cells[0].innerText.trim();
    const si = tr.cells[1].querySelector('input')?.checked || false;
    const no = tr.cells[2].querySelector('input')?.checked || false;
    const fecha = tr.cells[3].querySelector('input')?.value || '';
    return { patologia, si, no, fecha };
  });
}
function recolectarTablaMujeres() {
  const filas = document.querySelectorAll('#tablaMujeres tr');
  return Array.from(filas).map(tr => {
    const condicion = tr.cells[0].innerText.trim();
    const si = tr.cells[1].querySelector('input')?.checked || false;
    const no = tr.cells[2].querySelector('input')?.checked || false;
    const fecha = tr.cells[3].querySelector('input')?.value || '';
    return { condicion, si, no, fecha };
  });
}
function recolectarTablaNoPatologicos() {
  const filas = document.querySelectorAll('#tablaNoPatologicos tr');
  return Array.from(filas).map(tr => {
    const habito = tr.cells[0].innerText.trim();
    const si = tr.cells[1].querySelector('input')?.checked || false;
    const no = tr.cells[2].querySelector('input')?.checked || false;
    const cantidad = tr.cells[3].querySelector('input')?.value || '';
    return { habito, si, no, cantidad };
  });
}
function recolectarTablaFamiliares() {
  const filas = document.querySelectorAll('#tablaFamiliares tr');
  return Array.from(filas).map(tr => {
    const patologia = tr.cells[0].innerText.trim();
    const miembros = Array.from(tr.cells).slice(1).map(td => td.querySelector('input')?.checked || false);
    return { patologia, miembros };
  });
}
function recolectarInterrogatorio() {
  const labels = ['Cardiovascular','Circulatorio','Respiratorio','Digestivo','Urinario','Genital','Musculoesquelético','SNC'];
  const out = {};
  labels.forEach(label => {
    const el = Array.from(document.querySelectorAll('label')).find(l => l.textContent.includes(label));
    if (el) out[label] = el.parentElement.querySelector('textarea')?.value || '';
  });
  return out;
}
function recolectarExploracion() {
  const campos = [
    'Cabeza, Cuello, Cara, Perfil',
    'ATM (Articulación Temporomandibular)',
    'Labios, Frenillos, Lengua, Paladar Duro, Blando, Orofaringe, Región Yugal',
    'Piso de Boca, Glándulas Salivales, Carrillos',
    'Encías, Procesos Alveolares'
  ];
  const out = {};
  campos.forEach(label => {
    const el = Array.from(document.querySelectorAll('label')).find(l => l.textContent.includes(label));
    if (el) out[label] = el.parentElement.querySelector('textarea')?.value || '';
  });
  return out;
}
function obtenerObservacionesGenerales() {
  const h = Array.from(document.querySelectorAll('h5')).find(h5 => h5.textContent.includes('Observaciones Generales'));
  return h?.parentElement?.nextElementSibling?.querySelector('textarea')?.value || '';
}
function obtenerHallazgosRadiograficos() {
  const h = Array.from(document.querySelectorAll('h5')).find(h5 => h5.textContent.includes('Hallazgos Radiográficos'));
  return h?.parentElement?.nextElementSibling?.querySelector('textarea')?.value || '';
}

/***************** ========= NOMBRE DE PDF ========= *****************/
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
function buildHistoriaPdfName({ paciente }) {
  const fecha = yyyymmdd(new Date());
  const nombre = nombreTitulo(paciente || 'Paciente');
  return `${fecha}_historia_${nombre}.pdf`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/***************** ========= APLICACIÓN ========= *****************/
document.addEventListener('DOMContentLoaded', async () => {
  // 1) Generar tablas
  generarFilasPatologicos();
  generarFilasMujeres();
  generarFilasNoPatologicos();
  generarFilasFamiliares();

  // 2) Refs
  const form = document.getElementById('historiaClinicaForm');
  const btnGuardar = document.getElementById('btnGuardarHistoria');
  const btnPdf = document.getElementById('descargarPDF');

  const nombreEl     = document.getElementById('nombrePaciente');
  const domicilioEl  = document.getElementById('domicilioPaciente');
  const telEl        = document.getElementById('telefonoPaciente');
  const sexoEl       = document.getElementById('sexoPaciente');
  const fechaNacEl   = document.getElementById('fechaNacimiento');
  const edadEl       = document.getElementById('edadPaciente');
  const edoCivilEl   = document.getElementById('estadoCivil');
  const ocupacionEl  = document.getElementById('ocupacionPaciente');
  const motivoEl     = document.getElementById('motivoConsulta');

  // 3) paciente_id y auth
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // 4) Estado: folio + canal de notificación
  const SS_KEY  = (pid) => `historia:formId:${pid}`;
  const SAVE_KEY = (pid) => `historia:saved:${pid}`;
  let formularioId = pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null;

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('historia') : null;
  function notificarHistoriaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      if (bc) bc.postMessage({ type: 'historia-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // 5) Helpers de autollenado
  const buildNombre = (p) => [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ').trim();
  const setValue = (el, val) => { if (el) el.value = (val ?? '') === null ? '' : String(val ?? ''); };
  const calcEdad = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return '';
    const d = new Date(yyyy_mm_dd); if (Number.isNaN(d.getTime())) return '';
    const h = new Date();
    let e = h.getFullYear() - d.getFullYear();
    const m = h.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < d.getDate())) e--;
    return e >= 0 ? String(e) : '';
  };

  // 6) Cargar paciente (formatea fecha MySQL → yyyy-MM-dd)
  async function cargarPaciente() {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID faltante', text:'Incluye ?paciente_id=<id> en la URL.' });
      return;
    }
    try {
      const res = await fetch(`/api/patients/${pacienteId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();

      setValue(nombreEl, buildNombre(p));
      setValue(domicilioEl, p?.domicilio);
      setValue(telEl, p?.telefono_principal ?? p?.telefono);

      // sexo: tu BD usa enum('M','F','Otro'); mapeamos a select
      if (sexoEl) {
        sexoEl.value = (p?.sexo === 'M') ? 'Masculino' : (p?.sexo === 'F') ? 'Femenino' : (p?.sexo || 'Otro');
      }

      // fecha_nacimiento: si por alguna razón viniera con "T", cortamos a yyyy-MM-dd
      if (fechaNacEl) {
        let fn = p?.fecha_nacimiento || '';
        if (fn.includes('T')) fn = fn.split('T')[0];
        fechaNacEl.value = fn || '';
      }

      // edad: si no viene, la calculamos por fecha
      setValue(edadEl, (p?.edad != null) ? p.edad : calcEdad(fechaNacEl.value));

      if (edoCivilEl) edoCivilEl.value = p?.estado_civil || '';
      setValue(ocupacionEl, p?.ocupacion);

      // bloquear edición
      [nombreEl, domicilioEl, telEl, edadEl, ocupacionEl].forEach(el => el && (el.readOnly = true));
      if (sexoEl) sexoEl.disabled = true;
      if (fechaNacEl) fechaNacEl.disabled = true;
      if (edoCivilEl) edoCivilEl.disabled = true;

      // mostrar/ocultar sección mujeres
      const seccionMujeres = document.getElementById('seccionMujeres');
      if (seccionMujeres && sexoEl) {
        seccionMujeres.style.display = (sexoEl.value === 'Femenino') ? 'block' : 'none';
      }
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar la información del paciente.' });
    }
  }

  // 7) Construir payload común
  function payloadComun() {
    return {
      nombrePaciente: nombreEl?.value || '',
      domicilioPaciente: domicilioEl?.value || '',
      telefonoPaciente: telEl?.value || '',
      sexoPaciente: sexoEl?.value || '',
      fechaNacimiento: fechaNacEl?.value || '',
      edadPaciente: edadEl?.value || '',
      estadoCivil: edoCivilEl?.value || '',
      ocupacionPaciente: ocupacionEl?.value || '',
      motivoConsulta: motivoEl?.value || '',
      tratamientoMedico: document.getElementById('tratamientoMedicoSi')?.checked || false,
      tratamientoMedicoCual: document.querySelector('#tratamientoMedicoCual input')?.value || '',
      medicamento: document.getElementById('medicamentoSi')?.checked || false,
      medicamentoCual: document.querySelector('#medicamentoCual input')?.value || '',
      problemaDental: document.getElementById('problemaDentalSi')?.checked || false,
      problemaDentalCual: document.querySelector('#problemaDentalCual input')?.value || '',
      antecedentesPatologicos: recolectarTablaPatologicos(),
      antecedentesMujeres: recolectarTablaMujeres(),
      antecedentesNoPatologicos: recolectarTablaNoPatologicos(),
      antecedentesFamiliares: recolectarTablaFamiliares(),
      interrogatorioSistemas: recolectarInterrogatorio(),
      exploracionClinica: recolectarExploracion(),
      observacionesGenerales: obtenerObservacionesGenerales(),
      hallazgosRadiograficos: obtenerHallazgosRadiograficos()
    };
  }

  // 8) Guardar en BD (sin firma)
  async function guardarHistoriaEnBD() {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID faltante', text:'Incluye ?paciente_id=<id> en la URL.' });
      return null;
    }
    // Si ya hay folio, preguntar si crear otra
    if (formularioId) {
      const r = await Swal.fire({
        icon: 'question',
        title: `Esta historia ya fue guardada (folio ${formularioId}).`,
        text: '¿Deseas guardar otra nueva con estos datos?',
        showCancelButton: true,
        confirmButtonText: 'Sí, crear otra',
        cancelButtonText: 'Cancelar'
      });
      if (!r.isConfirmed) return null;
    }

    try {
      const res = await fetch(`/api/patients/${pacienteId}/historia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payloadComun())
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      formularioId = Number(json.formulario_id) || null;
      if (formularioId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarHistoriaGuardada(pacienteId, formularioId);
      }

      await Swal.fire({ icon:'success', title:'Guardado', text:`Folio: ${formularioId ?? '—'}` });
      return formularioId;
    } catch (e) {
      console.error('Error al guardar historia:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar la historia clínica.' });
      return null;
    }
  }

  // 9) PDF: abrir en otra pestaña y luego sugerir descarga
  async function generarPDF() {
    if (!formularioId) {
      await Swal.fire({ icon:'info', title:'Primero guarda la historia', text:'Necesitas un folio para el PDF.' });
      return;
    }

    // Aviso previo, igual que en Receta
    const pre = await Swal.fire({
      icon: 'info',
      title: 'Se abrirá el PDF en otra pestaña',
      text: 'Al regresar, podrás descargarlo desde aquí con un nombre sugerido.',
      confirmButtonText: 'Entendido'
    });
    if (!pre.isConfirmed) return;

    const dataPdf = payloadComun();

    // Firma del paciente SOLO para PDF
    const canvas = document.getElementById('signature-pad-paciente');
    if (canvas) {
      const blank = document.createElement('canvas');
      blank.width = canvas.width; blank.height = canvas.height;
      if (canvas.toDataURL() !== blank.toDataURL()) {
        dataPdf.firmaPaciente = canvas.toDataURL('image/png');
      }
    }

    dataPdf.formularioId = formularioId;

    try {
      const res = await fetch('/api/pdf/historia/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataPdf)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      // Abrir en NUEVA PESTAÑA
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      // Sugerir descarga con nombre propuesto
      const paciente = nombreEl?.value || 'paciente';
      const filename = buildHistoriaPdfName({ paciente, formularioId });

      const post = await Swal.fire({
        icon: 'success',
        title: 'PDF listo',
        html: `
          <p>El PDF se abrió en otra pestaña.</p>
          <p class="mb-1"><small>Nombre sugerido:</small></p>
          <code style="user-select:all">${filename}</code>
        `,
        showCancelButton: true,
        confirmButtonText: '⬇️ Descargar PDF',
        cancelButtonText: 'Cerrar'
      });

      if (post.isConfirmed) downloadBlob(blob, filename);

      URL.revokeObjectURL(viewUrl);
    } catch (e) {
      console.error('Error al generar PDF:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  }

  // 10) Eventos
  if (btnGuardar) btnGuardar.addEventListener('click', guardarHistoriaEnBD);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!formularioId) {
        const folio = await guardarHistoriaEnBD();
        if (!folio) return;
      }
      await Swal.fire({ icon:'success', title:'📤 Enviado', text:'(Simulado) Formulario enviado al paciente.' });
    });
  }

  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      if (!formularioId) {
        const folio = await guardarHistoriaEnBD();
        if (!folio) return;
      }
      await generarPDF();
    });
  }

  // 11) Arranque
  await cargarPaciente();

  // 12) Botón limpiar firma (si existe)
  const clearBtn = document.getElementById('clearSignature-pad-paciente');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const c = document.getElementById('signature-pad-paciente');
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
    });
  }
});
