// public/js/ortodoncia.js
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('ortodonciaForm');
  if (!form) return console.error('❌ No se encontró #ortodonciaForm');

  // --- Refs
  const nombreEl     = form.querySelector('[name="nombrePaciente"]');
  const fechaIngEl   = form.querySelector('[name="fechaIngreso"]');
  const fechaAltaEl  = form.querySelector('[name="fechaAlta"]');
  const btnGuardar   = document.getElementById('btnGuardar');
  const btnEnviar    = document.getElementById('btnEnviar');
  const btnPDF       = document.getElementById('descargarPDF');

  // --- QS
  const qs = new URLSearchParams(location.search);
  const pacienteId       = qs.get('paciente_id') || qs.get('id') || null;
  const formularioIdQS   = qs.get('formulario_id') || null;

  // --- JWT
  const token = localStorage.getItem('token');
  if (!token) {
    await Swal.fire({ icon:'warning', title:'No autenticado', text:'Inicia sesión para continuar.' });
    location.href = '/login.html'; return;
  }
  const authHeaders = { Authorization: `Bearer ${token}` };

  // --- Estado local (folio/aviso a perfil)
  const SS_KEY   = (pid) => `ortodoncia:formId:${pid}`;
  const SAVE_KEY = (pid) => `ortodoncia:saved:${pid}`;
  let formularioId = formularioIdQS
    ? Number(formularioIdQS)
    : (pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null);

  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('ortodoncia') : null;
  function notificarOrtodonciaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      bc?.postMessage?.({ type:'ortodoncia-saved', pacienteId:String(pid), formularioId:folio });
    } catch {}
  }

  // --- Helpers
  const todayISO = () => {
    const now = new Date();
    const z = new Date(now - now.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  };
  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ').trim();

  function stripAccents(str='') { return str.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function firstAndLast(full='') {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return {first:'',last:''};
    if (parts.length===1) return {first:parts[0], last:''};
    return { first:parts[0], last:parts[parts.length-1] };
  }
  function yyyymmdd(dStr) {
    const s = (dStr || '').replaceAll('-', '');
    if (s && s.length===8) return s;
    return todayISO().replaceAll('-', '');
  }
  function buildFilename({ fecha, formKey, fullName }) {
    const { first, last } = firstAndLast(fullName || '');
    const base = `${yyyymmdd(fecha)}_${formKey}_${[first,last].filter(Boolean).join('_')}`;
    return stripAccents(base).replace(/\s+/g,'_');
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // --- Cargar paciente (para modo NUEVO)
  async function cargarPaciente() {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'Falta paciente', text:'Agrega ?paciente_id=<id> en la URL.' });
      return;
    }
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      if (nombreEl && !nombreEl.value) nombreEl.value = buildNombre(p) || '(Sin nombre)';
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el paciente.' });
    }
  }

  // --- Bloquear Nombre + Fecha Ingreso (= hoy)
  function lockReadOnly(el) {
    if (!el) return;
    el.readOnly = true;
    el.addEventListener('keydown', e => e.preventDefault(), true);
    el.addEventListener('paste',  e => e.preventDefault(), true);
    el.addEventListener('cut',    e => e.preventDefault(), true);
    el.addEventListener('drop',   e => e.preventDefault(), true);
  }

  function initFechaIngresoHoy() {
    if (!fechaIngEl) return;
    const iso = todayISO();
    fechaIngEl.value = iso;
    fechaIngEl.min   = iso;
    fechaIngEl.max   = iso;
    lockReadOnly(fechaIngEl);
    // Fuerza mantener HOY aunque se intente abrir el datepicker
    const lockFecha = (e) => { e.preventDefault(); fechaIngEl.value = iso; };
    ['keydown','keypress','paste','input','change','mousedown','touchstart'].forEach(evt =>
      fechaIngEl.addEventListener(evt, lockFecha, true)
    );
  }

  // --- Extraer tablas genéricas (por ID)
  const extraerTabla = (selector, campos) =>
    Array.from(form.querySelectorAll(`${selector} tbody tr`)).map(row => {
      const celdas = row.querySelectorAll('input, textarea');
      const obj = {};
      campos.forEach((campo, i) => (obj[campo] = (celdas[i]?.value ?? '').toString()));
      const hayAlgo = Object.values(obj).some(v => (v ?? '').toString().trim() !== '');
      return hayAlgo ? obj : null;
    }).filter(Boolean);

  // --- Build data (UI → payload)
  const buildData = () => {
    const f = form;
    const data = {
      nombrePaciente: f.querySelector('[name="nombrePaciente"]')?.value || '',
      fechaIngreso:   f.querySelector('[name="fechaIngreso"]')?.value || '',
      fechaAlta:      f.querySelector('[name="fechaAlta"]')?.value || '',

      examenClinico: {
        tipoCuerpo: f.tipoCuerpo?.value || '',
        tipoCara:   f.tipoCara?.value || '',
        tipoCraneo: f.tipoCraneo?.value || '',
        otros:      f.otros?.value || ''
      },

      analisisFuncional: {
        respiracion:    f.respiracion?.value || '',
        deglucion:      f.deglucion?.value || '',
        masticacion:    f.masticacion?.value || '',
        fonacion:       f.fonacion?.value || '',
        problemasATM:   f.problemasATM?.value || '',
        dolorATM:       f.querySelector('[name="dolor_atm"]:checked')?.value || '',
        ruidosATM:      f.querySelector('[name="ruidos_atm"]:checked')?.value || '',
        dolorPalpacion: f.dolorPalpacion?.value || '',
        aperturaMax:    f.aperturaMax?.value || '',
        latIzq:         f.latIzq?.value || '',
        protrusion:     f.protrusion?.value || '',
        latDer:         f.latDer?.value || '',
        verticalOCRC:   f.verticalOCRC?.value || '',
        horizontalOCRC: f.horizontalOCRC?.value || '',
        otrosOCRC:      f.otrosOCRC?.value || ''
      },

      analisisModelos: {
        relacionesDentarias: {
          oclusionMolaresDer: f.oclusionMolaresDer?.value || '',
          oclusionMolaresIzq: f.oclusionMolaresIzq?.value || '',
          oclusionCaninosDer: f.oclusionCaninosDer?.value || '',
          oclusionCaninosIzq: f.oclusionCaninosIzq?.value || '',
          resalteHorizontal:  f.resalteHorizontal?.value || '',
          resalteVertical:    f.resalteVertical?.value || '',
          lineaMediaSup:      f.lineaMediaSup?.value || '',
          lineaMediaInf:      f.lineaMediaInf?.value || '',
          mordidaCruzadaDer:  f.mordidaCruzadaDer?.value || '',
          mordidaCruzadaIzq:  f.mordidaCruzadaIzq?.value || ''
        },
        anomaliasDentarias: {
          dientesAusentes:     f.dientesAusentes?.value || '',
          dientesMalformados:  f.dientesMalformados?.value || '',
          dientesGiroversion:  f.dientesGiroversion?.value || '',
          dientesInfraversion: f.dientesInfraversion?.value || '',
          dientesSupraversion: f.dientesSupraversion?.value || '',
          dientesPigmentados:  f.dientesPigmentados?.value || ''
        },
        arcadasIndividuales: {
          arcadaSuperior: f.querySelector('[name="arcada_sup"]:checked')?.value || '',
          arcadaInferior: f.querySelector('[name="arcada_inf"]:checked')?.value || ''
        }
      },

      indicesValorativos: {
        pontMaxilar: {
          premaxila:  { nc: f.pontPremaxilaNC?.value || '',  pac: f.pontPremaxilaPac?.value || '',  dif: f.pontPremaxilaDif?.value || '' },
          premolares: { nc: f.pontPremolaresNC?.value || '', pac: f.pontPremolaresPac?.value || '', dif: f.pontPremolaresDif?.value || '' },
          molares:    { nc: f.pontMolaresNC?.value || '',    pac: f.pontMolaresPac?.value || '',    dif: f.pontMolaresDif?.value || '' }
        },
        pontMandibular: {
          premolares: { pac: f.pontMandPremolaresPac?.value || '', dif: f.pontMandPremolaresDif?.value || '' },
          molares:    { pac: f.pontMandMolaresPac?.value || '',    dif: f.pontMandMolaresDif?.value || '' }
        },
        sumaIncisivos:    f.sumaIncisivos?.value || '',
        boltonSuperiores: Array.from(f.querySelectorAll('[placeholder^="1"]')).map(i => i.value || ''),
        boltonInferiores: Array.from(f.querySelectorAll('[placeholder^="4"],[placeholder^="3"]')).map(i => i.value || ''),
        diferenciaBolton: f.diferenciaBolton?.value || '',
        longitudArco: {
          apinamiento:       f.apinamiento?.value || '',
          protrusionDental:  f.protrusionDental?.value || '',
          curvaSpee:         f.curvaSpee?.value || '',
          totalLongitud:     f.totalLongitud?.value || ''
        }
      },

      planTratamiento: {
        ortopediaMaxilar:   f.ortopediaMaxilar?.value || '',
        ortopediaMandibula: f.ortopediaMandibula?.value || '',
        dientesInfIncisivo: f.dientesInfIncisivo?.value || '',
        dientesInfMolar:    f.dientesInfMolar?.value || '',
        dientesSupMolar:    f.dientesSupMolar?.value || '',
        dientesSupIncisivo: f.dientesSupIncisivo?.value || '',
        dientesSupEstetica: f.dientesSupEstetica?.value || '',
        anclaje: {
          maxilar:    f.querySelector('[name="anclaje_max"]:checked')?.value || '',
          mandibular: f.querySelector('[name="anclaje_man"]:checked')?.value || ''
        }
      },

      analisisCefalometrico: {
        biotipoFacial:        extraerTabla('#biotipoFacial',       ['factor','nc','paciente','diferencia','dc','resultado']),
        claseEsqueletica:     extraerTabla('#claseEsqueletica',    ['factor','nc','paciente','dc']),
        problemasVerticales:  extraerTabla('#problemasVerticales', ['factor','nc','paciente','dc']),
        factoresDentales:     extraerTabla('#factoresDentales',    ['factor','nc','paciente','dc']),
        diagnosticoCefalometrico: f.diagnosticoCefalometrico?.value || ''
      },
      factoresComplementarios: {
        claseII:    extraerTabla('#claseII',   ['factor','nc','paciente','dc']),
        claseIII:   extraerTabla('#claseIII',  ['factor','nc','paciente','dc']),
        verticales: extraerTabla('#verticales',['factor','nc','paciente','dc'])
      },
      analisisJaraback:   extraerTabla('#jaraback',        ['factor','nc','paciente','dc']),
      medidasLineales:    extraerTabla('#medidasLineales', ['factor','nc','paciente','dc']),
      analisisMcNamara:   extraerTabla('#mcnamara',        ['factor','nc','paciente','dc'])
    };
    return data;
  };

  // --- Guardar (nuevo folio)
  async function guardarOrtodonciaEnBD() {
    const data = buildData();
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'Falta paciente', text:'Agrega ?paciente_id=<id> en la URL.' });
      return null;
    }
    if (!data.nombrePaciente || !data.fechaIngreso) {
      await Swal.fire({ icon:'warning', title:'Faltan datos', text:'Nombre y fecha de ingreso son obligatorios.' });
      return null;
    }
    if (formularioId && !formularioIdQS) {
      const r = await Swal.fire({
        title: `Ya existe un folio guardado (${formularioId}).`,
        text: '¿Deseas crear otro formulario nuevo?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, crear otro',
        cancelButtonText: 'Cancelar'
      });
      if (!r.isConfirmed) return null;
    }

    btnGuardar?.setAttribute('disabled', true);
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/ortodoncia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      formularioId = Number(json.formulario_id) || null;

      if (formularioId && pacienteId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarOrtodonciaGuardada(pacienteId, formularioId);
      }
      await Swal.fire({ icon:'success', title:'Guardado', text:`Folio: ${formularioId ?? '—'}` });
      return formularioId;
    } catch (e) {
      console.error('Error al guardar ortodoncia:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar la ortodoncia.' });
      return null;
    } finally {
      btnGuardar?.removeAttribute('disabled');
    }
  }

  // --- PDF
  async function generarPDFyDescargar() {
    if (!formularioId) {
      await Swal.fire({
        title: 'Primero guarda la ortodoncia',
        text: 'Para generar el PDF necesitas un folio guardado.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const pre = await Swal.fire({
      icon: 'info',
      title: 'Se abrirá el PDF en otra pestaña',
      text: 'Al regresar podrás descargarlo con nombre sugerido.',
      confirmButtonText: 'Entendido'
    });
    if (!pre.isConfirmed) return;

    const data = buildData();
    data.formularioId = formularioId; // para mostrar folio en el PDF si lo deseas

    try {
      const res = await fetch('/api/pdf/ortodoncia/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      const fullName = (nombreEl?.value || '').trim();
      const fecha    = (fechaIngEl?.value || todayISO());
      const filename = buildFilename({ fecha, formKey: 'ortodoncia', fullName });

      await Swal.fire({
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
      }).then((r) => { if (r.isConfirmed) downloadBlob(blob, filename); });

      URL.revokeObjectURL(viewUrl);
    } catch (err) {
      console.error('❌ Error al generar PDF:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  }

  // --- VISUALIZAR (solo lectura)
  function setIf(el, val) { if (el) el.value = (val ?? '').toString(); }
  function setNum(el, val) { if (el) el.value = (val ?? '') === '' ? '' : String(val); }

  function fillTable(selector, rows, cols) {
    const tbody = form.querySelector(`${selector} tbody`);
    if (!tbody) return;
    // limpia
    tbody.innerHTML = '';
    const lines = Array.isArray(rows) ? rows : [];
    if (!lines.length) {
      // deja al menos 2 filas vacías como plantilla
      for (let i=0;i<2;i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><input type="text" class="form-control"></td>'.repeat(cols)
          .replace(/<\/td><td>/g, '</td><td>');
        tbody.appendChild(tr);
      }
      return;
    }
    lines.forEach(obj => {
      const tr = document.createElement('tr');
      const vals = Object.values(obj);
      let html = '';
      for (let i=0; i<cols; i++) {
        const v = (vals[i] ?? '').toString();
        const type = (i===1 || i===2 || i===3 || i===4) ? 'number' : 'text';
        html += `<td><input type="${type}" class="form-control input-number" value="${v}"></td>`;
      }
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
  }

  async function cargarParaVisualizar(formId) {
    try {
      const res = await fetch(`/api/patients/forms/ortodoncia/${encodeURIComponent(formId)}`, {
        headers: { 'Accept':'application/json', Authorization: `Bearer ${token}` }
      });
      const raw = await res.text();
      if (!res.ok) {
        console.error('[Visualizar] HTTP ' + res.status, raw);
        let msg = `HTTP ${res.status}`;
        try { const jErr = JSON.parse(raw); msg += ` – ${jErr.error || jErr.message || 'Error'}`; } catch {}
        await Swal.fire({ icon:'error', title:'No se pudo cargar', text: msg });
        return;
      }
      let j = {};
      try { j = JSON.parse(raw); } catch { await Swal.fire({icon:'error',title:'Error',text:'Respuesta inválida del servidor.'}); return; }

      // Paciente / Fechas
      const nombre = j?.paciente?.nombre_completo
        || ([j?.paciente?.nombre, j?.paciente?.apellido].filter(Boolean).join(' '))
        || j?.nombrePaciente || '(Sin nombre)';
      const fechaIn = (j?.fechaIngreso || j?.fecha || '').slice(0,10) || todayISO();
      const fechaAl = (j?.fechaAlta || '').slice(0,10) || '';

      setIf(nombreEl, nombre);
      setIf(fechaIngEl, fechaIn);
      setIf(fechaAltaEl, fechaAl);

      // Examen Clínico
      setIf(form.tipoCuerpo,  j?.examenClinico?.tipoCuerpo);
      setIf(form.tipoCara,    j?.examenClinico?.tipoCara);
      setIf(form.tipoCraneo,  j?.examenClinico?.tipoCraneo);
      setIf(form.otros,       j?.examenClinico?.otros);

      // Funcional
      setIf(form.respiracion,     j?.analisisFuncional?.respiracion);
      setIf(form.deglucion,       j?.analisisFuncional?.deglucion);
      setIf(form.masticacion,     j?.analisisFuncional?.masticacion);
      setIf(form.fonacion,        j?.analisisFuncional?.fonacion);
      setIf(form.problemasATM,    j?.analisisFuncional?.problemasATM);
      const dolor = j?.analisisFuncional?.dolorATM;
      const ruidos = j?.analisisFuncional?.ruidosATM;
      if (dolor)  form.querySelector(`[name="dolor_atm"][value="${dolor}"]`)?.setAttribute('checked', true);
      if (ruidos) form.querySelector(`[name="ruidos_atm"][value="${ruidos}"]`)?.setAttribute('checked', true);
      setIf(form.dolorPalpacion,  j?.analisisFuncional?.dolorPalpacion);
      setNum(form.aperturaMax,    j?.analisisFuncional?.aperturaMax);
      setNum(form.latIzq,         j?.analisisFuncional?.latIzq);
      setNum(form.protrusion,     j?.analisisFuncional?.protrusion);
      setNum(form.latDer,         j?.analisisFuncional?.latDer);
      setNum(form.verticalOCRC,   j?.analisisFuncional?.verticalOCRC);
      setNum(form.horizontalOCRC, j?.analisisFuncional?.horizontalOCRC);
      setIf(form.otrosOCRC,       j?.analisisFuncional?.otrosOCRC);

      // Modelos → relaciones
      setNum(form.oclusionMolaresDer, j?.analisisModelos?.relacionesDentarias?.oclusionMolaresDer);
      setNum(form.oclusionMolaresIzq, j?.analisisModelos?.relacionesDentarias?.oclusionMolaresIzq);
      setNum(form.oclusionCaninosDer, j?.analisisModelos?.relacionesDentarias?.oclusionCaninosDer);
      setNum(form.oclusionCaninosIzq, j?.analisisModelos?.relacionesDentarias?.oclusionCaninosIzq);
      setNum(form.resalteHorizontal,  j?.analisisModelos?.relacionesDentarias?.resalteHorizontal);
      setNum(form.resalteVertical,    j?.analisisModelos?.relacionesDentarias?.resalteVertical);
      setNum(form.lineaMediaSup,      j?.analisisModelos?.relacionesDentarias?.lineaMediaSup);
      setNum(form.lineaMediaInf,      j?.analisisModelos?.relacionesDentarias?.lineaMediaInf);
      setNum(form.mordidaCruzadaDer,  j?.analisisModelos?.relacionesDentarias?.mordidaCruzadaDer);
      setNum(form.mordidaCruzadaIzq,  j?.analisisModelos?.relacionesDentarias?.mordidaCruzadaIzq);

      // Modelos → anomalías
      setIf(form.dientesAusentes,     j?.analisisModelos?.anomaliasDentarias?.dientesAusentes);
      setIf(form.dientesMalformados,  j?.analisisModelos?.anomaliasDentarias?.dientesMalformados);
      setIf(form.dientesGiroversion,  j?.analisisModelos?.anomaliasDentarias?.dientesGiroversion);
      setIf(form.dientesInfraversion, j?.analisisModelos?.anomaliasDentarias?.dientesInfraversion);
      setIf(form.dientesSupraversion, j?.analisisModelos?.anomaliasDentarias?.dientesSupraversion);
      setIf(form.dientesPigmentados,  j?.analisisModelos?.anomaliasDentarias?.dientesPigmentados);

      // Arcadas
      const as = j?.analisisModelos?.arcadasIndividuales?.arcadaSuperior;
      const ai = j?.analisisModelos?.arcadasIndividuales?.arcadaInferior;
      if (as) form.querySelector(`[name="arcada_sup"][value="${as}"]`)?.setAttribute('checked', true);
      if (ai) form.querySelector(`[name="arcada_inf"][value="${ai}"]`)?.setAttribute('checked', true);

      // Índices valorativos
      setNum(form.pontPremaxilaNC,   j?.indicesValorativos?.pontMaxilar?.premaxila?.nc);
      setNum(form.pontPremaxilaPac,  j?.indicesValorativos?.pontMaxilar?.premaxila?.pac);
      setNum(form.pontPremaxilaDif,  j?.indicesValorativos?.pontMaxilar?.premaxila?.dif);
      setNum(form.pontPremolaresNC,  j?.indicesValorativos?.pontMaxilar?.premolares?.nc);
      setNum(form.pontPremolaresPac, j?.indicesValorativos?.pontMaxilar?.premolares?.pac);
      setNum(form.pontPremolaresDif, j?.indicesValorativos?.pontMaxilar?.premolares?.dif);
      setNum(form.pontMolaresNC,     j?.indicesValorativos?.pontMaxilar?.molares?.nc);
      setNum(form.pontMolaresPac,    j?.indicesValorativos?.pontMaxilar?.molares?.pac);
      setNum(form.pontMolaresDif,    j?.indicesValorativos?.pontMaxilar?.molares?.dif);

      setNum(form.pontMandPremolaresPac, j?.indicesValorativos?.pontMandibular?.premolares?.pac);
      setNum(form.pontMandPremolaresDif, j?.indicesValorativos?.pontMandibular?.premolares?.dif);
      setNum(form.pontMandMolaresPac,    j?.indicesValorativos?.pontMandibular?.molares?.pac);
      setNum(form.pontMandMolaresDif,    j?.indicesValorativos?.pontMandibular?.molares?.dif);

      setNum(form.sumaIncisivos, j?.indicesValorativos?.sumaIncisivos);
      setNum(form.diferenciaBolton, j?.indicesValorativos?.diferenciaBolton);
      setNum(form.apinamiento,      j?.indicesValorativos?.longitudArco?.apinamiento);
      setNum(form.protrusionDental, j?.indicesValorativos?.longitudArco?.protrusionDental);
      setNum(form.curvaSpee,        j?.indicesValorativos?.longitudArco?.curvaSpee);
      setNum(form.totalLongitud,    j?.indicesValorativos?.longitudArco?.totalLongitud);

      // Plan de tratamiento
      setIf(form.ortopediaMaxilar,   j?.planTratamiento?.ortopediaMaxilar);
      setIf(form.ortopediaMandibula, j?.planTratamiento?.ortopediaMandibula);
      setIf(form.dientesInfIncisivo, j?.planTratamiento?.dientesInfIncisivo);
      setIf(form.dientesInfMolar,    j?.planTratamiento?.dientesInfMolar);
      setIf(form.dientesSupMolar,    j?.planTratamiento?.dientesSupMolar);
      setIf(form.dientesSupIncisivo, j?.planTratamiento?.dientesSupIncisivo);
      setIf(form.dientesSupEstetica, j?.planTratamiento?.dientesSupEstetica);
      const aMax = j?.planTratamiento?.anclaje?.maxilar;
      const aMan = j?.planTratamiento?.anclaje?.mandibular;
      if (aMax) form.querySelector(`[name="anclaje_max"][value="${aMax}"]`)?.setAttribute('checked', true);
      if (aMan) form.querySelector(`[name="anclaje_man"][value="${aMan}"]`)?.setAttribute('checked', true);

      // Tablas libres (biotipo, clase, verticales, dentales, etc.)
      fillTable('#biotipoFacial',       j?.analisisCefalometrico?.biotipoFacial, 6);
      fillTable('#claseEsqueletica',    j?.analisisCefalometrico?.claseEsqueletica, 4);
      fillTable('#problemasVerticales', j?.analisisCefalometrico?.problemasVerticales, 4);
      fillTable('#factoresDentales',    j?.analisisCefalometrico?.factoresDentales, 4);
      setIf(form.diagnosticoCefalometrico, j?.analisisCefalometrico?.diagnosticoCefalometrico);
      fillTable('#claseII',   j?.factoresComplementarios?.claseII,   4);
      fillTable('#claseIII',  j?.factoresComplementarios?.claseIII,  4);
      fillTable('#verticales',j?.factoresComplementarios?.verticales,4);
      fillTable('#jaraback',        j?.analisisJaraback,   4);
      fillTable('#medidasLineales', j?.medidasLineales,    4);
      fillTable('#mcnamara',        j?.analisisMcNamara,   4);

      // Solo lectura (como receta/consents): bloquea inputs, deja PDF/Enviar
      form.querySelectorAll('input, textarea, select, button.btn-step').forEach(el => {
        if (el === btnPDF) return;
        if (el === btnEnviar) return;
        el.setAttribute('readonly', 'true');
        el.setAttribute('disabled', 'true');
      });
      btnGuardar?.classList.add('d-none');

    } catch (e) {
      console.error('No se pudo visualizar ortodoncia:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar la ortodoncia para visualizar.' });
    }
  }

  // --- Listeners
  btnGuardar?.addEventListener('click', guardarOrtodonciaEnBD);

  btnEnviar?.addEventListener('click', async () => {
    if (!formularioId) {
      await Swal.fire({
        title: 'Primero guarda la ortodoncia',
        text: 'Para enviar debes tener un folio guardado.',
        icon: 'info',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    await new Promise(r => setTimeout(r, 400));
    await Swal.fire({ icon:'success', title:'Enviado', text:`Folio ${formularioId}` });
  });

  btnPDF?.addEventListener('click', () => form.requestSubmit());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    await generarPDFyDescargar();
  }, true);

  // --- Init según QS
  if (formularioIdQS) {
    await cargarParaVisualizar(formularioIdQS);
  } else {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'Falta el ID del paciente', text:'Agrega ?paciente_id=<id> en la URL.' });
      return;
    }
    await cargarPaciente();
    lockReadOnly(nombreEl);
    initFechaIngresoHoy();
  }
});
