// Calcular edad
function calcularEdad() {
  const fechaNac = new Date(document.getElementById('fechaNacimiento').value);
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) edad--;
  document.getElementById('edadPaciente').value = edad >= 0 ? edad : '';
}

// Mostrar/ocultar campos condicionales
function toggleConditional(checkboxId, targetId) {
  const checkbox = document.getElementById(checkboxId);
  const target = document.getElementById(targetId);
  if (checkbox && target) {
    target.style.display = checkbox.checked ? 'block' : 'none';
  }
}

// Activar o desactivar fecha según selección
function toggleFecha(radio, fechaId) {
  const fechaInput = document.getElementById(fechaId);
  if (fechaInput) {
    fechaInput.disabled = radio.value !== 'si';
    if (fechaInput.disabled) fechaInput.value = '';
  }
}

// Activar o desactivar cantidad según selección
function toggleCantidad(radio, cantId) {
  const cantInput = document.getElementById(cantId);
  if (cantInput) {
    cantInput.disabled = radio.value !== 'si';
    if (cantInput.disabled) cantInput.value = '';
  }
}

// Generar dinámicamente filas
function generarFilasPatologicos() {
  const patologias = [
    "Enf. Infancia", "Alergias", "Asma", "Cáncer", "Hepatitis", "Artritis",
    "Amigdalitis", "Enf. de Transmisión Sexual", "SIDA", "Enf. Renales",
    "Enf. Cardíacas", "Hipertensión", "Diabetes", "Epilepsia", "Gastritis",
    "Tx. Quirúrgicos", "Transfusiones", "Traumatismos", "Disfunciones Endocrinas", "Otros"
  ];
  const tbody = document.getElementById('tablaPatologicos');
  if (!tbody) return;
  patologias.forEach(patologia => {
    const esOtro = patologia === "Otros";
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${patologia}${esOtro ? ' <input type="text" class="form-control form-control-sm mt-1" placeholder="Especificar">' : ''}</td>
      <td><input type="radio" name="pat_${patologia}" value="si" onchange="toggleFecha(this, 'fecha_${patologia.replace(/ /g, '_')}')"></td>
      <td><input type="radio" name="pat_${patologia}" value="no" onchange="toggleFecha(this, 'fecha_${patologia.replace(/ /g, '_')}')"></td>
      <td><input type="date" id="fecha_${patologia.replace(/ /g, '_')}" class="form-control form-control-sm" disabled></td>
    `;
    tbody.appendChild(tr);
  });
}

function generarFilasMujeres() {
  const condiciones = [
    "Fum (Fumar)", "Menopausia", "Embarazos", "Hijos", "Partos",
    "Cesáreas", "Abortos", "¿Está embarazada?", "¿Usa anticonceptivos orales?"
  ];
  const tbody = document.getElementById('tablaMujeres');
  if (!tbody) return;
  condiciones.forEach(cond => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cond}</td>
      <td><input type="radio" name="muj_${cond}" value="si" onchange="toggleFecha(this, 'muj_fecha_${cond.replace(/[^a-zA-Z0-9]/g, '_')}')"></td>
      <td><input type="radio" name="muj_${cond}" value="no" onchange="toggleFecha(this, 'muj_fecha_${cond.replace(/[^a-zA-Z0-9]/g, '_')}')"></td>
      <td><input type="date" id="muj_fecha_${cond.replace(/[^a-zA-Z0-9]/g, '_')}" class="form-control form-control-sm" disabled></td>
    `;
    tbody.appendChild(tr);
  });
}

function generarFilasNoPatologicos() {
  const habitos = ["Higiene Bucal", "Alcoholismo", "Tabaquismo", "Toxicomanías", "Inmunizaciones"];
  const tbody = document.getElementById('tablaNoPatologicos');
  if (!tbody) return;
  habitos.forEach(hab => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${hab}</td>
      <td><input type="radio" name="hab_${hab}" value="si" onchange="toggleCantidad(this, 'hab_cant_${hab.replace(/ /g, '_')}')"></td>
      <td><input type="radio" name="hab_${hab}" value="no" onchange="toggleCantidad(this, 'hab_cant_${hab.replace(/ /g, '_')}')"></td>
      <td><input type="text" id="hab_cant_${hab.replace(/ /g, '_')}" class="form-control form-control-sm" disabled placeholder="Ej: 2 veces/día"></td>
    `;
    tbody.appendChild(tr);
  });
}

function generarFilasFamiliares() {
  const patologias = [
    "Cardiopatías", "Hipertensión Arterial", "Diabetes", "Alergias", "Asma",
    "Artritis", "Neoplasias", "Epilepsia", "Malformación", "Fiebre Reumática",
    "Hepatitis", "Enf. de la Tiroides", "SIDA", "Otras", "Aparentemente Sano"
  ];
  const miembros = ["Madre", "Abuela Materna", "Abuelo Materno", "Padre", "Abuela Paterna", "Abuelo Paterna", "Hermano", "Otros"];
  const tbody = document.getElementById('tablaFamiliares');
  if (!tbody) return;
  patologias.forEach(pat => {
    const tr = document.createElement('tr');
    let celdas = `<td>${pat}${pat === "Otras" ? ' <input type="text" class="form-control form-control-sm" placeholder="Especificar">' : ''}</td>`;
    miembros.forEach(m => {
      const id = `${pat.replace(/ /g, '_')}_${m.replace(/ /g, '_')}`;
      celdas += `<td><input type="checkbox" id="${id}"></td>`;
    });
    tr.innerHTML = celdas;
    tbody.appendChild(tr);
  });
}


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
  const campos = [
    'Cardiovascular', 'Circulatorio', 'Respiratorio', 'Digestivo',
    'Urinario', 'Genital', 'Musculoesquelético', 'SNC'
  ];
  const respuestas = {};
  campos.forEach(label => {
    const el = Array.from(document.querySelectorAll('label')).find(l => l.textContent.includes(label));
    if (el) {
      const textarea = el.parentElement.querySelector('textarea');
      respuestas[label] = textarea?.value || '';
    }
  });
  return respuestas;
}

function recolectarExploracion() {
  const campos = [
    'Cabeza, Cuello, Cara, Perfil',
    'ATM (Articulación Temporomandibular)',
    'Labios, Frenillos, Lengua, Paladar Duro, Blando, Orofaringe, Región Yugal',
    'Piso de Boca, Glándulas Salivales, Carrillos',
    'Encías, Procesos Alveolares'
  ];
  const respuestas = {};
  campos.forEach(label => {
    const el = Array.from(document.querySelectorAll('label')).find(l => l.textContent.includes(label));
    if (el) {
      const textarea = el.parentElement.querySelector('textarea');
      respuestas[label] = textarea?.value || '';
    }
  });
  return respuestas;
}

function obtenerObservacionesGenerales() {
  const label = Array.from(document.querySelectorAll('h5')).find(h => h.textContent.includes('Observaciones Generales'));
  return label?.parentElement?.nextElementSibling?.querySelector('textarea')?.value || '';
}

function obtenerHallazgosRadiograficos() {
  const label = Array.from(document.querySelectorAll('h5')).find(h => h.textContent.includes('Hallazgos Radiográficos'));
  return label?.parentElement?.nextElementSibling?.querySelector('textarea')?.value || '';
}


// Inicializar todo
document.addEventListener('DOMContentLoaded', () => {
  generarFilasPatologicos();
  generarFilasMujeres();
  generarFilasNoPatologicos();
  generarFilasFamiliares();

  const sexoSelect = document.getElementById('sexoPaciente');
  const seccionMujeres = document.getElementById('seccionMujeres');
  if (sexoSelect && seccionMujeres) {
    sexoSelect.addEventListener('change', () => {
      seccionMujeres.style.display = sexoSelect.value === 'Femenino' ? 'block' : 'none';
    });
  }

  const form = document.getElementById('historiaClinicaForm');
  const canvas = document.getElementById('signature-pad-paciente');

  if (canvas) {
    canvas.addEventListener("click", () => {
      canvas.style.cursor = "crosshair";
    });
  }

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const data = {
        firmaPaciente: canvas ? canvas.toDataURL("image/png") : null
        // Aquí puedes agregar más campos clínicos si lo deseas
      };

      const { firmaPaciente, ...dataSinFirma } = data;
      console.log('Datos a enviar (sin firma):', dataSinFirma);

      if (firmaPaciente) {
        const bytes = Math.round((firmaPaciente.length * 3 / 4) / 1024);
        console.log(`🖊️ Firma del paciente presente (aprox. ${bytes} KB)`);
      } else {
        console.log('❌ Firma del paciente no presente');
      }

      try {
        const res = await fetch('/api/pdf/historia/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error(`Status ${res.status}`);

                const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (err) {
        console.error('Error al generar PDF:', err);
        alert('No se pudo generar el PDF. Revisa la consola.');
      }
    });
  }

  // Botón de descarga directa
  const botonDescarga = document.getElementById('descargarPDF');
  if (botonDescarga) {
    botonDescarga.addEventListener('click', async () => {
    const data = {
        // Datos generales
        nombrePaciente: form.nombrePaciente.value,
        domicilioPaciente: form.domicilioPaciente.value,
        telefonoPaciente: form.telefonoPaciente.value,
        sexoPaciente: form.sexoPaciente.value,
        fechaNacimiento: form.fechaNacimiento.value,
        edadPaciente: form.edadPaciente.value,
        estadoCivil: form.estadoCivil.value,
        ocupacionPaciente: form.ocupacionPaciente.value,
        motivoConsulta: form.motivoConsulta.value,

        // Tratamiento médico
        tratamientoMedico: document.getElementById('tratamientoMedicoSi')?.checked || false,
        tratamientoMedicoCual: document.querySelector('#tratamientoMedicoCual input')?.value || '',
        medicamento: document.getElementById('medicamentoSi')?.checked || false,
        medicamentoCual: document.querySelector('#medicamentoCual input')?.value || '',
        problemaDental: document.getElementById('problemaDentalSi')?.checked || false,
        problemaDentalCual: document.querySelector('#problemaDentalCual input')?.value || '',

        // Tablas
        antecedentesPatologicos: recolectarTablaPatologicos(),
        antecedentesMujeres: recolectarTablaMujeres(),
        antecedentesNoPatologicos: recolectarTablaNoPatologicos(),
        antecedentesFamiliares: recolectarTablaFamiliares(),

        // Interrogatorio y exploración
        interrogatorioSistemas: recolectarInterrogatorio(),
        exploracionClinica: recolectarExploracion(),

        // Finales
        observacionesGenerales: obtenerObservacionesGenerales(),
        hallazgosRadiograficos: obtenerHallazgosRadiograficos(),

        // Firma
        firmaPaciente: canvas ? canvas.toDataURL("image/png") : null
    };

      try {
        const res = await fetch('/api/pdf/historia/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error(`Status ${res.status}`);

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (err) {
        console.error('Error al generar PDF desde botón:', err);
        alert('No se pudo generar el PDF. Revisa la consola.');
      }
    });
  }
});
