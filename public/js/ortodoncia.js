document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('ortodonciaForm');
  if (!form) return console.error('❌ No se encontró #ortodonciaForm');

  // --- refs del DOM
  const nombreEl     = form.querySelector('[name="nombrePaciente"]');
  const fechaIngEl   = form.querySelector('[name="fechaIngreso"]');
  const fechaAltaEl  = form.querySelector('[name="fechaAlta"]');
  const btnGuardar   = document.getElementById('btnGuardar');
  const btnEnviar    = document.getElementById('btnEnviar');
  const btnDescargar = document.getElementById('descargarPDF'); // opcional

  // --- paciente_id desde la URL
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');
  if (!pacienteId) {
    await Swal.fire({ icon:'warning', title:'ID no encontrado', text:'La URL debe incluir ?paciente_id=<id>' });
    return;
  }

  // --- estado local (folio guardado)
  const SS_KEY   = (pid) => `ortodoncia:formId:${pid}`;
  const SAVE_KEY = (pid) => `ortodoncia:saved:${pid}`;
  let formularioId = Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null;

  // --- canal para avisar al perfil
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('ortodoncia') : null;
  function notificarOrtodonciaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      if (bc) bc.postMessage({ type: 'ortodoncia-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // --- JWT
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // --- helpers
  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ');

  const hoyISO = (() => {
    const now = new Date();
    return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })();

  // --- cargar paciente (y setear valores bloqueados)
  async function cargarPaciente() {
    try {
      const res = await fetch(`/api/patients/${pacienteId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      if (nombreEl && !nombreEl.value) nombreEl.value = buildNombre(p) || '';
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar la información del paciente.' });
    }
  }
  await cargarPaciente();

  // 🔒 BLOQUEAR NOMBRE Y FECHA DE INGRESO
  function lockReadOnly(el) {
    if (!el) return;
    el.readOnly = true;
    el.addEventListener('keydown', e => e.preventDefault());
    el.addEventListener('paste', e => e.preventDefault());
    el.addEventListener('cut',   e => e.preventDefault());
    el.addEventListener('drop',  e => e.preventDefault());
  }

  if (nombreEl) {
    lockReadOnly(nombreEl);
    nombreEl.classList.add('readonly-input');
  }

  if (fechaIngEl) {
    fechaIngEl.value = hoyISO;
    fechaIngEl.min = hoyISO;
    fechaIngEl.max = hoyISO;
    lockReadOnly(fechaIngEl);

    const lockFecha = (e) => {
      e.preventDefault();
      fechaIngEl.value = hoyISO;
    };
    ['keydown','keypress','paste','input','change','mousedown','touchstart'].forEach(evt =>
      fechaIngEl.addEventListener(evt, lockFecha, true)
    );
    fechaIngEl.classList.add('readonly-input');
  }

  // === helpers nombre archivo ===
  function stripAccents(str='') { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function firstAndLast(full='') {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first:'', last:'' };
    if (parts.length === 1) return { first:parts[0], last:'' };
    return { first:parts[0], last:parts[parts.length-1] };
  }
  function yyyymmdd(dStr) {
    const s = (dStr || '').replaceAll('-', '');
    if (s && s.length === 8) return s;
    return hoyISO.replaceAll('-', '');
  }
  function buildFilename({ fecha, formKey, fullName }) {
    const { first, last } = firstAndLast(fullName || '');
    const base = `${yyyymmdd(fecha)}_${formKey}_${[first,last].filter(Boolean).join('_')}`;
    return stripAccents(base).replace(/\s+/g, '_');
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // === util para extraer tablas genéricas (por ID) ===
  const extraerTabla = (selector, campos) =>
    Array.from(form.querySelectorAll(`${selector} tbody tr`)).map(row => {
      const celdas = row.querySelectorAll('input, textarea');
      const obj = {};
      campos.forEach((campo, i) => (obj[campo] = (celdas[i]?.value ?? '').toString()));
      // limpia filas totalmente vacías
      const hayAlgo = Object.values(obj).some(v => (v ?? '').toString().trim() !== '');
      return hayAlgo ? obj : null;
    }).filter(Boolean);

  // === construir data ===
  const buildData = () => {
    const f = form;
    const data = {
      nombrePaciente: f.querySelector('[name="nombrePaciente"]')?.value || '',
      fechaIngreso:   f.querySelector('[name="fechaIngreso"]')?.value || '',
      fechaAlta:      f.querySelector('[name="fechaAlta"]')?.value || '',

      // 2. Examen clínico
      examenClinico: {
        tipoCuerpo: f.tipoCuerpo?.value || '',
        tipoCara:   f.tipoCara?.value || '',
        tipoCraneo: f.tipoCraneo?.value || '',
        otros:      f.otros?.value || ''
      },

      // 3. Análisis funcional
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

      // 4. Modelos
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

      // 5. Índices valorativos
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

      // 6. Plan de tratamiento
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

      // 7–11. Tablas dinámicas
      analisisCefalometrico: {
        biotipoFacial:        extraerTabla('#biotipoFacial',       ['factor','nc','paciente','diferencia','dc','resultado']),
        claseEsqueletica:     extraerTabla('#claseEsqueletica',    ['factor','nc','paciente','dc']),
        problemasVerticales:  extraerTabla('#problemasVerticales', ['factor','nc','paciente','dc']),
        factoresDentales:     extraerTabla('#factoresDentales',    ['factor','nc','paciente','dc']),
        diagnosticoCefalometrico: f.diagnosticoCefalometrico?.value || ''
      },
      factoresComplementarios: {
        claseII:   extraerTabla('#claseII',   ['factor','nc','paciente','dc']),
        claseIII:  extraerTabla('#claseIII',  ['factor','nc','paciente','dc']),
        verticales:extraerTabla('#verticales',['factor','nc','paciente','dc'])
      },
      analisisJaraback:   extraerTabla('#jaraback',        ['factor','nc','paciente','dc']),
      medidasLineales:    extraerTabla('#medidasLineales', ['factor','nc','paciente','dc']),
      analisisMcNamara:   extraerTabla('#mcnamara',        ['factor','nc','paciente','dc'])
    };
    return data;
  };

  // === guardar ===
  async function guardarOrtodonciaEnBD() {
    const data = buildData();
    if (!data.nombrePaciente || !data.fechaIngreso) {
      await Swal.fire({ icon:'warning', title:'Faltan datos', text:'El nombre y la fecha son obligatorios.' });
      return null;
    }
    if (formularioId) {
      const r = await Swal.fire({
        title: `Ya guardaste este formulario (folio ${formularioId}).`,
        text: '¿Deseas crear otro nuevo?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, crear otro',
        cancelButtonText: 'Cancelar'
      });
      if (!r.isConfirmed) return null;
    }

    btnGuardar.disabled = true;
    try {
      const res = await fetch(`/api/patients/${pacienteId}/ortodoncia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      formularioId = Number(json.formulario_id) || null;
      if (formularioId) {
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
      btnGuardar.disabled = false;
    }
  }

  // === generar PDF ===
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
    data.formularioId = formularioId;

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
      const fecha = (fechaIngEl?.value || hoyISO);
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
      }).then((r) => {
        if (r.isConfirmed) downloadBlob(blob, filename);
      });
      URL.revokeObjectURL(viewUrl);
    } catch (err) {
      console.error('❌ Error al generar PDF:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  }

  // === listeners ===
  btnGuardar?.addEventListener('click', guardarOrtodonciaEnBD);
  btnEnviar?.addEventListener('click', async () => {
    if (!formularioId) {
      await Swal.fire({
        title: 'Primero guarda la ortodoncia',
        text: 'Para enviar debes tener folio guardado.',
        icon: 'info',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    await new Promise(r => setTimeout(r, 400));
    await Swal.fire({ icon:'success', title:'Enviado', text:`Folio ${formularioId}` });
  });
  btnDescargar?.addEventListener('click', () => form.requestSubmit());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    await generarPDFyDescargar();
  }, true);
});