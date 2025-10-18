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

    document.getElementById('tb-recetas').innerHTML =
      (data.recetas||[]).map(r => `
        <tr>
          <td>${fdate(r.fecha)}</td>
          <td>${r.medicamento || '—'}</td>
          <td>${r.indicaciones || '—'}</td>
          <td>${actionBtns(r.formulario_id, 'receta.html')}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin recetas</td></tr>`;

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

    // Botones "nuevo …" (requieren tener /public/forms/*.html; si no, comenta)
    document.getElementById('btn-nueva-evo').href  = `forms/evolucion.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nueva-receta').href = `forms/receta.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-pres').href   = `forms/presupuesto-dental.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-co').href     = `forms/consent-odont.html?paciente_id=${pacienteId}`;
    document.getElementById('btn-nuevo-cq').href     = `forms/consent-quiro.html?paciente_id=${pacienteId}`;

  } catch (err) {
    console.error('Error cargando perfil del paciente:', err);
    alert('❌ Error cargando perfil del paciente (ver consola).');
  }
}

// === Cuarto: ejecutar tras cargar el DOM ===
document.addEventListener('DOMContentLoaded', cargarPerfil);
