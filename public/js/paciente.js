// === Primero: token/roles y guardas ===
const token = localStorage.getItem('token');
const roles = JSON.parse(localStorage.getItem('roles') || '[]');
if (!token || roles.length === 0) location.href = '/login.html';

// === Segundo: lee el id de la URL ===
const pacienteId = new URLSearchParams(location.search).get('id');

// === Utilidades para formateo ===
const fdate = d => d ? new Date(d).toLocaleDateString() : '—';
const money = v => (v == null ? '—' : `$${Number(v).toFixed(2)}`);
const yesno = v => (Number(v) ? 'Sí' : 'No');
const fymdSafe = v => {
  if (!v) return '—';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

// Intenta deducir el tipo por la extensión del archivo
function guessTipoFromPath(path) {
  if (!path) return 'otro';
  const p = String(path).toLowerCase();

  if (p.endsWith('.dcm')) return 'rx'; // DICOM
  if (p.endsWith('.jpg') || p.endsWith('.jpeg') ||
      p.endsWith('.png') || p.endsWith('.webp') ||
      p.endsWith('.gif')) return 'foto';
  if (p.endsWith('.bmp') || p.includes('pano')) return 'panoramica';

  return 'otro';
}


const actionBtns = (formId, formHtml) => `
  <a class="btn btn-sm btn-outline-primary me-1" href="forms/${formHtml}?formulario_id=${formId}">👁️ Visualizar</a>
  <button class="btn btn-sm btn-outline-success" data-form="${formId}">📤 Enviar</button>
`;

function updateEvolucionButtons(pacienteId, data) {
  const btnCrear = document.getElementById('btn-nueva-evo');
  if (!btnCrear) return;

  const evoluciones = data?.evoluciones || data?.evolucion || [];
  const evo = evoluciones[0] || null;
  const evoFormId = evo?.formulario_id ?? evo?.id ?? null;

  if (evoFormId) {
    // Bloquear crear nuevo
    btnCrear.classList.add('disabled');
    btnCrear.removeAttribute('href');
    btnCrear.title = 'Ya existe una evolución. Solo puedes agregar nuevas entradas.';
  } else {
    // Permitir crear
    btnCrear.classList.remove('disabled');
    btnCrear.href = `forms/evolucion.html?paciente_id=${pacienteId}`;
    btnCrear.title = '';
  }
}



// === Tercero: UNA sola función cargarPerfil ===
async function cargarPerfil() {
  if (!pacienteId) {
    document.getElementById('perfil').innerHTML =
      `<p class="text-danger">❌ No se proporcionó el ID del paciente.</p>`;
    return;
  }

  try {
    const url = `/api/patients/${encodeURIComponent(pacienteId)}/forms`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} al consultar ${url}: ${text.slice(0,160)}...`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Respuesta no-JSON del backend. Content-Type: ${ct}. Inicio: ${text.slice(0,160)}...`);
    }

    const data = await res.json();

    // Shape paciente
    const p = data.paciente || {};
    const sexoTexto = p.sexo
      ? (p.sexo.toUpperCase() === 'F' ? 'Femenina'
        : p.sexo.toUpperCase() === 'M' ? 'Masculino'
        : p.sexo)
      : '—';

    document.getElementById('tarjetaPaciente').innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <p><strong>Nombre:</strong> ${p.nombre ?? '—'} ${p.apellido ?? ''}</p>
          <p><strong>Edad:</strong> ${p.edad != null ? p.edad + ' años' : '—'}</p>
          <p><strong>Sexo:</strong> ${sexoTexto}</p>
        </div>
        <div class="col-md-6">
          <p><strong>Email:</strong> ${p.email ?? '—'}</p>
          <p><strong>Teléfono principal:</strong> ${p.telefono_principal ?? '—'}</p>
          <p><strong>Teléfono secundario:</strong> ${p.telefono_secundario ?? '—'}</p>
        </div>
      </div>
    `;

    // Evoluciones
    document.getElementById('tb-evoluciones').innerHTML =
      (data.evoluciones || []).map((r, idx) => {
        const formId = r.formulario_id ?? r.id;
        const agregarBtn = idx === 0 ? `
          <a class="btn btn-sm btn-warning me-1"
            href="forms/evolucion.html?formulario_id=${formId}&append=1">
            ✏️ Agregar
          </a>` : '';

        return `
          <tr>
            <td>${fdate(r.fecha)}</td>
            <td>${r.descripcion || '—'}</td>
            <td>${r.doctor || '—'}</td>
            <td>
              ${agregarBtn}
              <a class="btn btn-sm btn-outline-primary me-1" href="forms/evolucion.html?formulario_id=${formId}">👁️ Visualizar</a>
              <button class="btn btn-sm btn-outline-success" data-form="${formId}">📤 Enviar</button>
            </td>
          </tr>`;
      }).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin evoluciones</td></tr>`;


    // Recetas
    document.getElementById('tb-recetas').innerHTML =
      (data.recetas || []).map(r => `
        <tr>
          <td>${fdate(r.fecha)}</td>
          <td>${r.doctor || '—'}</td>
          <td>${r.meds_count ?? 0}</td>
          <td>
            <span class="badge ${r.estado === 'firmado' ? 'bg-success' : r.estado === 'cerrado' ? 'bg-secondary' : 'bg-warning text-dark'}">
              ${r.estado || 'borrador'}
            </span>
          </td>
          <td>${actionBtns(r.formulario_id, 'receta.html')}</td>
        </tr>
      `).join('') || `<tr><td colspan="5" class="text-center text-muted">Sin recetas</td></tr>`;

    // Presupuestos
    (() => {
      const rows = Array.isArray(data.presupuestos) ? data.presupuestos : [];
      const thead = document.querySelector('#tb-presupuestos')?.closest('table')?.querySelector('thead tr');
      const tbody = document.getElementById('tb-presupuestos');
      if (!tbody || !thead) return;

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin presupuestos</td></tr>`;
        return;
      }

      const useNewShape = rows.some(r => ('total' in r) || ('total_mensual' in r) || ('meses' in r));
      if (useNewShape) {
        thead.innerHTML = `
          <th>Fecha</th>
          <th>Total</th>
          <th>Mensualidad</th>
          <th>Acciones</th>
        `;
        tbody.innerHTML = rows.map(r => {
          const fecha   = fymdSafe(r.fecha || r.creado_en);
          const total   = (r.total != null) ? `$${Number(r.total).toFixed(2)}` : '—';
          const mensual = (r.total_mensual != null)
            ? `$${Number(r.total_mensual).toFixed(2)}${r.meses ? ` / ${r.meses} mes(es)` : ''}`
            : '—';
          return `
            <tr>
              <td>${fecha}</td>
              <td>${total}</td>
              <td>${mensual}</td>
              <td>${actionBtns(r.formulario_id, 'presupuesto-dental.html')}</td>
            </tr>
          `;
        }).join('');
      } else {
        thead.innerHTML = `
          <th>Fecha</th>
          <th>Tratamiento</th>
          <th>Costo</th>
          <th>Acciones</th>
        `;
        tbody.innerHTML = rows.map(r => {
          const fecha = fymdSafe(r.fecha || r.creado_en);
          const trat  = r.tratamiento || '—';
          const costo = (r.costo != null) ? `$${Number(r.costo).toFixed(2)}` : '—';
          return `
            <tr>
              <td>${fecha}</td>
              <td>${trat}</td>
              <td>${costo}</td>
              <td>${actionBtns(r.formulario_id, 'presupuesto-dental.html')}</td>
            </tr>
          `;
        }).join('');
      }
    })();

    // Diagnóstico Infantil
    (() => {
      const tbody = document.getElementById('tb-diag-infantil');
      if (!tbody) return;

      const theadRow = tbody.closest('table')?.querySelector('thead tr');
      if (theadRow) {
        theadRow.innerHTML = `
          <th>Fecha</th>
          <th>Tratamiento</th>
          <th>Costo</th>
          <th>Acciones</th>
        `;
      }

      const rows = Array.isArray(data.diag_infantil)
        ? data.diag_infantil
        : (Array.isArray(data.diagnostico_infantil) ? data.diagnostico_infantil : []);

      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin diagnósticos infantiles</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(r => {
        const formId = r.formulario_id ?? r.id ?? '—';
        const fecha  = fymdSafe(r.fecha || r.creado_en || r.actualizado_en);
        const total  = (r.total_costo != null) ? Number(r.total_costo)
                    : (r.total != null) ? Number(r.total)
                    : 0;
        const trat   = `${r.t_count ?? 0} dientes + ${r.g_count ?? 0} generales`;

        return `
          <tr>
            <td>${fecha}</td>
            <td>${trat}</td>
            <td>$${total.toFixed(2)}</td>
            <td>${actionBtns(formId, 'diag-infantil.html')}</td>
          </tr>
        `;
      }).join('');
    })();

    // Consentimientos
    document.getElementById('tb-consent-odont').innerHTML =
      (data.consentimiento_odontologico||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha)}</td>
          <td>${(r.procedimiento||'').slice(0,80)}${(r.procedimiento||'').length>80?'…':''}</td>
          <td>${yesno(r.firmado)}</td>
          <td>${actionBtns(r.formulario_id, 'consent-odont.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin consentimientos</td></tr>`;

    document.getElementById('tb-consent-quiro').innerHTML =
      (data.consentimiento_quirurgico||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha)}</td>
          <td>${(r.intervencion||'').slice(0,80)}${(r.intervencion||'').length>80?'…':''}</td>
          <td>${yesno(r.firmado)}</td>
          <td>${actionBtns(r.formulario_id, 'consent-quiro.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin consentimientos</td></tr>`;

    // Historia clínica
    document.getElementById('tb-historia').innerHTML =
      (data.historia_clinica||[]).map(r => `
        <tr>
          <td>${r.formulario_id}</td>
          <td>${r.nombre_paciente ?? '—'}</td>
          <td>${fdate(r.creado_en)}</td>
          <td>${actionBtns(r.formulario_id, 'historia.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin historias clínicas</td></tr>`;

    // Justificantes
    document.getElementById('tb-justificantes').innerHTML =
      (data.justificantes||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha_emision)}</td>
          <td>${(r.procedimiento||'').slice(0,80)}${(r.procedimiento||'').length>80?'…':''}</td>
          <td>${r.dias_reposo ?? '—'}</td>
          <td>${actionBtns(r.formulario_id, 'justificante.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin justificantes</td></tr>`;

    // Odontograma final
    document.getElementById('tb-odont-final').innerHTML =
      (data.odontograma_final||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha_termino)}</td>
          <td>${r.t_count ?? 0}</td>
          <td>${r.e_count ?? 0}</td>
          <td>${actionBtns(r.formulario_id, 'odontograma.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin registros</td></tr>`;

    // Ortodoncia
    document.getElementById('tb-ortodoncia').innerHTML =
      (data.ortodoncia||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha_ingreso)}</td>
          <td>${fdate(r.fecha_alta)}</td>
          <td>${actionBtns(r.formulario_id, 'ortodoncia.html')}</td>
        </tr>`).join('') || `<tr><td colspan="3" class="text-center text-muted">Sin historia de ortodoncia</td></tr>`;

    // Botones crear nuevos
    document.getElementById('btn-nueva-evo').href        = `forms/evolucion.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nueva-receta').href     = `forms/receta.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-pres').href       = `forms/presupuesto-dental.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-co').href         = `forms/consent-odont.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-cq').href         = `forms/consent-quiro.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nueva-historia').href   = `forms/historia.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-justificante').href = `forms/justificante.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-odont').href      = `forms/odontograma.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nueva-orto').href       = `forms/ortodoncia.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-diag-infantil').href    = `forms/diag-infantil.html?paciente_id=${pacienteId}`;

    updateEvolucionButtons(pacienteId, data);

  } catch (err) {
    console.error('Error cargando perfil del paciente:', err);
    alert('❌ Error cargando perfil del paciente (ver consola).');
  }
}

// === Estudios del paciente ===
const tipoLabel = {
  rx: 'Radiografía',
  panoramica: 'Panorámica',
  tac: 'TAC',
  cbct: 'CBCT',
  foto: 'Fotografía',
  otro: 'Otro'
};

const tipoBadge = (t) => {
  const mapClass = {
    rx: 'badge bg-primary',
    panoramica: 'badge bg-info',
    tac: 'badge bg-warning text-dark',
    cbct: 'badge bg-warning text-dark',
    foto: 'badge bg-success',
    otro: 'badge bg-secondary'
  };
  const cls = mapClass[t] || mapClass.otro;
  const txt = tipoLabel[t] || tipoLabel.otro;
  return `<span class="${cls}">${txt}</span>`;
};

// Agrupa filas de patient_files por group_id (o id si no hay group_id)
function agruparEstudiosPorGrupo(rows) {
  const gruposMap = new Map();

  for (const s of rows) {
    // Usamos group_id si viene, si no, agrupamos por id (cada archivo será su propio grupo)
    const key = s.group_id || s.group || String(s.id || s.storage_path || Math.random());
    if (!gruposMap.has(key)) {
      gruposMap.set(key, { key, files: [] });
    }
    gruposMap.get(key).files.push(s);
  }

  const grupos = Array.from(gruposMap.values()).map(g => {
    // Ordenar por fecha para sacar primera/última
    g.files.sort((a, b) => {
      const ra = a.fecha_subida || a.fecha || a.creado_en || 0;
      const rb = b.fecha_subida || b.fecha || b.creado_en || 0;
      const da = ra ? new Date(ra) : new Date(0);
      const db = rb ? new Date(rb) : new Date(0);
      return da - db;
    });

    const cantidad = g.files.length;
    const primeraRaw = g.files[0]?.fecha_subida || g.files[0]?.fecha || g.files[0]?.creado_en || null;
    const ultimaRaw  = g.files[cantidad - 1]?.fecha_subida || g.files[cantidad - 1]?.fecha || g.files[cantidad - 1]?.creado_en || null;

    // nota resumen (última nota no vacía)
    const notaResumen =
      [...g.files].reverse().find(f => f.notas && String(f.notas).trim())?.notas || '';

    return {
      key: g.key,
      files: g.files,
      cantidad,
      fechaPrimera: primeraRaw,
      fechaUltima: ultimaRaw,
      notaResumen
    };
  });

  // ordenar grupos por fechaUltima desc (más recientes arriba)
  grupos.sort((a, b) => {
    const da = a.fechaUltima || a.fechaPrimera;
    const db = b.fechaUltima || b.fechaPrimera;
    const d1 = da ? new Date(da) : new Date(0);
    const d2 = db ? new Date(db) : new Date(0);
    return d2 - d1;
  });

  return grupos;
}

// ⚙️ Cargar estudios: usa lo que devuelve el backend (/studies)
async function cargarEstudios() {
  if (!pacienteId) return;

  const tbody = document.getElementById('tb-studies');
  if (!tbody) return;

  // Cabecera: Fecha | Tipo/#Archivos | Notas | Acciones
  const headRow = tbody.closest('table')?.querySelector('thead tr');
  if (headRow) {
    headRow.innerHTML = `
      <th>Fecha</th>
      <th>Tipo / #Archivos</th>
      <th>Notas</th>
      <th>Acciones</th>
    `;
  }

  try {
    const url = `/api/patients/${encodeURIComponent(pacienteId)}/studies`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} en ${url}: ${text.slice(0, 200)}...`);
    }

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Respuesta no-JSON (${ct}): ${text.slice(0, 200)}...`);
    }

    const rows = await res.json(); // ahora el backend ya regresa grupos

    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin estudios cargados</td></tr>`;
      return;
    }

    // 🔧 Normalizamos dos posibles formas:
    // 1) Nueva: [{ group_key, cantidad, fecha_primera, fecha_ultima, nota_resumen, files: [...] }]
    // 2) Vieja: filas crudas de patient_files → usamos agruparEstudiosPorGrupo
    let grupos;
    if (rows[0] && rows[0].files) {
      // ✅ Forma nueva (agrupado desde backend)
      grupos = rows.map(g => ({
        key: g.group_key || g.group_id || null,
        files: g.files || [],
        cantidad: g.cantidad ?? (g.files?.length ?? 0),
        fechaPrimera: g.fecha_primera || g.fechaPrimera || null,
        fechaUltima: g.fecha_ultima || g.fechaUltima || null,
        notaResumen: g.nota_resumen || g.notaResumen || ''
      }));
    } else {
      // 🔙 Compatibilidad con forma antigua (filas crudas)
      grupos = agruparEstudiosPorGrupo(rows);
    }

    tbody.innerHTML = grupos.map(g => {
      const files = g.files || [];
      const n = g.cantidad || files.length || 0;

      // 👇 identificador del grupo (para mandarlo al visualizador 3D)
      const groupKey = g.key || files[0]?.group_id || null;

      // --- Detectar si el grupo es 3D (CBCT/TAC con muchos DICOM) ---
      const tiposSet = new Set(
        files.map(f => f.tipo || guessTipoFromPath(f.storage_path || f.nombre_archivo || ''))
      );
      const singleTipo = tiposSet.size === 1 ? [...tiposSet][0] : null;

      // todos los archivos tienen extensión .dcm
      const allDicom = files.length > 0 && files.every(f => {
        const p = (f.storage_path || f.nombre_archivo || '').toLowerCase();
        return p.endsWith('.dcm');
      });

      // ¿Es estudio tomográfico?
      const esTomografico = singleTipo === 'tac' || singleTipo === 'cbct';

      // Regla final: tomografía + sólo DICOM + más de 1 archivo (puedes subir el umbral a 20)
      const es3D = esTomografico && allDicom && n > 1;


      // Fecha: usamos la última disponible (YYYY-MM-DD)
      const fecha = fymdSafe(g.fechaUltima || g.fechaPrimera);

      // Tipo / #Archivos
      let tipoHtml = '';
      if (n === 1) {
        const f0 = files[0] || {};
        const rawTipo = f0.tipo || guessTipoFromPath(f0.storage_path || f0.nombre_archivo);
        tipoHtml = `${tipoBadge(rawTipo)} <span class="text-muted ms-1">(1 archivo)</span>`;
      } else {
        if (tiposSet.size === 1) {
          const firstTipo = singleTipo;
          tipoHtml = `
            ${tipoBadge(firstTipo)}
            <span class="badge bg-dark ms-2">${n} archivos</span>
          `;
        } else {
          tipoHtml = `
            <span class="badge bg-secondary">Múltiples tipos</span>
            <span class="badge bg-dark ms-2">${n} archivos</span>
          `;
        }
      }


      // Notas (resumen)
      const fullNote = (g.notaResumen || '').toString();
      const shortNote = fullNote
        ? (fullNote.length > 80 ? fullNote.slice(0, 80) + '…' : fullNote)
        : '—';
      const notaCell = `<span title="${fullNote.replace(/"/g, '&quot;')}">${shortNote}</span>`;

      // Rutas de archivos para el visualizador
      const filePaths = files
        .map(f => f.storage_path || f.nombre_archivo || '')
        .filter(Boolean)
        .map(p => {
          const s = String(p);
          // normalizamos para que siempre sea algo tipo /visualizador/uploads/xxxx
          if (s.startsWith('/visualizador/uploads/')) return s;
          if (s.startsWith('/uploads/')) return '/visualizador' + s;
          if (s.startsWith('/')) return s;
          return '/visualizador/uploads/' + s;
        });

      let btnVer= '';
      let btn3D = '';
      if (!filePaths.length) {
        btnVer = `<button type="button" class="btn btn-sm btn-outline-secondary" disabled>
                    Sin archivos
                  </button>`;
      } else if (filePaths.length === 1) {
        // Un solo archivo → ?file=
        const fileParam = encodeURIComponent(filePaths[0]);
        btnVer = `<button type="button" class="btn btn-sm btn-outline-primary"
                      onclick="window.location.href='/visualizador?file=${fileParam}'">
                    👁️ Ver
                  </button>`;
      } else {
        // Varios archivos → ?files=...
        const filesParam = encodeURIComponent(filePaths.join(','));
        btnVer = `<button type="button" class="btn btn-sm btn-outline-primary"
                      onclick="window.location.href='/visualizador?files=${filesParam}'">
                    👁️ Ver
                  </button>`;
      }

      // Si es estudio tomográfico 3D, agregamos botón extra
      if (es3D && groupKey) {
        const url3d = `/visualizador?mode=3d&group=${encodeURIComponent(groupKey)}`;
        btn3D = `
          <button type="button" class="btn btn-sm btn-warning ms-1"
                  onclick="window.location.href='${url3d}'">
            🧊 3D
          </button>
        `;
      }

      return `
        <tr>
          <td>${fecha}</td>
          <td>${tipoHtml}</td>
          <td>${notaCell}</td>
          <td>${btnVer} </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error cargando estudios:', err);
    tbody.innerHTML =
      `<tr><td colspan="4" class="text-danger text-center">❌ Error al cargar estudios</td></tr>`;
  }
}





// Llamadas iniciales
document.addEventListener('DOMContentLoaded', () => {
  cargarPerfil();
  cargarEstudios();
});

// ========= Subida de estudios (frontend con modal y progreso, varios archivos) =========
(() => {
  const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB por archivo

  let uploadModal, uploadForm, fileInput, tipoSelect, notasInput, bar, status, info, submitBtn;

  function fmtBytes(b) {
    if (b == null) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  function resetProgress() {
    bar.style.width = '0%';
    bar.setAttribute('aria-valuenow', '0');
    bar.textContent = '0%';
    status.textContent = '';
  }

  function setProgress(pct) {
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    bar.style.width = `${v}%`;
    bar.setAttribute('aria-valuenow', String(v));
    bar.textContent = `${v}%`;
  }

  // ✅ validamos TODOS los archivos (solo tamaño, sin checar extensión)
  function validateFiles(files) {
    if (!files || !files.length) return 'Selecciona al menos un archivo.';
    for (const f of files) {
      if (f.size > MAX_SIZE_BYTES) {
        return `El archivo "${f.name}" excede ${fmtBytes(MAX_SIZE_BYTES)}.`;
      }
    }
    return null;
  }

  // ✅ pequeño helper para group_id (mismo para todos los archivos de una subida)
  function generarGroupId() {
    return 'grp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-subir-estudio');
    uploadForm = document.getElementById('formUploadEstudio');
    fileInput = document.getElementById('inputArchivoEstudio');
    tipoSelect = document.getElementById('selectTipoEstudio');
    notasInput = document.getElementById('inputNotasEstudio');
    bar = document.getElementById('uploadProgressBar');
    status = document.getElementById('uploadStatus');
    info = document.getElementById('fileInfo');
    submitBtn = document.getElementById('btnEnviarUpload');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        resetProgress();
        info.textContent = '';
        if (uploadForm) uploadForm.reset();
        const modalEl = document.getElementById('modalUploadEstudio');
        uploadModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        uploadModal.show();
      });
    }

    // 📂 Resumen de selección
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files || []);
        if (!files.length) {
          info.textContent = '';
          return;
        }
        const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
        info.textContent = `Archivos seleccionados: ${files.length} — Total: ${fmtBytes(totalBytes)}`;
      });
    }

    if (uploadForm) {
      uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const files = Array.from(fileInput?.files || []);
        const err = validateFiles(files);
        if (err) {
          alert('⚠️ ' + err);
          return;
        }

        // ✅ mismo group_id para TODOS los archivos en esta subida
        const groupId = generarGroupId();
        const url = `/api/patients/${encodeURIComponent(pacienteId)}/studies/upload`;

        submitBtn.disabled = true;
        status.textContent = 'Subiendo...';
        resetProgress();

        try {
          let subidos = 0;

          
          // 🔁 Enviamos CADA archivo en una petición separada
          for (const originalFile of files) {
            await new Promise((resolve, reject) => {

              let f = originalFile;
              const name = f.name || '';

              // ⬇⬇⬇ SI NO TIENE PUNTO EN EL NOMBRE → le agregamos ".dcm"
              if (!name.includes('.')) {
                const newName = name + '.dcm';
                try {
                  f = new File([f], newName, {
                    type: f.type || 'application/dicom'
                  });
                } catch (err) {
                  console.warn('No se pudo recrear File, uso el original:', err);
                  // si por alguna razón falla, seguimos con el original
                }
              }

              const fd = new FormData();
              // 👇 nombre del campo que espera Multer (NO cambiar esto)
              fd.append('file', f);
              // 👇 group_id y metadatos como campos normales
              fd.append('group_id', groupId);
              if (tipoSelect.value) fd.append('tipo', tipoSelect.value);
              if (notasInput.value) fd.append('notas', notasInput.value);

              const xhr = new XMLHttpRequest();
              xhr.open('POST', url, true);
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);

              xhr.timeout = 10 * 60 * 1000;
              
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const pct = (e.loaded / e.total) * 100;
                  setProgress(pct);
                }
              };

              xhr.onload = () => {
                // Se completó la petición
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve();
                } else {
                  // status 0 aquí suele ser timeout o conexión abortada
                  const msg = `HTTP ${xhr.status}: ${(xhr.responseText || '').slice(0, 200)}`;
                  reject(new Error(msg));
                }
              };

              xhr.onerror = () => {
                reject(new Error('Error de red al subir (onerror).'));
              };

              xhr.ontimeout = () => {
                reject(new Error('Timeout al subir (tardó demasiado en responder).'));
              };

              xhr.send(fd);
            });

            subidos++;
            const pctGlobal = (subidos / files.length) * 100;
            setProgress(pctGlobal);
          }



          status.textContent = '✅ Archivos subidos correctamente';

          setTimeout(() => {
            if (uploadModal) uploadModal.hide();
            cargarEstudios(); // recarga la tabla agrupada
          }, 600);

        } catch (err) {
          console.error('❌ Error subida:', err);
          status.textContent = '❌ Error al subir';
          alert('❌ Error al subir estudio: ' + (err.message || 'ver consola'));
        } finally {
          submitBtn.disabled = false;
        }
      });
    }
  });
})();

