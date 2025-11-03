/***************** ========= HELPERS UI ========= *****************/
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

/***************** ========= TOGGLES (checkbox → campo “¿Cuál?”) ========= *****************/
function setConditionalVisibility(checkboxId, containerId) {
  const cb = document.getElementById(checkboxId);
  const cont = document.getElementById(containerId);
  if (!cb || !cont) return;
  const visible = !!cb.checked;
  cont.style.display = visible ? 'block' : 'none';
  if (!visible) {
    const inp = cont.querySelector('input,textarea');
    if (inp) inp.value = '';
  }
}
function wireConditional(checkboxId, containerId) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  cb.addEventListener('change', () => setConditionalVisibility(checkboxId, containerId));
}

/***************** ========= TABLAS (GENERAR) ========= *****************/
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
      <td><input type="radio" name="pat_${idBase}" value="si"></td>
      <td><input type="radio" name="pat_${idBase}" value="no"></td>
      <td><input type="date" id="fecha_${idBase}" class="form-control form-control-sm"></td>`;
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
      <td><input type="radio" name="muj_${idBase}" value="si"></td>
      <td><input type="radio" name="muj_${idBase}" value="no"></td>
      <td><input type="date" id="muj_fecha_${idBase}" class="form-control form-control-sm"></td>`;
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
      <td><input type="radio" name="hab_${idBase}" value="si"></td>
      <td><input type="radio" name="hab_${idBase}" value="no"></td>
      <td><input type="text" id="hab_cant_${idBase}" class="form-control form-control-sm" placeholder="Ej: 2 veces/día"></td>`;
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

/***************** ========= RECOLECTAR ========= *****************/
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
  const miembros = ["Madre","Abuela Materna","Abuelo Materno","Padre","Abuela Paterna","Abuelo Paterna","Hermano","Otros"];
  return Array.from(filas).map(tr => {
    const patologia = tr.cells[0].innerText.trim();
    const valores = {};
    miembros.forEach((m, idx) => {
      valores[m] = tr.cells[idx+1].querySelector('input')?.checked || false;
    });
    return { patologia, ...valores };
  });
}

/***************** ========= CAMPOS LIBRES (SIS / EXPLORACIÓN / FALLBACKS) ========= *****************/
function recolectarInterrogatorio() {
  const out = {};
  document.querySelectorAll('textarea.sis').forEach(t => {
    const key = t.dataset.key;
    out[key] = t.value || '';
  });
  return out;
}
function recolectarExploracion() {
  const out = {};
  document.querySelectorAll('textarea.expl').forEach(t => {
    const key = t.dataset.key;
    out[key] = t.value || '';
  });
  return out;
}

function fallbackFindTextareaByHeader(headerText) {
  const h = Array.from(document.querySelectorAll('h5')).find(h5 => h5.textContent.includes(headerText));
  return h?.parentElement?.nextElementSibling?.querySelector('textarea') || null;
}

/***************** ========= CARGA PACIENTE ========= *****************/
function calcEdad(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return '';
  const d = new Date(yyyy_mm_dd); if (Number.isNaN(d.getTime())) return '';
  const h = new Date();
  let e = h.getFullYear() - d.getFullYear();
  const m = h.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) e--;
  return e >= 0 ? String(e) : '';
}
function setValue(el, val) { if (el) el.value = (val ?? '') === null ? '' : String(val ?? ''); }

/***************** ========= APP ========= *****************/
document.addEventListener('DOMContentLoaded', async () => {
  // Generar tablas
  generarFilasPatologicos();
  generarFilasMujeres();
  generarFilasNoPatologicos();
  generarFilasFamiliares();

  // Refs
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

  // Observaciones/Hallazgos: intenta por ID; si no, fallback por encabezado
  let obsEl  = document.getElementById('observacionesGenerales');
  if (!obsEl) obsEl = fallbackFindTextareaByHeader('Observaciones Generales');
  let hallEl = document.getElementById('hallazgos');
  if (!hallEl) hallEl = fallbackFindTextareaByHeader('Hallazgos Radiográficos');

  // QS / auth
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');
  const formularioIdQS = qs.get('formulario_id'); // si viene, es modo visualizar
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Ocultar botón Guardar si estamos visualizando
  if (formularioIdQS) {
    const btn = document.getElementById('btnGuardarHistoria');
    if (btn) btn.style.display = 'none';
  }

  // Estado sesión (solo se usa en modo creación)
  const SS_KEY  = (pid) => `historia:formId:${pid}`;
  const SAVE_KEY = (pid) => `historia:saved:${pid}`;
  let formularioId = formularioIdQS
    ? Number(formularioIdQS)
    : pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null;

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('historia') : null;
  function notificarHistoriaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      if (bc) bc.postMessage({ type: 'historia-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // Condicionales “¿Cuál?”
  wireConditional('tratamientoMedicoSi', 'tratamientoMedicoCual');
  wireConditional('medicamentoSi', 'medicamentoCual');
  wireConditional('problemaDentalSi', 'problemaDentalCual');

  // Cargar paciente (solo en modo creación)
  async function cargarPaciente() {
    if (!pacienteId) return; // no mostrar alerta en visualizar
    try {
      const res = await fetch(`/api/patients/${pacienteId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();

      setValue(nombreEl, [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ').trim());
      setValue(domicilioEl, p?.domicilio);
      setValue(telEl, p?.telefono_principal ?? p?.telefono);

      if (sexoEl) {
        sexoEl.value = (p?.sexo === 'M') ? 'Masculino' : (p?.sexo === 'F') ? 'Femenino' : (p?.sexo || 'Otro');
      }
      if (fechaNacEl) {
        let fn = p?.fecha_nacimiento || '';
        if (fn.includes('T')) fn = fn.split('T')[0];
        fechaNacEl.value = fn || '';
      }
      setValue(edadEl, (p?.edad != null) ? p.edad : calcEdad(fechaNacEl.value));
      if (edoCivilEl) edoCivilEl.value = p?.estado_civil || '';
      setValue(ocupacionEl, p?.ocupacion);

      // bloquear edición datos de paciente
      [nombreEl, domicilioEl, telEl, edadEl, ocupacionEl].forEach(el => el && (el.readOnly = true));
      if (sexoEl) sexoEl.disabled = true;
      if (fechaNacEl) fechaNacEl.disabled = true;
      if (edoCivilEl) edoCivilEl.disabled = true;

      // sección mujeres
      const seccionMujeres = document.getElementById('seccionMujeres');
      if (seccionMujeres && sexoEl) {
        seccionMujeres.style.display = (sexoEl.value === 'Femenino') ? 'block' : 'none';
      }
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      // en modo creación podemos avisar
      if (!formularioIdQS) {
        await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar la información del paciente.' });
      }
    }
  }

  // Construir payload (para guardar/generar PDF)
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
      observacionesGenerales: obsEl?.value || '',
      hallazgosRadiograficos: hallEl?.value || ''
    };
  }

  // Guardar (POST)
  async function guardarHistoriaEnBD() {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID faltante', text:'Incluye ?paciente_id=<id> en la URL.' });
      return null;
    }
    if (formularioId && !formularioIdQS) {
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
      if (formularioId && !formularioIdQS) {
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

  // PDF
  async function generarPDF() {
    if (!formularioId) {
      await Swal.fire({ icon:'info', title:'Primero guarda la historia', text:'Necesitas un folio para el PDF.' });
      return;
    }

    const pre = await Swal.fire({
      icon: 'info',
      title: 'Se abrirá el PDF en otra pestaña',
      text: 'Al regresar, podrás descargarlo con un nombre sugerido.',
      confirmButtonText: 'Entendido'
    });
    if (!pre.isConfirmed) return;

    const dataPdf = payloadComun();

    // Firma (solo para PDF)
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
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

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

  // Visualizar por formularioId
  async function cargarParaVisualizar(folio) {
    try {
      const res = await fetch(`/api/patients/forms/historia/${folio}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();

      // 1) Datos del paciente (no editables)
      setValue(nombreEl, d?.nombre_paciente || '');
      setValue(domicilioEl, d?.domicilio || '');
      setValue(telEl, d?.telefono || '');
      if (sexoEl) sexoEl.value = d?.sexo || '';
      if (fechaNacEl) fechaNacEl.value = d?.fecha_nacimiento || '';
      setValue(edadEl, d?.edad ?? calcEdad(fechaNacEl.value));
      if (edoCivilEl) edoCivilEl.value = d?.estado_civil || '';
      setValue(ocupacionEl, d?.ocupacion || '');
      setValue(motivoEl, d?.motivo_consulta || '');

      // 2) Checkboxes “¿Cuál?”
      const tSi = !!d?.tratamiento_medico_si;
      const mSi = !!d?.medicamento_si;
      const pSi = !!d?.problema_dental_si;

      const tEl = document.getElementById('tratamientoMedicoSi');
      const mEl = document.getElementById('medicamentoSi');
      const pEl = document.getElementById('problemaDentalSi');

      if (tEl) tEl.checked = tSi;
      if (mEl) mEl.checked = mSi;
      if (pEl) pEl.checked = pSi;

      setConditionalVisibility('tratamientoMedicoSi', 'tratamientoMedicoCual');
      setConditionalVisibility('medicamentoSi', 'medicamentoCual');
      setConditionalVisibility('problemaDentalSi', 'problemaDentalCual');

      const tCual = document.querySelector('#tratamientoMedicoCual input');
      const mCual = document.querySelector('#medicamentoCual input');
      const pCual = document.querySelector('#problemaDentalCual input');

      if (tCual) tCual.value = d?.tratamiento_medico_cual || '';
      if (mCual) mCual.value = d?.medicamento_cual || '';
      if (pCual) pCual.value = d?.problema_dental_cual || '';

      // 3) Tablas JSON
      const pat = Array.isArray(d?.antecedentes_patologicos_json) ? d.antecedentes_patologicos_json : [];
      const muj = Array.isArray(d?.solo_mujeres_json) ? d.solo_mujeres_json : [];
      const nop = Array.isArray(d?.no_patologicos_json) ? d.no_patologicos_json : [];
      const fam = Array.isArray(d?.antecedentes_familiares_json) ? d.antecedentes_familiares_json : [];

      // Patológicos
      const filasPat = document.querySelectorAll('#tablaPatologicos tr');
      pat.forEach((r, idx) => {
        const tr = filasPat[idx];
        if (!tr) return;
        tr.cells[1].querySelector('input').checked = !!r.si;
        tr.cells[2].querySelector('input').checked = !!r.no;
        tr.cells[3].querySelector('input').value = r.fecha || '';
      });

      // Solo mujeres
      const filasMuj = document.querySelectorAll('#tablaMujeres tr');
      muj.forEach((r, idx) => {
        const tr = filasMuj[idx];
        if (!tr) return;
        tr.cells[1].querySelector('input').checked = !!r.si;
        tr.cells[2].querySelector('input').checked = !!r.no;
        tr.cells[3].querySelector('input').value = r.fecha || '';
      });

      // No patológicos
      const filasNoPat = document.querySelectorAll('#tablaNoPatologicos tr');
      nop.forEach((r, idx) => {
        const tr = filasNoPat[idx];
        if (!tr) return;
        tr.cells[1].querySelector('input').checked = !!r.si;
        tr.cells[2].querySelector('input').checked = !!r.no;
        tr.cells[3].querySelector('input').value = r.cantidad || '';
      });

      // Familiares (por claves)
      const filasFam = document.querySelectorAll('#tablaFamiliares tr');
      const miembros = ["Madre","Abuela Materna","Abuelo Materno","Padre","Abuela Paterna","Abuelo Paterna","Hermano","Otros"];
      fam.forEach((fItem, idx) => {
        const tr = filasFam[idx];
        if (!tr) return;
        miembros.forEach((m, mIdx) => {
          const val = !!fItem[m];
          tr.cells[mIdx+1].querySelector('input').checked = val;
        });
      });

      // 4) Interrogatorio (SIS)
      const sisMap = {
        Cardiovascular: 'sis_cardiovascular',
        Circulatorio: 'sis_circulatorio',
        Respiratorio: 'sis_respiratorio',
        Digestivo: 'sis_digestivo',
        Urinario: 'sis_urinario',
        Genital: 'sis_genital',
        'Musculoesquelético': 'sis_musculoesqueletico',
        SNC: 'sis_snc'
      };
      document.querySelectorAll('textarea.sis').forEach(t => {
        const key = t.dataset.key;
        const col = sisMap[key];
        if (col && d[col] != null) t.value = d[col] || '';
      });

      // 5) Exploración
      const explMap = {
        'Cabeza, Cuello, Cara, Perfil': 'expl_cabeza_cuello_cara_perfil',
        'ATM (Articulación Temporomandibular)': 'expl_atm',
        'Labios, Frenillos, Lengua, Paladar Duro, Blando, Orofaringe, Región Yugal': 'expl_labios_frenillos_lengua_paladar_orofaringe_yugal',
        'Piso de Boca, Glándulas Salivales, Carrillos': 'expl_piso_boca_glandulas_salivales_carrillos',
        'Encías, Procesos Alveolares': 'expl_encias_procesos_alveolares'
      };
      document.querySelectorAll('textarea.expl').forEach(t => {
        const key = t.dataset.key;
        const col = explMap[key];
        if (col && d[col] != null) t.value = d[col] || '';
      });

      // 6) Observaciones y Hallazgos
      if (obsEl) obsEl.value = d?.observaciones || '';
      if (hallEl) hallEl.value = d?.hallazgos || '';

      // 7) Modo visualizar: bloquea edición y oculta Guardar
      if (formularioIdQS) {
        if (btnGuardar) btnGuardar.style.display = 'none';
        form.querySelectorAll('input, select, textarea, canvas').forEach(el => {
          if (el.id === 'signature-pad-paciente') return; // permitir firmar si quisieras
          if (el.tagName === 'SELECT') el.disabled = true;
          else el.readOnly = true;
        });
        form.querySelectorAll('input[type=radio], input[type=checkbox]').forEach(el => el.disabled = true);
      }

    } catch (err) {
      console.error('[Visualizar] Error:', err);
      await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el folio para visualizar.' });
    }
  }

  /***************** ========= EVENTOS ========= *****************/
  // Guardar: solo en modo creación
  if (!formularioIdQS && btnGuardar) {
    btnGuardar.addEventListener('click', async () => {
      const folio = await guardarHistoriaEnBD();
      if (folio) {
        // opcional: notificación o redirección
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!formularioIdQS && !formularioId) {
        const folio = await guardarHistoriaEnBD();
        if (!folio) return;
      }
      await Swal.fire({ icon:'success', title:'📤 Enviado', text:'(Simulado) Formulario enviado al paciente.' });
    });
  }

  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      if (!formularioId) {
        // En visualización ya existe; en creación pedimos guardar primero
        if (!formularioIdQS) {
          const folio = await guardarHistoriaEnBD();
          if (!folio) return;
        }
      }
      await generarPDF();
    });
  }

  /***************** ========= ARRANQUE ========= *****************/
  // Modo creación: cargamos datos del paciente
  if (!formularioIdQS && pacienteId) {
    await cargarPaciente();
  }

  // Modo visualización: cargamos el folio completo
  if (formularioIdQS && formularioId) {
    await cargarParaVisualizar(formularioId);
  }

  // Asegurar visibilidad inicial de condicionales acorde a estado de los checkboxes
  setConditionalVisibility('tratamientoMedicoSi', 'tratamientoMedicoCual');
  setConditionalVisibility('medicamentoSi', 'medicamentoCual');
  setConditionalVisibility('problemaDentalSi', 'problemaDentalCual');

  // Firma - limpiar
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
