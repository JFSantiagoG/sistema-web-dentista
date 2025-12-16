/* ===========================================================
   ✅ paciente.js (CORREGIDO + NOTIFICACIONES BONITAS)
   - Evita perder ?id=
   - Modal editar paciente sin navegación
   - Listeners robustos (capturing)
   - Toasts bonitos (SweetAlert2)
   =========================================================== */

(() => {
  // === Primero: token/roles y guardas ===
  const token = localStorage.getItem('token');
  const roles = JSON.parse(localStorage.getItem('roles') || '[]');
  if (!token || roles.length === 0) {
    location.href = '/login.html';
    return;
  }
  const rol = (roles[0] || '').toLowerCase();

  const esDoctor = rol === 'doctor';
  const esAdmin  = rol === 'admin';

  /* ===========================================================
     ✅ SWEETALERT2 "bonito"
     =========================================================== */
  const hasSwal = typeof Swal !== 'undefined';

  // Toast mixin (estilo "app")
  const Toast = hasSwal
    ? Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        showCloseButton: true,
        timer: 2200,
        timerProgressBar: true,
        backdrop: false,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        },
        // animaciones suaves
        showClass: { popup: 'swal2-show' },
        hideClass: { popup: 'swal2-hide' }
      })
    : null;

  function toastOk(msg) {
    if (!hasSwal) return alert(msg);
    return Toast.fire({ icon: 'success', title: msg });
  }
  function toastInfo(msg) {
    if (!hasSwal) return alert(msg);
    return Toast.fire({ icon: 'info', title: msg });
  }
  function toastWarn(msg) {
    if (!hasSwal) return alert(msg);
    return Toast.fire({ icon: 'warning', title: msg, timer: 2600 });
  }
  function toastErr(msg) {
    if (!hasSwal) return alert(msg);
    return Toast.fire({ icon: 'error', title: msg, timer: 3200 });
  }

  async function confirmSwal({
    title = '¿Confirmar?',
    text = '',
    confirmText = 'Sí',
    cancelText = 'Cancelar',
    icon = 'warning'
  } = {}) {
    if (!hasSwal) return confirm(`${title}\n${text}`.trim());

    const r = await Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
      focusCancel: true,
      buttonsStyling: true
    });
    return !!r.isConfirmed;
  }

  function showLoading(title = 'Procesando...', text = 'Espera un momento') {
    if (!hasSwal) return;
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });
  }

  function closeLoading() {
    if (!hasSwal) return;
    Swal.close();
  }

  /* ===========================================================
     ✅ PacienteId BLINDADO
     =========================================================== */
  function getPacienteIdFromUrl() {
    return new URLSearchParams(location.search).get('id')
      || new URLSearchParams(location.search).get('paciente_id');
  }

  let pacienteId = getPacienteIdFromUrl();

  // guarda respaldo
  if (pacienteId) sessionStorage.setItem('paciente_id_last', pacienteId);
  if (!pacienteId) pacienteId = sessionStorage.getItem('paciente_id_last');

  function ensurePacienteIdInUrl() {
    const current = getPacienteIdFromUrl();
    if (current) return;
    if (pacienteId) {
      history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(pacienteId)}`);
    }
  }

  ensurePacienteIdInUrl();

  /* ===========================================================
     ✅ Oculta SOLO botones de "crear" si NO es doctor
     =========================================================== */
  function ocultarBotonesCrearPorRol() {
    const createBtnIds = [
      'btn-subir-estudio',
      'btn-nueva-evo',
      'btn-nueva-receta',
      'btn-nuevo-pres',
      'btn-nuevo-co',
      'btn-nuevo-cq',
      'btn-nueva-historia',
      'btn-nuevo-justificante',
      'btn-nuevo-odont',
      'btn-nueva-orto',
      'btn-diag-infantil'
    ];

    if (!esDoctor) {
      createBtnIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
  }

  /* ===========================================================
     ✅ Utilidades para formateo
     =========================================================== */
  const fdate = d => d ? new Date(d).toLocaleDateString() : '—';
  const yesno = v => (Number(v) ? 'Sí' : 'No');
  const fymdSafe = v => {
    if (!v) return '—';
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  };

  function guessTipoFromPath(path) {
    if (!path) return 'otro';
    const p = String(path).toLowerCase();

    if (p.endsWith('.dcm')) return 'rx';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg') ||
        p.endsWith('.png') || p.endsWith('.webp') ||
        p.endsWith('.gif')) return 'foto';
    if (p.endsWith('.bmp') || p.includes('pano')) return 'panoramica';

    return 'otro';
  }

  /* ===========================================================
     ✅ ACCIONES (Visualizar/Enviar + Eliminar SOLO admin)
     =========================================================== */
  const actionBtns = (formId, formHtml) => `
    <a class="btn btn-sm btn-outline-primary me-1" href="forms/${formHtml}?formulario_id=${formId}">👁️ Visualizar</a>
    <button type="button" class="btn btn-sm btn-outline-success me-1" data-action="send-form" data-form-id="${formId}">📤 Enviar</button>
    ${esAdmin ? `
      <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-form" data-form-id="${formId}">
        🗑️ Eliminar
      </button>
    ` : ''}
  `;

  document.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-action="delete-form"]');
    if (delBtn) {
      if (!esAdmin) return;

      const formId = delBtn.getAttribute('data-form-id');
      if (!formId) return;

      const ok = await confirmSwal({
        title: '¿Eliminar formulario?',
        text: 'Esta acción no se puede deshacer.',
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        icon: 'warning'
      });
      if (!ok) return toastInfo('Cancelado');

      const oldTxt = delBtn.textContent;
      delBtn.disabled = true;
      delBtn.textContent = '⏳ Eliminando...';

      try {
        const DELETE_URL = `/api/patients/forms/${encodeURIComponent(formId)}`;
        showLoading('Eliminando...', 'Espera un momento');

        const r = await fetch(DELETE_URL, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        });

        if (!r.ok) {
          const t = await r.text();
          throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
        }

        closeLoading();
        await toastOk('✅ Formulario eliminado');
        await cargarPerfil();
      } catch (err) {
        closeLoading();
        console.error(err);
        toastErr('❌ Error al eliminar');
      } finally {
        delBtn.disabled = false;
        delBtn.textContent = oldTxt;
      }
      return;
    }

    const sendBtn = e.target.closest('[data-action="send-form"]');
    if (sendBtn) {
      const formId = sendBtn.getAttribute('data-form-id');
      if (!formId) return;
      toastInfo(`📤 Enviar formulario #${formId} (pendiente integrar)`);
      return;
    }
  });

  function updateEvolucionButtons(pid, data) {
    const btnCrear = document.getElementById('btn-nueva-evo');
    if (!btnCrear) return;

    const evoluciones = data?.evoluciones || data?.evolucion || [];
    const evo = evoluciones[0] || null;
    const evoFormId = evo?.formulario_id ?? evo?.id ?? null;

    if (evoFormId) {
      btnCrear.classList.add('disabled');
      btnCrear.removeAttribute('href');
      btnCrear.title = 'Ya existe una evolución. Solo puedes agregar nuevas entradas.';
    } else {
      btnCrear.classList.remove('disabled');
      btnCrear.href = `forms/evolucion.html?paciente_id=${pid}`;
      btnCrear.title = '';
    }
  }

  /* ===========================================================
     ✅ EDITAR PACIENTE (modal)
     =========================================================== */
  let modalEditarPaciente = null;
  let lastPacienteSnapshot = null;

  function getModalInstance() {
    const el = document.getElementById('modalEditarPaciente');
    if (!el) return null;
    if (typeof bootstrap === 'undefined') return null;
    return bootstrap.Modal.getOrCreateInstance(el);
  }

  function wireEditarPaciente(paciente) {
    lastPacienteSnapshot = paciente || {};

    const btn = document.getElementById('btn-editar-paciente');
    if (!btn) return;

    btn.setAttribute('type', 'button');

    btn.onclick = () => {
      ensurePacienteIdInUrl();
      if (!lastPacienteSnapshot?.id) return toastErr('❌ No se pudo cargar paciente');
      abrirModalEditarPaciente(lastPacienteSnapshot);
    };
  }

  function abrirModalEditarPaciente(p) {
    try {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val ?? '');
      };

      setVal('edit-id', p.id ?? pacienteId ?? '');
      setVal('edit-nombre', p.nombre ?? '');
      setVal('edit-apellido', p.apellido ?? '');
      setVal('edit-email', p.email ?? '');
      setVal('edit-tel1', p.telefono_principal ?? '');
      setVal('edit-tel2', p.telefono_secundario ?? '');
      setVal('edit-sexo', p.sexo ?? '');
      setVal('edit-edad', (p.edad ?? '') === null ? '' : (p.edad ?? ''));

      modalEditarPaciente = getModalInstance();
      if (!modalEditarPaciente) return toastErr('❌ No existe el modal de editar (Bootstrap no cargó o falta el modal)');
      modalEditarPaciente.show();
    } catch (e) {
      console.error(e);
      toastErr('❌ No se pudo abrir el editor');
    }
  }

  function bindEditarPacienteSubmit() {
    const form = document.getElementById('formEditarPaciente');
    if (!form) return;

    form.setAttribute('action', '#');
    form.setAttribute('method', 'post');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      ensurePacienteIdInUrl();

      const id = (document.getElementById('edit-id')?.value || pacienteId || '').trim();
      if (!id) return toastErr('❌ Falta id del paciente');

      const payload = {
        nombre: (document.getElementById('edit-nombre')?.value || '').trim(),
        apellido: (document.getElementById('edit-apellido')?.value || '').trim(),
        email: ((document.getElementById('edit-email')?.value || '').trim() || null),
        telefono_principal: ((document.getElementById('edit-tel1')?.value || '').trim() || null),
        telefono_secundario: ((document.getElementById('edit-tel2')?.value || '').trim() || null),
        sexo: (document.getElementById('edit-sexo')?.value || null),
        edad: (document.getElementById('edit-edad')?.value ? Number(document.getElementById('edit-edad').value) : null)
      };

      if (!payload.nombre || !payload.apellido) return toastWarn('⚠️ Nombre y apellido son obligatorios');
      if (payload.edad != null && (Number.isNaN(payload.edad) || payload.edad < 0)) return toastWarn('⚠️ Edad inválida');

      const ok = await confirmSwal({
        title: 'Guardar cambios',
        text: 'Se actualizarán los datos del paciente.',
        confirmText: 'Guardar',
        cancelText: 'Cancelar',
        icon: 'question'
      });
      if (!ok) return toastInfo('Cancelado');

      try {
        showLoading('Guardando...', 'Actualizando datos del paciente');

        const url = `/api/patients/${encodeURIComponent(id)}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
        }

        closeLoading();

        modalEditarPaciente = getModalInstance();
        modalEditarPaciente?.hide();

        toastOk('✅ Paciente actualizado');

        history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(pacienteId || id)}`);
        await cargarPerfil();
      } catch (err) {
        closeLoading();
        console.error(err);
        toastErr('❌ No se pudo actualizar');
      }
    }, true);
  }

  /* ===========================================================
     ✅ CARGAR PERFIL
     =========================================================== */
  async function cargarPerfil() {
    ensurePacienteIdInUrl();

    if (!pacienteId) {
      const perfilEl = document.getElementById('perfil');
      if (perfilEl) perfilEl.innerHTML = `<p class="text-danger">❌ No se proporcionó el ID del paciente.</p>`;
      else toastErr('❌ No se proporcionó el ID del paciente.');
      return;
    }

    try {
      const url = `/api/patients/${encodeURIComponent(pacienteId)}/forms`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
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

      const p = data.paciente || {};
      wireEditarPaciente({ ...p, id: p.id ?? pacienteId });

      const sexoTexto = p.sexo
        ? (String(p.sexo).toUpperCase() === 'F' ? 'Femenina'
          : String(p.sexo).toUpperCase() === 'M' ? 'Masculino'
          : p.sexo)
        : '—';

      const tarjeta = document.getElementById('tarjetaPaciente');
      if (tarjeta) {
        tarjeta.innerHTML = `
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
      }

      const setTbody = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
      };

      setTbody('tb-evoluciones',
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
              <td>${agregarBtn}${actionBtns(formId, 'evolucion.html')}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin evoluciones</td></tr>`
      );

      setTbody('tb-recetas',
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
        `).join('') || `<tr><td colspan="5" class="text-center text-muted">Sin recetas</td></tr>`
      );

      // Presupuestos
      (() => {
        const rows = Array.isArray(data.presupuestos) ? data.presupuestos : [];
        const tbody = document.getElementById('tb-presupuestos');
        const thead = document.querySelector('#tb-presupuestos')?.closest('table')?.querySelector('thead tr');
        if (!tbody || !thead) return;

        if (rows.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin presupuestos</td></tr>`;
          return;
        }

        const useNewShape = rows.some(r => ('total' in r) || ('total_mensual' in r) || ('meses' in r));
        if (useNewShape) {
          thead.innerHTML = `<th>Fecha</th><th>Total</th><th>Mensualidad</th><th>Acciones</th>`;
          tbody.innerHTML = rows.map(r => {
            const fecha   = fymdSafe(r.fecha || r.creado_en);
            const total   = (r.total != null) ? `$${Number(r.total).toFixed(2)}` : '—';
            const mensual = (r.total_mensual != null)
              ? `$${Number(r.total_mensual).toFixed(2)}${r.meses ? ` / ${r.meses} mes(es)` : ''}`
              : '—';
            return `<tr><td>${fecha}</td><td>${total}</td><td>${mensual}</td><td>${actionBtns(r.formulario_id, 'presupuesto-dental.html')}</td></tr>`;
          }).join('');
        } else {
          thead.innerHTML = `<th>Fecha</th><th>Tratamiento</th><th>Costo</th><th>Acciones</th>`;
          tbody.innerHTML = rows.map(r => {
            const fecha = fymdSafe(r.fecha || r.creado_en);
            const trat  = r.tratamiento || '—';
            const costo = (r.costo != null) ? `$${Number(r.costo).toFixed(2)}` : '—';
            return `<tr><td>${fecha}</td><td>${trat}</td><td>${costo}</td><td>${actionBtns(r.formulario_id, 'presupuesto-dental.html')}</td></tr>`;
          }).join('');
        }
      })();

      // Diagnóstico infantil
      (() => {
        const tbody = document.getElementById('tb-diag-infantil');
        if (!tbody) return;

        const theadRow = tbody.closest('table')?.querySelector('thead tr');
        if (theadRow) theadRow.innerHTML = `<th>Fecha</th><th>Tratamiento</th><th>Costo</th><th>Acciones</th>`;

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
          const total  = (r.total_costo != null) ? Number(r.total_costo) : (r.total != null) ? Number(r.total) : 0;
          const trat   = `${r.t_count ?? 0} dientes + ${r.g_count ?? 0} generales`;
          return `<tr><td>${fecha}</td><td>${trat}</td><td>$${total.toFixed(2)}</td><td>${actionBtns(formId, 'diag-infantil.html')}</td></tr>`;
        }).join('');
      })();

      setTbody('tb-consent-odont',
        (data.consentimiento_odontologico || []).map(r => `
          <tr>
            <td>${fdate(r.fecha)}</td>
            <td>${(r.procedimiento||'').slice(0,80)}${(r.procedimiento||'').length>80?'…':''}</td>
            <td>${yesno(r.firmado)}</td>
            <td>${actionBtns(r.formulario_id, 'consent-odont.html')}</td>
          </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin consentimientos</td></tr>`
      );

      setTbody('tb-consent-quiro',
        (data.consentimiento_quirurgico || []).map(r => `
          <tr>
            <td>${fdate(r.fecha)}</td>
            <td>${(r.intervencion||'').slice(0,80)}${(r.intervencion||'').length>80?'…':''}</td>
            <td>${yesno(r.firmado)}</td>
            <td>${actionBtns(r.formulario_id, 'consent-quiro.html')}</td>
          </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin consentimientos</td></tr>`
      );

      setTbody('tb-historia',
        (data.historia_clinica || []).map(r => `
          <tr>
            <td>${r.formulario_id}</td>
            <td>${r.nombre_paciente ?? '—'}</td>
            <td>${fdate(r.creado_en)}</td>
            <td>${actionBtns(r.formulario_id, 'historia.html')}</td>
          </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin historias clínicas</td></tr>`
      );

      setTbody('tb-justificantes',
        (data.justificantes || []).map(r => `
          <tr>
            <td>${fdate(r.fecha_emision)}</td>
            <td>${(r.procedimiento||'').slice(0,80)}${(r.procedimiento||'').length>80?'…':''}</td>
            <td>${r.dias_reposo ?? '—'}</td>
            <td>${actionBtns(r.formulario_id, 'justificante.html')}</td>
          </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin justificantes</td></tr>`
      );

      setTbody('tb-odont-final',
        (data.odontograma_final || []).map(r => `
          <tr>
            <td>${fdate(r.fecha_termino)}</td>
            <td>${r.t_count ?? 0}</td>
            <td>${r.e_count ?? 0}</td>
            <td>${actionBtns(r.formulario_id, 'odontograma.html')}</td>
          </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Sin registros</td></tr>`
      );

      setTbody('tb-ortodoncia',
        (data.ortodoncia || []).map(r => `
          <tr>
            <td>${fdate(r.fecha_ingreso)}</td>
            <td>${fdate(r.fecha_alta)}</td>
            <td>${actionBtns(r.formulario_id, 'ortodoncia.html')}</td>
          </tr>`).join('') || `<tr><td colspan="3" class="text-center text-muted">Sin historia de ortodoncia</td></tr>`
      );

      const safeSetHref = (id, href) => {
        const el = document.getElementById(id);
        if (el) el.href = href;
      };

      safeSetHref('btn-nueva-evo',          `forms/evolucion.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nueva-receta',       `forms/receta.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nuevo-pres',         `forms/presupuesto-dental.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nuevo-co',           `forms/consent-odont.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nuevo-cq',           `forms/consent-quiro.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nueva-historia',     `forms/historia.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nuevo-justificante', `forms/justificante.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nuevo-odont',        `forms/odontograma.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-nueva-orto',         `forms/ortodoncia.html?paciente_id=${pacienteId}`);
      safeSetHref('btn-diag-infantil',      `forms/diag-infantil.html?paciente_id=${pacienteId}`);

      updateEvolucionButtons(pacienteId, data);
    } catch (err) {
      console.error('Error cargando perfil del paciente:', err);
      toastErr('❌ Error cargando perfil del paciente (ver consola).');
    }
  }

  /* ===========================================================
     ✅ Estudios del paciente
     =========================================================== */
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

  function agruparEstudiosPorGrupo(rows) {
    const gruposMap = new Map();

    for (const s of rows) {
      const key = s.group_id || s.group || String(s.id || s.storage_path || Math.random());
      if (!gruposMap.has(key)) gruposMap.set(key, { key, files: [] });
      gruposMap.get(key).files.push(s);
    }

    const grupos = Array.from(gruposMap.values()).map(g => {
      g.files.sort((a, b) => {
        const ra = a.fecha_subida || a.fecha || a.creado_en || 0;
        const rb = b.fecha_subida || b.fecha || b.creado_en || 0;
        return (ra ? new Date(ra) : new Date(0)) - (rb ? new Date(rb) : new Date(0));
      });

      const cantidad = g.files.length;
      const primeraRaw = g.files[0]?.fecha_subida || g.files[0]?.fecha || g.files[0]?.creado_en || null;
      const ultimaRaw  = g.files[cantidad - 1]?.fecha_subida || g.files[cantidad - 1]?.fecha || g.files[cantidad - 1]?.creado_en || null;

      const notaResumen = [...g.files].reverse().find(f => f.notas && String(f.notas).trim())?.notas || '';

      return { key: g.key, files: g.files, cantidad, fechaPrimera: primeraRaw, fechaUltima: ultimaRaw, notaResumen };
    });

    grupos.sort((a, b) => {
      const da = a.fechaUltima || a.fechaPrimera;
      const db = b.fechaUltima || b.fechaPrimera;
      return (db ? new Date(db) : new Date(0)) - (da ? new Date(da) : new Date(0));
    });

    return grupos;
  }

  async function cargarEstudios() {
    ensurePacienteIdInUrl();
    if (!pacienteId) return;

    const tbody = document.getElementById('tb-studies');
    if (!tbody) return;

    const headRow = tbody.closest('table')?.querySelector('thead tr');
    if (headRow) headRow.innerHTML = `<th>Fecha</th><th>Tipo / #Archivos</th><th>Notas</th><th>Acciones</th>`;

    try {
      const url = `/api/patients/${encodeURIComponent(pacienteId)}/studies`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
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

      const rows = await res.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin estudios cargados</td></tr>`;
        return;
      }

      const grupos = (rows[0] && rows[0].files)
        ? rows.map(g => ({
            key: g.group_key || g.group_id || null,
            files: g.files || [],
            cantidad: g.cantidad ?? (g.files?.length ?? 0),
            fechaPrimera: g.fecha_primera || g.fechaPrimera || null,
            fechaUltima: g.fecha_ultima || g.fechaUltima || null,
            notaResumen: g.nota_resumen || g.notaResumen || ''
          }))
        : agruparEstudiosPorGrupo(rows);

      tbody.innerHTML = grupos.map(g => {
        const files = g.files || [];
        const n = g.cantidad || files.length || 0;

        const tiposSet = new Set(files.map(f => f.tipo || guessTipoFromPath(f.storage_path || f.nombre_archivo || '')));
        const singleTipo = tiposSet.size === 1 ? [...tiposSet][0] : null;

        const fecha = fymdSafe(g.fechaUltima || g.fechaPrimera);

        let tipoHtml = '';
        if (n === 1) {
          const f0 = files[0] || {};
          const rawTipo = f0.tipo || guessTipoFromPath(f0.storage_path || f0.nombre_archivo);
          tipoHtml = `${tipoBadge(rawTipo)} <span class="text-muted ms-1">(1 archivo)</span>`;
        } else {
          tipoHtml = (tiposSet.size === 1)
            ? `${tipoBadge(singleTipo)} <span class="badge bg-dark ms-2">${n} archivos</span>`
            : `<span class="badge bg-secondary">Múltiples tipos</span> <span class="badge bg-dark ms-2">${n} archivos</span>`;
        }

        const fullNote = (g.notaResumen || '').toString();
        const shortNote = fullNote ? (fullNote.length > 80 ? fullNote.slice(0, 80) + '…' : fullNote) : '—';
        const notaCell = `<span title="${fullNote.replace(/"/g, '&quot;')}">${shortNote}</span>`;

        const groupId = g.key || files[0]?.group_id || files[0]?.group || null;

        const btnVer = groupId
          ? `<a class="btn btn-sm btn-outline-primary" href="/visualizador?paciente=${encodeURIComponent(pacienteId)}&group=${encodeURIComponent(groupId)}" rel="noopener">👁️ Ver</a>`
          : `<button type="button" class="btn btn-sm btn-outline-secondary" disabled>Sin grupo</button>`;

        return `<tr><td>${fecha}</td><td>${tipoHtml}</td><td>${notaCell}</td><td>${btnVer}</td></tr>`;
      }).join('');
    } catch (err) {
      console.error('Error cargando estudios:', err);
      toastErr('❌ Error al cargar estudios (ver consola).');
      tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">❌ Error al cargar estudios</td></tr>`;
    }
  }

  /* ===========================================================
     ✅ Colapsar tablas
     =========================================================== */
  function applyTbodyCollapse(tbodySelector, maxRows = 5) {
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= maxRows) return;

    const toggleBtn = document.querySelector(`.table-toggle[data-tbody="${tbodySelector}"]`);
    if (!toggleBtn) return;

    let expanded = false;

    function update() {
      rows.forEach((row, idx) => {
        row.style.display = (!expanded && idx >= maxRows) ? 'none' : '';
      });
      toggleBtn.textContent = expanded ? '▲ Ver menos' : '▼ Ver todo';
    }

    toggleBtn.style.display = 'inline-block';
    toggleBtn.addEventListener('click', () => { expanded = !expanded; update(); });
    update();
  }

  /* ===========================================================
     ✅ ZIP historial
     =========================================================== */
  function bindHistorialZip() {
    document.getElementById('btn-crear-historial')?.addEventListener('click', async () => {
      ensurePacienteIdInUrl();

      const pid = getPacienteIdFromUrl() || pacienteId;
      if (!pid) return toastErr('No se encontró paciente_id en la URL');

      const ok = await confirmSwal({
        title: 'Crear historial médico',
        text: 'Se generará un ZIP con PDFs y estudios.',
        confirmText: 'Sí, generar',
        cancelText: 'Cancelar',
        icon: 'question'
      });
      if (!ok) return toastInfo('Cancelado');

      const btn = document.getElementById('btn-crear-historial');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Generando...';
      }

      try {
        const url = `/api/patients/${encodeURIComponent(pid)}/historial/zip`;
        showLoading('Generando ZIP...', 'Esto puede tardar un poco');

        const r = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const blob = await r.blob();

        let filename = `historial_medico_${pid}.zip`;
        const dispo = r.headers.get('Content-Disposition') || '';
        const m = dispo.match(/filename="(.+?)"/);
        if (m?.[1]) filename = m[1];

        const a = document.createElement('a');
        const href = URL.createObjectURL(blob);
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);

        closeLoading();
        toastOk('✅ Historial médico generado. Descarga iniciada.');
      } catch (e) {
        closeLoading();
        console.error(e);
        toastErr('❌ Error generando historial médico');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '📋 Crear historial médico';
        }
      }
    });
  }

  /* ===========================================================
     ✅ INIT
     =========================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    ensurePacienteIdInUrl();
    ocultarBotonesCrearPorRol();

    bindEditarPacienteSubmit();
    bindHistorialZip();

    await cargarPerfil();
    await cargarEstudios();

    applyTbodyCollapse('#tb-studies', 5);
    applyTbodyCollapse('#tb-evoluciones', 5);
    applyTbodyCollapse('#tb-recetas', 5);
    applyTbodyCollapse('#tb-presupuestos', 5);
    applyTbodyCollapse('#tb-consent-odont', 5);
    applyTbodyCollapse('#tb-consent-quiro', 5);
    applyTbodyCollapse('#tb-historia', 5);
    applyTbodyCollapse('#tb-justificantes', 5);
    applyTbodyCollapse('#tb-odont-final', 5);
    applyTbodyCollapse('#tb-ortodoncia', 5);
    applyTbodyCollapse('#tb-diag-infantil', 5);
  });
})();
