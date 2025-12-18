const API_BASE = "/api/patients";
const ENDPOINTS = {
  formsLog: `${API_BASE}/admin/forms/logs`,
  formSoftDelete: (id) => `${API_BASE}/admin/forms/${id}/delete`,
  formRestore: (id) => `${API_BASE}/admin/forms/${id}/restore`,
  users: `${API_BASE}/admin/users`,
  createUser: `${API_BASE}/admin/users`,
  userExists: (email) => `${API_BASE}/admin/users/exists?email=${encodeURIComponent(email)}`,
  userActive: (id) => `${API_BASE}/admin/users/${id}/active`,
  userReset: (id) => `${API_BASE}/admin/users/${id}/reset-password`,
  userRoles: (id) => `${API_BASE}/admin/users/${id}/roles`,
  medicos: `${API_BASE}/admin/medicos`,
  medicoById: (id) => `${API_BASE}/admin/medicos/${id}`,
  stats: `${API_BASE}/admin/stats`,
};

// -------------------------------
// Helpers auth
// -------------------------------
function getToken() {
  return localStorage.getItem("token");
}

function getRoles() {
  try {
    return JSON.parse(localStorage.getItem("roles") || "[]");
  } catch {
    return [];
  }
}

function isAdmin() {
  const roles = getRoles();
  return Array.isArray(roles) && roles.includes("admin");
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...extra,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// -------------------------------
// Guard: solo admin entra
// -------------------------------
function guardAdminPage() {
  const token = getToken();
  if (!token) {
    location.href = "index.html";
    return;
  }
  if (!isAdmin()) {
    location.href = "menu.html";
    return;
  }
}

// -------------------------------
// Fetch wrapper
// -------------------------------
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem("token");
    localStorage.removeItem("roles");
    location.href = "index.html";
    return null;
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg = (data && (data.msg || data.message || data.error)) || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function checkEmailExists(email) {
  if (!email) return false;
  const data = await apiFetch(ENDPOINTS.userExists(email));
  return !!(data?.exists);
}

// -------------------------------
// UI: set admin identity
// -------------------------------
function setAdminIdentity() {
  const token = getToken();
  const payload = token ? decodeJwtPayload(token) : null;

  const el = document.getElementById("admin-email");
  if (!el) return;

  const email =
    payload?.email ||
    payload?.user?.email ||
    payload?.sub ||
    "Administrador";

  el.textContent = email;
}

// -------------------------------
// Logout
// -------------------------------
function setupLogout() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const ok = await Swal.fire({
      title: "Cerrar sesión",
      text: "¿Seguro que deseas salir?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Salir",
      cancelButtonText: "Cancelar",
    }).then(r => r.isConfirmed);

    if (!ok) return;

    localStorage.removeItem("token");
    localStorage.removeItem("roles");
    location.href = "index.html";
  });
}

// -------------------------------
// Render: Users table
// -------------------------------
function renderUsers(users = []) {
  const tbody = document.getElementById("tablaUsuarios");
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Sin usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((u) => {
      const roles = (u.roles || []).join(", ");
      const activeBadge = u.is_active
        ? `<span class="badge bg-success">Sí</span>`
        : `<span class="badge bg-danger">No</span>`;

      const btnActive = u.is_active
        ? `<button class="btn btn-sm btn-outline-danger" data-action="toggle-active" data-id="${u.id}" data-active="0">Desactivar</button>`
        : `<button class="btn btn-sm btn-outline-success" data-action="toggle-active" data-id="${u.id}" data-active="1">Activar</button>`;

      return `
        <tr>
          <td>${u.email || ""}</td>
          <td>${roles || "-"}</td>
          <td>${activeBadge}</td>
          <td class="action-btns">
            <button class="btn btn-sm btn-outline-primary" data-action="reset-pass" data-id="${u.id}">Reset pass</button>
            <button class="btn btn-sm btn-outline-secondary" data-action="edit-roles" data-id="${u.id}">Roles</button>
            ${btnActive}
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadUsers(search = "") {
  try {
    const url = search ? `${ENDPOINTS.users}?search=${encodeURIComponent(search)}` : ENDPOINTS.users;
    const data = await apiFetch(url);
    const users = Array.isArray(data) ? data : (data?.users || []);
    renderUsers(users);
  } catch (err) {
    console.warn("Users:", err.message);
    toastInfo?.("Sin datos", "No se pudo cargar la lista de usuarios.");
    renderUsers([]);
  }
}

// -------------------------------
// Render: Doctors table
// -------------------------------
function renderDoctors(doctors = []) {
  const tbody = document.getElementById("tablaDoctores");
  if (!tbody) return;

  if (!doctors.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Sin doctores</td></tr>`;
    return;
  }

  tbody.innerHTML = doctors
    .map((d) => {
      const nombre = `${d.nombre || ""} ${d.apellido || ""}`.trim();
      return `
        <tr>
          <td>${nombre || "-"}</td>
          <td>${d.cedula || "-"}</td>
          <td>${d.especialidad || "-"}</td>
          <td>${d.email || "-"}</td>
          <td class="action-btns">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-medico" data-id="${d.id}">Editar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadDoctors(search = "") {
  try {
    const url = search ? `${ENDPOINTS.medicos}?search=${encodeURIComponent(search)}` : ENDPOINTS.medicos;
    const data = await apiFetch(url);
    const doctors = Array.isArray(data) ? data : (data?.medicos || data?.doctors || []);
    renderDoctors(doctors);
  } catch (err) {
    console.warn("Doctors:", err.message);
    toastInfo?.("Sin datos", "No se pudo cargar la lista de doctores.");
    renderDoctors([]);
  }
}

// -------------------------------
// Stats
// -------------------------------
async function loadStats() {
  const elUsers = document.getElementById("statUsers");
  const elDocs = document.getElementById("statDoctors");
  const elForms = document.getElementById("statForms");

  try {
    const data = await apiFetch(ENDPOINTS.stats);
    if (elUsers) elUsers.textContent = data?.usersActive ?? "-";
    if (elDocs) elDocs.textContent = data?.doctors ?? "-";
    if (elForms) elForms.textContent = data?.formsTotal ?? "-";
  } catch {
    if (elUsers) elUsers.textContent = "-";
    if (elDocs) elDocs.textContent = "-";
    if (elForms) elForms.textContent = "-";
  }
}

// -------------------------------
// SweetAlert UI helpers
// -------------------------------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  }[c]));

// -------------------------------
// Actions (delegation)
// -------------------------------
function setupActions() {
  // Usuarios
  const usersTable = document.getElementById("tablaUsuarios");
  if (usersTable) {
    usersTable.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      try {
        // activar / desactivar
        if (action === "toggle-active") {
          const is_active = Number(btn.dataset.active);

          const ok = await confirmDanger({
            title: is_active ? "Activar usuario" : "Desactivar usuario",
            text: `¿Seguro que deseas ${is_active ? "ACTIVAR" : "DESACTIVAR"} este usuario?`,
            confirmText: is_active ? "Sí, activar" : "Sí, desactivar",
          });
          if (!ok) return;

          loadingOn?.("Actualizando usuario...");
          await apiFetch(ENDPOINTS.userActive(id), {
            method: "PUT",
            body: JSON.stringify({ is_active }),
          });
          loadingOff?.();

          toastOk?.(is_active ? "Usuario activado" : "Usuario desactivado");
          await loadUsers(document.getElementById("searchUser")?.value?.trim() || "");
          return;
        }

        // reset-pass
        if (action === "reset-pass") {
          const r = await Swal.fire({
            title: "Resetear contraseña",
            text: "Escribe una contraseña temporal o déjala vacía para generar una automática.",
            icon: "question",
            input: "text",
            inputPlaceholder: "Ej: Temp#2025!",
            inputAttributes: {
              autocomplete: "new-password",
              autocapitalize: "off",
              autocorrect: "off",
              spellcheck: "false",
            },
            showCancelButton: true,
            confirmButtonText: "Resetear",
            cancelButtonText: "Cancelar",
            focusConfirm: false,
            returnFocus: false,
            didOpen: () => {
              const input = Swal.getInput();
              if (input) {
                input.readOnly = false;
                input.disabled = false;
                input.style.pointerEvents = "auto";
                input.style.userSelect = "text";
                input.style.webkitUserSelect = "text";
                setTimeout(() => input.focus(), 0);
              }
            },
            preConfirm: () => (Swal.getInput()?.value || "").trim(),
          });

          if (!r.isConfirmed) return;

          const tempPassword = r.value || "";
          const body = tempPassword ? { tempPassword } : {};

          loadingOn?.("Reseteando contraseña...");
          const data = await apiFetch(ENDPOINTS.userReset(id), {
            method: "POST",
            body: JSON.stringify(body),
          });
          loadingOff?.();

          const pass = data?.tempPassword || tempPassword || "";

          await Swal.fire({
            icon: "success",
            title: "Contraseña reseteada",
            html: `
              <p class="mb-2">Cópiala ahora (se muestra una sola vez):</p>
              <input id="copyPass" class="swal2-input" value="${esc(pass)}" readonly>
              <button id="btnCopyPass" type="button" class="swal2-confirm swal2-styled">Copiar</button>
            `,
            confirmButtonText: "Listo",
            didOpen: () => {
              const input = document.getElementById("copyPass");
              const btnCopy = document.getElementById("btnCopyPass");

              input?.focus();
              input?.select();

              btnCopy?.addEventListener("click", async () => {
                try {
                  await navigator.clipboard.writeText(input.value);
                  toastOk?.("Copiado", "Contraseña copiada");
                } catch {
                  input.focus();
                  input.select();
                  document.execCommand("copy");
                  toastOk?.("Copiado", "Contraseña copiada");
                }
              });
            }
          });

          await loadUsers(document.getElementById("searchUser")?.value?.trim() || "");
          return;
        }

        // editar roles
        if (action === "edit-roles") {
          const current = btn.closest("tr")?.children?.[1]?.textContent?.trim() || "";

          const r = await Swal.fire({
            title: "Editar rol",
            icon: "info",
            input: "select",
            inputOptions: {
              admin: "Admin",
              doctor: "Doctor",
              asistente: "Asistente"
            },
            inputValue: (current.split(",")[0] || "").trim() || "",
            showCancelButton: true,
            confirmButtonText: "Guardar",
            cancelButtonText: "Cancelar",
          });

          if (!r.isConfirmed) return;

          loadingOn?.("Guardando rol...");
          await apiFetch(ENDPOINTS.userRoles(id), {
            method: "PUT",
            body: JSON.stringify({ roleNames: [r.value] }),
          });
          loadingOff?.();

          toastOk?.("Rol actualizado");
          await loadUsers(document.getElementById("searchUser")?.value?.trim() || "");
          return;
        }

      } catch (err) {
        console.error(err);
        loadingOff?.();
        toastErr?.("Error", err.message || "Ocurrió un error");
      }
    });
  }

  // Doctores (por ahora solo editar placeholder)
  const docsTable = document.getElementById("tablaDoctores");
  if (docsTable) {
    docsTable.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      try {
// Doctores
const docsTable = document.getElementById("tablaDoctores");
if (docsTable) {
  docsTable.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      if (action === "edit-medico") {
  loadingOn?.("Cargando doctor...");
  const data = await apiFetch(ENDPOINTS.medicoById(id)); // ✅ ahora sí existe GET
  loadingOff?.();

  const medico = data?.medico;

  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#039;"
    }[c]));

  const r = await Swal.fire({
    title: "Editar doctor",
    icon: "info",
    width: 820,
    html: `
      <div style="text-align:left; max-width:760px; margin:0 auto;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Nombre *</label>
            <input id="eNombre" class="swal2-input" style="margin:0;" value="${esc(medico.nombre || "")}">
          </div>
          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Apellido *</label>
            <input id="eApellido" class="swal2-input" style="margin:0;" value="${esc(medico.apellido || "")}">
          </div>

          <div style="grid-column:1/-1;">
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Email *</label>
            <input id="eEmail" class="swal2-input" style="margin:0;" value="${esc(medico.email || "")}">
          </div>

          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Cédula</label>
            <input id="eCedula" class="swal2-input" style="margin:0;" value="${esc(medico.cedula || "")}">
          </div>
          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Especialidad</label>
            <input id="eEsp" class="swal2-input" style="margin:0;" value="${esc(medico.especialidad || "")}">
          </div>

          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Género</label>
            <select id="eGenero" class="swal2-select" style="margin:0; width:100%; display:block;">
              <option value="">(Opcional)</option>
              <option value="Masculino" ${medico.genero === "Masculino" ? "selected" : ""}>Masculino</option>
              <option value="Femenino" ${medico.genero === "Femenino" ? "selected" : ""}>Femenino</option>
              <option value="Otro" ${medico.genero === "Otro" ? "selected" : ""}>Otro</option>
            </select>
          </div>
          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">RFC</label>
            <input id="eRFC" class="swal2-input" style="margin:0;" value="${esc(medico.rfc || "")}">
          </div>

          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Teléfono principal</label>
            <input id="eTel1" class="swal2-input" style="margin:0;" value="${esc(medico.telefono_principal || "")}">
          </div>
          <div>
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Teléfono secundario</label>
            <input id="eTel2" class="swal2-input" style="margin:0;" value="${esc(medico.telefono_secundario || "")}">
          </div>

          <div style="grid-column:1/-1;">
            <label style="font-weight:600; font-size:.9rem; margin:0 0 4px; display:block;">Dirección</label>
            <input id="eDir" class="swal2-input" style="margin:0;" value="${esc(medico.direccion || "")}">
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Guardar cambios",
    cancelButtonText: "Cancelar",
    focusConfirm: false,
    preConfirm: () => {
      const nombre = (document.getElementById("eNombre")?.value || "").trim();
      const apellido = (document.getElementById("eApellido")?.value || "").trim();
      const email = (document.getElementById("eEmail")?.value || "").trim();

      if (!nombre || !apellido) {
        Swal.showValidationMessage("Nombre y apellido son obligatorios");
        return false;
      }
      if (!email || !email.includes("@")) {
        Swal.showValidationMessage("Email inválido");
        return false;
      }

      return {
        nombre,
        apellido,
        email,
        cedula: (document.getElementById("eCedula")?.value || "").trim() || null,
        especialidad: (document.getElementById("eEsp")?.value || "").trim() || null,
        genero: (document.getElementById("eGenero")?.value || "").trim() || null,
        rfc: (document.getElementById("eRFC")?.value || "").trim() || null,
        telefono_principal: (document.getElementById("eTel1")?.value || "").trim() || null,
        telefono_secundario: (document.getElementById("eTel2")?.value || "").trim() || null,
        direccion: (document.getElementById("eDir")?.value || "").trim() || null,
        firma_url: (document.getElementById("eFirma")?.value || "").trim() || null,
      };
    }
  });

  if (!r.isConfirmed) return;

  loadingOn?.("Guardando doctor...");
  await apiFetch(ENDPOINTS.medicoById(id), {
    method: "PUT",
    body: JSON.stringify(r.value),
  });
  loadingOff?.();

  toastOk?.("Doctor actualizado");
  await loadDoctors(document.getElementById("searchDoctor")?.value?.trim() || "");
}
  
        } catch (err) {
          console.error(err);
          loadingOff?.();
          toastErr?.("Error", err.message || "No se pudo editar el doctor");
        }
      });
    }

      } catch (err) {
        console.error(err);
        toastErr?.("Error", err.message || "Ocurrió un error");
      }
    });
  }
}

// -------------------------------
// Search + New buttons wiring
// -------------------------------
function setupSearch() {
  const inputUser = document.getElementById("searchUser");
  const btnSearchUser = document.getElementById("btnSearchUser");
  const btnNewUser = document.getElementById("btnNewUser");

  const inputDoc = document.getElementById("searchDoctor");
  const btnSearchDoctor = document.getElementById("btnSearchDoctor");
  const btnNewDoctor = document.getElementById("btnNewDoctor");

  // --- USERS: enter
  inputUser?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await loadUsers(inputUser.value.trim());
      toastInfo?.("Filtro aplicado", "Usuarios filtrados");
    }
  });

  // --- USERS: button search
  btnSearchUser?.addEventListener("click", async () => {
    await loadUsers(inputUser?.value?.trim() || "");
    toastInfo?.("Búsqueda", "Usuarios cargados");
  });

  // --- DOCTORS: enter
  inputDoc?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await loadDoctors(inputDoc.value.trim());
      toastInfo?.("Filtro aplicado", "Doctores filtrados");
    }
  });

  // --- DOCTORS: button search
  btnSearchDoctor?.addEventListener("click", async () => {
    await loadDoctors(inputDoc?.value?.trim() || "");
    toastInfo?.("Búsqueda", "Doctores cargados");
  });

  // --- NEW USER
  btnNewUser?.addEventListener("click", async () => {
    const doctorFieldsHTML = () => `
      <div id="doctorFieldsWrap" style="display:none; margin-top:14px;">
        <div style="border-top:1px solid #eee; padding-top:12px;">
          <div style="font-weight:600; margin-bottom:8px; text-align:left;">
            Datos del doctor
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Nombre *</label>
              <input id="docNombre" class="swal2-input" style="margin:0;" placeholder="Ej: Juan">
            </div>
            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Apellido *</label>
              <input id="docApellido" class="swal2-input" style="margin:0;" placeholder="Ej: Pérez">
            </div>

            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Cédula</label>
              <input id="docCedula" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>
            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Especialidad</label>
              <input id="docEspecialidad" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>

            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Género</label>
              <select id="docGenero" class="swal2-select" style="margin:0; width:100%; display:block;">
                <option value="">(Opcional)</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">RFC</label>
              <input id="docRFC" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>

            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Teléfono principal</label>
              <input id="docTel1" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>
            <div>
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Teléfono secundario</label>
              <input id="docTel2" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>

            <div style="grid-column: 1 / -1;">
              <label style="font-size:.85rem; display:block; margin:0 0 4px;">Dirección</label>
              <input id="docDireccion" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>
          </div>
        </div>
      </div>
    `;

    const r = await Swal.fire({
      title: "Nuevo usuario",
      icon: "info",
      width: 760,
      html: `
        <div style="max-width:700px; margin:0 auto; text-align:left;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div style="grid-column:1/-1;">
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Email *</label>
              <input id="newEmail" class="swal2-input" style="margin:0;" placeholder="correo@dominio.com">
            </div>

            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Rol *</label>
              <select id="newRole" class="swal2-select" style="margin:0; width:100%; display:block;">
                <option value="" selected>Selecciona un rol...</option>
                <option value="doctor">Doctor</option>
                <option value="asistente">Asistente</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Contraseña temporal</label>
              <input id="newPass" class="swal2-input" style="margin:0;" placeholder="Vacío = generar automática">
            </div>
          </div>

          <div style="margin-top:10px; color:#6c757d; font-size:.9rem;">
            Tip: si la dejas vacía, el sistema puede generar una y te la mostramos para copiarla.
          </div>

          ${doctorFieldsHTML()}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Crear",
      cancelButtonText: "Cancelar",
      focusConfirm: false,
      returnFocus: false,

      didOpen: () => {
        const makeInteractive = (el) => {
          if (!el) return;
          el.readOnly = false;
          el.disabled = false;
          el.style.pointerEvents = "auto";
          el.style.userSelect = "text";
          el.style.webkitUserSelect = "text";
        };

        const emailEl = document.getElementById("newEmail");
        const passEl = document.getElementById("newPass");
        const roleEl = document.getElementById("newRole");
        const wrap = document.getElementById("doctorFieldsWrap");

        makeInteractive(emailEl);
        makeInteractive(passEl);
        makeInteractive(roleEl);

        const toggleDoctorFields = () => {
          const role = roleEl.value;
          if (wrap) wrap.style.display = (role === "doctor") ? "block" : "none";
        };

        roleEl.addEventListener("change", toggleDoctorFields);
        toggleDoctorFields();
        setTimeout(() => emailEl?.focus(), 0);
      },

      preConfirm: async () => {
        const email = (document.getElementById("newEmail")?.value || "").trim().toLowerCase();
        const roleName = (document.getElementById("newRole")?.value || "").trim();
        const tempPassword = (document.getElementById("newPass")?.value || "").trim();

        if (!email || !email.includes("@")) {
          Swal.showValidationMessage("Ingresa un email válido");
          return false;
        }
        if (!roleName) {
          Swal.showValidationMessage("Selecciona un rol");
          return false;
        }

        // ✅ validar email existente ANTES de mandar
        try {
          const exists = await checkEmailExists(email);
          if (exists) {
            Swal.showValidationMessage("Ese email ya existe. Usa otro.");
            return false;
          }
        } catch {
          Swal.showValidationMessage("No se pudo verificar el email. Intenta de nuevo.");
          return false;
        }

        let medico = null;
        if (roleName === "doctor") {
          const nombre = (document.getElementById("docNombre")?.value || "").trim();
          const apellido = (document.getElementById("docApellido")?.value || "").trim();

          if (!nombre || !apellido) {
            Swal.showValidationMessage("Para doctor: nombre y apellido son obligatorios");
            return false;
          }

          medico = {
            nombre,
            apellido,
            cedula: (document.getElementById("docCedula")?.value || "").trim() || null,
            especialidad: (document.getElementById("docEspecialidad")?.value || "").trim() || null,
            genero: (document.getElementById("docGenero")?.value || "").trim() || null,
            rfc: (document.getElementById("docRFC")?.value || "").trim() || null,
            telefono_principal: (document.getElementById("docTel1")?.value || "").trim() || null,
            telefono_secundario: (document.getElementById("docTel2")?.value || "").trim() || null,
            direccion: (document.getElementById("docDireccion")?.value || "").trim() || null,
            firma_url: (document.getElementById("docFirmaUrl")?.value || "").trim() || null,
          };
        }

        return { email, tempPassword, roleName, medico };
      }
    });

    if (!r.isConfirmed) return;

    try {
      loadingOn?.("Creando usuario...");

      const payload = {
        email: r.value.email,
        roleNames: [r.value.roleName],
        ...(r.value.tempPassword ? { tempPassword: r.value.tempPassword } : {}),
        ...(r.value.medico ? { medico: r.value.medico } : {}),
      };

      const data = await apiFetch(ENDPOINTS.createUser, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      loadingOff?.();

      const createdPass = data?.tempPassword || r.value.tempPassword || "(generada)";
      await Swal.fire({
        icon: "success",
        title: "Usuario creado",
        html: `
          <div style="text-align:left; max-width:520px; margin:0 auto;">
            <p class="mb-1"><b>Email:</b> ${esc(payload.email)}</p>
            <p class="mb-1"><b>Rol:</b> ${esc(payload.roleNames[0])}</p>
            ${payload.medico ? `<p class="mb-2"><b>Doctor:</b> ${esc(payload.medico.nombre)} ${esc(payload.medico.apellido)}</p>` : ``}
            <p class="mb-2">Contraseña temporal:</p>
            <input id="copyNewPass" class="swal2-input" value="${esc(createdPass)}" readonly>
            <button id="btnCopyNewPass" type="button" class="swal2-confirm swal2-styled">Copiar</button>
          </div>
        `,
        confirmButtonText: "Listo",
        didOpen: () => {
          const input = document.getElementById("copyNewPass");
          const btnCopy = document.getElementById("btnCopyNewPass");

          input?.focus();
          input?.select();

          btnCopy?.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(input.value);
              toastOk?.("Copiado", "Contraseña copiada");
            } catch {
              input.focus();
              input.select();
              document.execCommand("copy");
              toastOk?.("Copiado", "Contraseña copiada");
            }
          });
        }
      });

      await loadUsers(document.getElementById("searchUser")?.value?.trim() || "");
    } catch (err) {
      loadingOff?.();
      toastErr?.("Error", err.message || "No se pudo crear el usuario");
    }
  });

  // --- NEW DOCTOR (crear directo en medicos + users)
  btnNewDoctor?.addEventListener("click", async () => {
    const r = await Swal.fire({
      title: "Nuevo doctor",
      icon: "info",
      width: 780,
      html: `
        <div style="max-width:720px; margin:0 auto; text-align:left;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div style="grid-column:1/-1;">
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Email *</label>
              <input id="dEmail" class="swal2-input" style="margin:0;" placeholder="correo@dominio.com">
            </div>

            <div style="grid-column:1/-1;">
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Contraseña temporal</label>
              <input id="dPass" class="swal2-input" style="margin:0;" placeholder="Vacío = generar automática">
            </div>

            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Nombre *</label>
              <input id="dNombre" class="swal2-input" style="margin:0;" placeholder="Ej: Juan">
            </div>
            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Apellido *</label>
              <input id="dApellido" class="swal2-input" style="margin:0;" placeholder="Ej: Pérez">
            </div>

            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Cédula</label>
              <input id="dCedula" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>
            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Especialidad</label>
              <input id="dEsp" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>

            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Género</label>
              <select id="dGenero" class="swal2-select" style="margin:0; width:100%; display:block;">
                <option value="">(Opcional)</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">RFC</label>
              <input id="dRFC" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>

            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Teléfono principal</label>
              <input id="dTel1" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>
            <div>
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Teléfono secundario</label>
              <input id="dTel2" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>

            <div style="grid-column:1/-1;">
              <label style="font-size:.9rem; font-weight:600; margin:0 0 4px; display:block;">Dirección</label>
              <input id="dDir" class="swal2-input" style="margin:0;" placeholder="Opcional">
            </div>


          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Crear doctor",
      cancelButtonText: "Cancelar",
      focusConfirm: false,
      preConfirm: async () => {
        const email = (document.getElementById("dEmail")?.value || "").trim().toLowerCase();
        const password = (document.getElementById("dPass")?.value || "").trim(); // opcional
        const nombre = (document.getElementById("dNombre")?.value || "").trim();
        const apellido = (document.getElementById("dApellido")?.value || "").trim();

        if (!email || !email.includes("@")) {
          Swal.showValidationMessage("Ingresa un email válido");
          return false;
        }
        if (!nombre || !apellido) {
          Swal.showValidationMessage("Nombre y apellido son obligatorios");
          return false;
        }

        // validar email antes
        try {
          const exists = await checkEmailExists(email);
          if (exists) {
            Swal.showValidationMessage("Ese email ya existe. Usa otro.");
            return false;
          }
        } catch {
          Swal.showValidationMessage("No se pudo verificar el email. Intenta de nuevo.");
          return false;
        }

        return {
          email,
          ...(password ? { password } : {}),
          nombre,
          apellido,
          cedula: (document.getElementById("dCedula")?.value || "").trim() || null,
          especialidad: (document.getElementById("dEsp")?.value || "").trim() || null,
          genero: (document.getElementById("dGenero")?.value || "").trim() || null,
          rfc: (document.getElementById("dRFC")?.value || "").trim() || null,
          telefono_principal: (document.getElementById("dTel1")?.value || "").trim() || null,
          telefono_secundario: (document.getElementById("dTel2")?.value || "").trim() || null,
          direccion: (document.getElementById("dDir")?.value || "").trim() || null,
          firma_url: (document.getElementById("dFirma")?.value || "").trim() || null,
        };
      }
    });

    if (!r.isConfirmed) return;

    try {
      loadingOn?.("Creando doctor...");

      const data = await apiFetch(ENDPOINTS.medicos, {
        method: "POST",
        body: JSON.stringify(r.value),
      });

      loadingOff?.();

      const pass = data?.tempPassword || r.value.password || "(generada)";
      await Swal.fire({
        icon: "success",
        title: "Doctor creado",
        html: `
          <div style="text-align:left; max-width:520px; margin:0 auto;">
            <p class="mb-1"><b>Email:</b> ${esc(r.value.email)}</p>
            <p class="mb-2"><b>Nombre:</b> ${esc(r.value.nombre)} ${esc(r.value.apellido)}</p>
            <p class="mb-2">Contraseña temporal:</p>
            <input id="copyDocPass" class="swal2-input" value="${esc(pass)}" readonly>
            <button id="btnCopyDocPass" type="button" class="swal2-confirm swal2-styled">Copiar</button>
          </div>
        `,
        confirmButtonText: "Listo",
        didOpen: () => {
          const input = document.getElementById("copyDocPass");
          const btnCopy = document.getElementById("btnCopyDocPass");

          input?.focus();
          input?.select();

          btnCopy?.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(input.value);
              toastOk?.("Copiado", "Contraseña copiada");
            } catch {
              input.focus();
              input.select();
              document.execCommand("copy");
              toastOk?.("Copiado", "Contraseña copiada");
            }
          });
        }
      });

      await loadDoctors(document.getElementById("searchDoctor")?.value?.trim() || "");
    } catch (err) {
      loadingOff?.();
      toastErr?.("Error", err.message || "No se pudo crear el doctor");
    }
  });
}

// -------------------------------
// Init
// -------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  guardAdminPage();
  setAdminIdentity();
  setupLogout();
  setupActions();
  setupSearch();
  setupLogsUI();

  await loadUsers("");
  await loadDoctors("");
  await loadStats();
});

// -------------------------------
// Logs (Formularios)
// -------------------------------
let LOGS_LIMIT = 20;
let logsOffset = 0;

function fmtDT(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('es-MX');
  } catch {
    return String(v);
  }
}

function badgeEliminado(flag) {
  return Number(flag) ? `<span class="badge bg-danger">Sí</span>` : `<span class="badge bg-success">No</span>`;
}

function renderLogs(rows = []) {
  const tbody = document.getElementById('tablaLogs');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-4">Sin registros</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const eliminado = Number(r.eliminado_logico) === 1;

    const paciente = `
      <div class="fw-semibold">${esc(r.paciente_nombre || '—')}</div>
      <div class="text-muted small">ID: ${esc(String(r.paciente_id || '—'))} ${r.paciente_email ? `• ${esc(r.paciente_email)}` : ''}</div>
    `;

    const creado = `
      <div>${fmtDT(r.fecha_creacion)}</div>
      ${r.creado_por_email ? `<div class="text-muted small">${esc(r.creado_por_email)}</div>` : `<div class="text-muted small">—</div>`}
    `;

    const actualizado = `
      <div>${fmtDT(r.fecha_actualizacion)}</div>
      ${r.actualizado_por_email ? `<div class="text-muted small">${esc(r.actualizado_por_email)}</div>` : `<div class="text-muted small">—</div>`}
    `;

    const eliminadoInfo = eliminado
      ? `<div class="text-danger small">
           <div><b>${esc(r.eliminado_por_email || '—')}</b></div>
           <div>${fmtDT(r.fecha_eliminacion || r.fecha_actualizacion)}</div>
         </div>`
      : `<div class="text-muted small">—</div>`;

    const acciones = eliminado
      ? `
        <button class="btn btn-sm btn-outline-success" data-action="restore-form" data-id="${r.formulario_id}">
          ♻️ Recuperar
        </button>`
      : `
        <button class="btn btn-sm btn-outline-danger" data-action="delete-form" data-id="${r.formulario_id}">
          🗑️ Eliminar
        </button>`;

    return `
      <tr>
        <td>${esc(String(r.formulario_id))}</td>
        <td>${paciente}</td>
        <td><span class="badge bg-dark">${esc(r.tipo_formulario || '—')}</span></td>
        <td>${fmtDT(r.fecha_creacion)}</td>
        <td>${esc(r.creado_por_nombre ? `Dr. ${r.creado_por_nombre}` : (r.creado_por_email || '—'))}</td>
        <td>${fmtDT(r.fecha_actualizacion)}</td>
        <td>${badgeEliminado(r.eliminado_logico)}<div class="mt-1">${eliminadoInfo}</div></td>
        <td>${acciones}</td>
      </tr>
    `;
  }).join('');
}

async function loadLogs(reset = false) {
  const meta = document.getElementById('logsMeta');

  if (reset) logsOffset = 0;

  const search = (document.getElementById('logSearch')?.value || '').trim();
  const tipo = (document.getElementById('logTipo')?.value || '').trim();
  const eliminado = (document.getElementById('logEliminado')?.value || '').trim();

  const qs = new URLSearchParams({
    search,
    tipo,
    eliminado,
    limit: String(LOGS_LIMIT),
    offset: String(logsOffset),
  }).toString();

  try {
    loadingOn?.('Cargando logs...');
    const data = await apiFetch(`${ENDPOINTS.formsLog}?${qs}`);
    loadingOff?.();

    const rows = data?.rows || [];
    const total = Number(data?.total || 0);

    renderLogs(rows);

    const from = total ? (logsOffset + 1) : 0;
    const to = Math.min(logsOffset + LOGS_LIMIT, total);
    if (meta) meta.textContent = `Mostrando ${from}-${to} de ${total}`;

    // Habilitar/Deshabilitar paginación
    const btnPrev = document.getElementById('logsPrev');
    const btnNext = document.getElementById('logsNext');
    if (btnPrev) btnPrev.disabled = logsOffset <= 0;
    if (btnNext) btnNext.disabled = (logsOffset + LOGS_LIMIT) >= total;

  } catch (err) {
    loadingOff?.();
    console.error('Logs:', err);
    toastErr?.('Error', err.message || 'No se pudieron cargar los logs');
    renderLogs([]);
    if (meta) meta.textContent = '—';
  }
}

function setupLogsUI() {
  const btnLoad = document.getElementById('btnLoadLogs');
  const btnPrev = document.getElementById('logsPrev');
  const btnNext = document.getElementById('logsNext');
  const tbody = document.getElementById('tablaLogs');

  btnLoad?.addEventListener('click', () => loadLogs(true));

  document.getElementById('logSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadLogs(true);
  });

  btnPrev?.addEventListener('click', () => {
    logsOffset = Math.max(0, logsOffset - LOGS_LIMIT);
    loadLogs(false);
  });

  btnNext?.addEventListener('click', () => {
    logsOffset = logsOffset + LOGS_LIMIT;
    loadLogs(false);
  });

  // Delegación acciones Restore/Delete
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      if (action === 'delete-form') {
        const ok = await confirmDanger({
          title: 'Eliminar formulario',
          text: `Se marcará como eliminado ID: ${id}`,
          confirmText: 'Sí, eliminar',
        });
        if (!ok) return;

        loadingOn?.('Eliminando...');
        await apiFetch(ENDPOINTS.formSoftDelete(id), { method: 'PUT' });
        loadingOff?.();

        toastOk?.('Eliminado', 'Formulario marcado como eliminado.');
        await loadLogs(false);
        await loadStats(); // opcional
      }

      if (action === 'restore-form') {
        const ok = await Swal.fire({
          title: 'Recuperar formulario',
          text: `Se restaurará el formulario ID: ${id}`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, recuperar',
          cancelButtonText: 'Cancelar',
        }).then(r => r.isConfirmed);

        if (!ok) return;

        loadingOn?.('Recuperando...');
        await apiFetch(ENDPOINTS.formRestore(id), { method: 'PUT' });
        loadingOff?.();

        toastOk?.('Recuperado', 'Formulario restaurado.');
        await loadLogs(false);
        await loadStats();
      }

    } catch (err) {
      loadingOff?.();
      console.error(err);
      toastErr?.('Error', err.message || 'Ocurrió un error');
    }
  });

  // Cuando abras el modal, carga logs
  const modalEl = document.getElementById('modalLogs');
  modalEl?.addEventListener('shown.bs.modal', () => loadLogs(true));
}
