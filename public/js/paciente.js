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
const fymdSafe = v => v ? String(v).split('T')[0] : '—';

const actionBtns = (formId, formHtml) => `
  <a class="btn btn-sm btn-outline-primary me-1" href="forms/${formHtml}?formulario_id=${formId}">👁️ Visualizar</a>
  <a class="btn btn-sm btn-outline-secondary me-1" href="forms/${formHtml}?formulario_id=${formId}&edit=1">✏️ Editar</a>
  <button class="btn btn-sm btn-outline-success" data-form="${formId}">📤 Enviar</button>
`;

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
      (data.evoluciones||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha)}</td>
          <td>${r.descripcion || '—'}</td>
          <td>${r.doctor || '—'}</td>
          <td>${actionBtns(r.formulario_id, 'evolucion.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin evoluciones</td></tr>`;

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
const fmtSize = (b) => (b == null ? '—' :
  (b < 1024 ? `${b} B` :
  (b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`)));

// ⚙️ Cargar estudios: ahora con fecha YYYY-MM-DD y columna "Notas"
async function cargarEstudios() {
  if (!pacienteId) return;

  const tbody = document.getElementById('tb-studies');
  if (!tbody) return;

  // Asegurar cabecera con columna "Notas"
  const headRow = tbody.closest('table')?.querySelector('thead tr');
  if (headRow) {
    headRow.innerHTML = `
      <th>Fecha</th>
      <th>Tipo</th>
      <th>Archivo</th>
      <th>Tamaño</th>
      <th>Notas</th>
      <th>Acciones</th>
    `;
  }

  try {
    const url = `/api/patients/${encodeURIComponent(pacienteId)}/studies`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} en ${url}: ${text.slice(0,200)}...`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Respuesta no-JSON (${ct}): ${text.slice(0,200)}...`);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin estudios cargados</td></tr>`;
      return;
    }

    const normalizePath = (p) => {
      if (!p) return '';
      if (p.startsWith('/visualizador/uploads/')) return p;
      if (p.startsWith('/uploads/')) return `/visualizador${p}`;
      return `/visualizador/uploads/${p}`;
    };

    const buildVerUrl = (storagePath) =>
      `/visualizador?file=${encodeURIComponent(normalizePath(storagePath))}`;
    const buildDescargaUrl = (storagePath) => normalizePath(storagePath);

    tbody.innerHTML = rows.map(s => {
      // ✅ sólo fecha (YYYY-MM-DD) usando helper
      const fecha = fymdSafe(s.fecha_subida);
      const nombre = s.nombre_archivo || s.storage_path || '—';
      const verUrl = buildVerUrl(s.storage_path);
      const downUrl = buildDescargaUrl(s.storage_path);

      // ✅ Columna "Notas" con tooltip si es largo
      const notasFull = (s.notas ?? '').toString();
      const notasShort = notasFull.length > 80 ? notasFull.slice(0, 80) + '…' : (notasFull || '—');

      return `
        <tr>
          <td>${fecha}</td>
          <td>${tipoBadge(s.tipo)}</td>
          <td title="${s.storage_path || ''}">${nombre}</td>
          <td>${fmtSize(s.size_bytes)}</td>
          <td title="${notasFull.replace(/"/g,'&quot;')}">${notasShort}</td>
          <td>
            <a class="btn btn-sm btn-outline-primary me-1" href="${verUrl}" target="_blank" rel="noopener">👁️ Ver</a>
            <a class="btn btn-sm btn-outline-secondary" href="${downUrl}" download>⬇️ Descargar</a>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error cargando estudios:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">❌ Error al cargar estudios</td></tr>`;
  }
}

// Llamadas iniciales
document.addEventListener('DOMContentLoaded', () => {
  cargarPerfil();
  cargarEstudios();
});

// ========= Subida de estudios (frontend con modal y progreso) =========
(() => {
  const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
  const ALLOWED_EXT = ['.png','.jpg','.jpeg','.webp','.bmp','.tif','.tiff','.gif','.dcm'];

  let uploadModal, uploadForm, fileInput, tipoSelect, notasInput, bar, status, info, submitBtn;

  function extLower(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
  }
  function fmtBytes(b) {
    if (b == null) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024*1024) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1024/1024).toFixed(2)} MB`;
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
  function validateFile(file) {
    if (!file) return 'Selecciona un archivo.';
    if (file.size > MAX_SIZE_BYTES) return `El archivo excede ${fmtBytes(MAX_SIZE_BYTES)}.`;
    const ext = extLower(file.name || '');
    if (!ALLOWED_EXT.includes(ext)) {
      return `Extensión no permitida. Usa: ${ALLOWED_EXT.join(', ')}`;
    }
    return null;
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
        uploadForm.reset();
        const modalEl = document.getElementById('modalUploadEstudio');
        uploadModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        uploadModal.show();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const f = fileInput.files?.[0];
        if (!f) { info.textContent = ''; return; }
        info.textContent = `Archivo: ${f.name} — ${fmtBytes(f.size)}`;
        // Pre-selección básica
        const name = f.name.toLowerCase();
        if (name.endsWith('.dcm')) tipoSelect.value = 'otro';
        else if (!tipoSelect.value) tipoSelect.value = 'foto';
      });
    }

    if (uploadForm) {
      uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const f = fileInput.files?.[0];
        const err = validateFile(f);
        if (err) {
          alert('⚠️ ' + err);
          return;
        }

        const fd = new FormData();
        fd.append('file', f);
        if (tipoSelect.value) fd.append('tipo', tipoSelect.value);
        if (notasInput.value) fd.append('notas', notasInput.value);

        const url = `/api/patients/${encodeURIComponent(pacienteId)}/studies/upload`;

        submitBtn.disabled = true;
        status.textContent = 'Subiendo...';

        try {
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = (e.loaded / e.total) * 100;
                setProgress(pct);
              }
            };

            xhr.onreadystatechange = () => {
              if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve();
                } else {
                  reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText?.slice(0,200) || ''}`));
                }
              }
            };

            xhr.onerror = () => reject(new Error('Error de red al subir.'));
            xhr.send(fd);
          });

          status.textContent = '✅ Subida exitosa';
          setProgress(100);

          setTimeout(() => {
            if (uploadModal) uploadModal.hide();
            cargarEstudios();
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
