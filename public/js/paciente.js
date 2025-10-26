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

    // Manejo explícito de errores (evita intentar parsear HTML como JSON)
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

    

    // Si el servicio aún no tiene datos, asegúrate de siempre tener el shape
    const p = data.paciente || {};


    // Normaliza el sexo para mostrar texto completo
    const sexoTexto = p.sexo
      ? (p.sexo.toUpperCase() === 'F' ? 'Femenina'
        : p.sexo.toUpperCase() === 'M' ? 'Masculino'
        : p.sexo)  // en caso de valores no esperados, muestra tal cual
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

    // Tablas (con fallback a arrays vacíos)
    document.getElementById('tb-evoluciones').innerHTML =
      (data.evoluciones||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha)}</td>
          <td>${r.descripcion || '—'}</td>
          <td>${r.doctor || '—'}</td>
          <td>${actionBtns(r.formulario_id, 'evolucion.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin evoluciones</td></tr>`;

    // 💊 Recetas (general)
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


    document.getElementById('tb-presupuestos').innerHTML =
      (data.presupuestos||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha)}</td>
          <td>${r.tratamiento || '—'}</td>
          <td>${money(r.costo)}</td>
          <td>${actionBtns(r.formulario_id, 'presupuesto-dental.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin presupuestos</td></tr>`;

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

    document.getElementById('tb-historia').innerHTML =
      (data.historia_clinica||[]).map(r => `
        <tr>
          <td>${r.formulario_id}</td>
          <td>${r.nombre_paciente ?? '—'}</td>
          <td>${fdate(r.creado_en)}</td>
          <td>${actionBtns(r.formulario_id, 'historia.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin historias clínicas</td></tr>`;

    document.getElementById('tb-justificantes').innerHTML =
      (data.justificantes||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha_emision)}</td>
          <td>${(r.procedimiento||'').slice(0,80)}${(r.procedimiento||'').length>80?'…':''}</td>
          <td>${r.dias_reposo ?? '—'}</td>
          <td>${actionBtns(r.formulario_id, 'justificante.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin justificantes</td></tr>`;

    document.getElementById('tb-odont-final').innerHTML =
      (data.odontograma_final||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha_termino)}</td>
          <td>${r.t_count ?? 0}</td>
          <td>${r.e_count ?? 0}</td>
          <td>${actionBtns(r.formulario_id, 'odontograma.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin registros</td></tr>`;

    document.getElementById('tb-ortodoncia').innerHTML =
      (data.ortodoncia||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha_ingreso)}</td>
          <td>${fdate(r.fecha_alta)}</td>
          <td>${actionBtns(r.formulario_id, 'ortodoncia.html')}</td>
        </tr>`).join('') || `<tr><td colspan="3" class="text-center text-muted">Sin historia de ortodoncia</td></tr>`;

   // Botones 
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

async function cargarEstudios() {
  if (!pacienteId) return;

  const tbody = document.getElementById('tb-studies');
  if (!tbody) return;

  try {
    const url = `/api/patients/${encodeURIComponent(pacienteId)}/studies`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });

    // Asegura JSON (evita parsear HTML de error)
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} en ${url}: ${text.slice(0,200)}...`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Respuesta no-JSON (${ct}): ${text.slice(0,200)}...`);
    }

    const rows = await res.json(); // array o []
    if (!Array.isArray(rows) || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin estudios cargados</td></tr>`;
      return;
    }

    // IMPORTANTE:
    // - visualizador-service está expuesto por el gateway en /visualizador
    // - archivos estáticos en /uploads (ya mapeado en tu gateway)
    // Cambia el nombre del query param si tu viewer espera otro (ej: ?path=)
    const buildVerUrl = (storagePath) =>
      `/visualizador?file=${encodeURIComponent(storagePath)}`;
    const buildDescargaUrl = (storagePath) => storagePath; // normalmente /uploads/...

    tbody.innerHTML = rows.map(s => {
      const fecha = s.fecha_subida ? new Date(s.fecha_subida).toLocaleString() : '—';
      const nombre = s.nombre_archivo || s.storage_path || '—';
      const verUrl = buildVerUrl(s.storage_path);
      const downUrl = buildDescargaUrl(s.storage_path);
      return `
        <tr>
          <td>${fecha}</td>
          <td>${tipoBadge(s.tipo)}</td>
          <td title="${s.storage_path || ''}">${nombre}</td>
          <td>${fmtSize(s.size_bytes)}</td>
          <td>
            <a class="btn btn-sm btn-outline-primary me-1" href="${verUrl}" target="_blank" rel="noopener">👁️ Ver</a>
            <a class="btn btn-sm btn-outline-secondary" href="${downUrl}" download>⬇️ Descargar</a>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error cargando estudios:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">❌ Error al cargar estudios</td></tr>`;
  }
}

// Llamar también a cargarEstudios junto con cargarPerfil
document.addEventListener('DOMContentLoaded', () => {
  // si ya tenías: document.addEventListener('DOMContentLoaded', cargarPerfil);
  // cambia a:
  cargarPerfil();
  cargarEstudios();
});



