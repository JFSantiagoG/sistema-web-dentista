document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('ortodonciaForm');

  // ✅ Botón Descargar PDF dispara submit
  document.getElementById('descargarPDF').addEventListener('click', () => {
    form.requestSubmit();
  });

  // 🚧 BYPASS: nos enganchamos en CAPTURA para bloquear validadores globales
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopImmediatePropagation(); // <- evita que otros submit handlers (forms.js) bloqueen

    // ---- Recolecta datos ----
    const data = {
      nombrePaciente: form.querySelector('[name="nombrePaciente"]')?.value || '',
      fechaIngreso:   form.querySelector('[name="fechaIngreso"]')?.value || '',
      fechaAlta:      form.querySelector('[name="fechaAlta"]')?.value || '',

      examenClinico: {
        tipoCuerpo: form.tipoCuerpo?.value || '',
        tipoCara:   form.tipoCara?.value || '',
        tipoCraneo: form.tipoCraneo?.value || '',
        otros:      form.otros?.value || ''
      },

      analisisFuncional: {
        respiracion:      form.respiracion?.value || '',
        deglucion:        form.deglucion?.value || '',
        masticacion:      form.masticacion?.value || '',
        fonacion:         form.fonacion?.value || '',
        problemasATM:     form.problemasATM?.value || '',
        dolorATM:         form.querySelector('[name="dolor_atm"]:checked')?.value || '',
        ruidosATM:        form.querySelector('[name="ruidos_atm"]:checked')?.value || '',
        dolorPalpacion:   form.dolorPalpacion?.value || '',
        aperturaMax:      form.aperturaMax?.value || '',
        latIzq:           form.latIzq?.value || '',
        protrusion:       form.protrusion?.value || '',
        latDer:           form.latDer?.value || '',
        verticalOCRC:     form.verticalOCRC?.value || '',
        horizontalOCRC:   form.horizontalOCRC?.value || '',
        otrosOCRC:        form.otrosOCRC?.value || ''
      },

      analisisModelos: {
        relacionesDentarias: {
          oclusionMolaresDer: form.oclusionMolaresDer?.value || '',
          oclusionMolaresIzq: form.oclusionMolaresIzq?.value || '',
          oclusionCaninosDer: form.oclusionCaninosDer?.value || '',
          oclusionCaninosIzq: form.oclusionCaninosIzq?.value || '',
          resalteHorizontal:  form.resalteHorizontal?.value || '',
          resalteVertical:    form.resalteVertical?.value || '',
          lineaMediaSup:      form.lineaMediaSup?.value || '',
          lineaMediaInf:      form.lineaMediaInf?.value || '',
          mordidaCruzadaDer:  form.mordidaCruzadaDer?.value || '',
          mordidaCruzadaIzq:  form.mordidaCruzadaIzq?.value || ''
        },
        anomaliasDentarias: {
          dientesAusentes:     form.dientesAusentes?.value || '',
          dientesMalformados:  form.dientesMalformados?.value || '',
          dientesGiroversion:  form.dientesGiroversion?.value || '',
          dientesInfraversion: form.dientesInfraversion?.value || '',
          dientesSupraversion: form.dientesSupraversion?.value || '',
          dientesPigmentados:  form.dientesPigmentados?.value || ''
        },
        arcadasIndividuales: {
          arcadaSuperior: form.querySelector('[name="arcada_sup"]:checked')?.value || '',
          arcadaInferior: form.querySelector('[name="arcada_inf"]:checked')?.value || ''
        }
      },

      indicesValorativos: {
        pontMaxilar: {
          premaxila: {
            nc:  form.pontPremaxilaNC?.value || '',
            pac: form.pontPremaxilaPac?.value || '',
            dif: form.pontPremaxilaDif?.value || ''
          },
          premolares: {
            nc:  form.pontPremolaresNC?.value || '',
            pac: form.pontPremolaresPac?.value || '',
            dif: form.pontPremolaresDif?.value || ''
          },
          molares: {
            nc:  form.pontMolaresNC?.value || '',
            pac: form.pontMolaresPac?.value || '',
            dif: form.pontMolaresDif?.value || ''
          }
        },
        pontMandibular: {
          premolares: {
            pac: form.pontMandPremolaresPac?.value || '',
            dif: form.pontMandPremolaresDif?.value || ''
          },
          molares: {
            pac: form.pontMandMolaresPac?.value || '',
            dif: form.pontMandMolaresDif?.value || ''
          }
        },
        sumaIncisivos:     form.sumaIncisivos?.value || '',
        boltonSuperiores:  Array.from(form.querySelectorAll('[placeholder^="1"]')).map(i => i.value || ''),
        boltonInferiores:  Array.from(form.querySelectorAll('[placeholder^="4"],[placeholder^="3"]')).map(i => i.value || ''),
        diferenciaBolton:  form.diferenciaBolton?.value || '',
        longitudArco: {
          apinamiento:       form.apinamiento?.value || '',
          protrusionDental:  form.protrusionDental?.value || '',
          curvaSpee:         form.curvaSpee?.value || '',
          totalLongitud:     form.totalLongitud?.value || ''
        }
      },

      planTratamiento: {
        ortopediaMaxilar:   form.ortopediaMaxilar?.value || '',
        ortopediaMandibula: form.ortopediaMandibula?.value || '',
        dientesInfIncisivo: form.dientesInfIncisivo?.value || '',
        dientesInfMolar:    form.dientesInfMolar?.value || '',
        dientesSupMolar:    form.dientesSupMolar?.value || '',
        dientesSupIncisivo: form.dientesSupIncisivo?.value || '',
        dientesSupEstetica: form.dientesSupEstetica?.value || '',
        anclaje: {
          maxilar:    form.querySelector('[name="anclaje_max"]:checked')?.value || '',
          mandibular: form.querySelector('[name="anclaje_man"]:checked')?.value || ''
        }
      },

      analisisCefalometrico: {
        biotipoFacial: [],
        claseEsqueletica: [],
        problemasVerticales: [],
        factoresDentales: [],
        diagnosticoCefalometrico: form.diagnosticoCefalometrico?.value || ''
      },

      factoresComplementarios: {
        claseII: [],
        claseIII: [],
        verticales: []
      },

      analisisJaraback: [],
      medidasLineales: [],
      analisisMcNamara: []
    };

    // Tablas dinámicas
    const extraerTabla = (selector, campos) =>
      Array.from(form.querySelectorAll(selector)).map(row => {
        const celdas = row.querySelectorAll('input, textarea');
        const obj = {};
        campos.forEach((campo, i) => (obj[campo] = celdas[i]?.value || ''));
        return obj;
      });

    data.analisisCefalometrico.biotipoFacial     = extraerTabla('#biotipoFacial tbody tr', ['factor','nc','paciente','diferencia','dc','resultado']);
    data.analisisCefalometrico.claseEsqueletica  = extraerTabla('#claseEsqueletica tbody tr', ['factor','nc','paciente','dc']);
    data.analisisCefalometrico.problemasVerticales = extraerTabla('#problemasVerticales tbody tr', ['factor','nc','paciente','dc']);
    data.analisisCefalometrico.factoresDentales  = extraerTabla('#factoresDentales tbody tr', ['factor','nc','paciente','dc']);

    data.factoresComplementarios.claseII = extraerTabla('#claseII tbody tr', ['factor','nc','paciente','dc']);
    data.factoresComplementarios.claseIII = extraerTabla('#claseIII tbody tr', ['factor','nc','paciente','dc']);
    data.factoresComplementarios.verticales = extraerTabla('#verticales tbody tr', ['factor','nc','paciente','dc']);

    data.analisisJaraback   = extraerTabla('#jaraback tbody tr', ['factor','nc','paciente','dc']);
    data.medidasLineales    = extraerTabla('#medidasLineales tbody tr', ['factor','nc','paciente','dc']);
    data.analisisMcNamara   = extraerTabla('#mcnamara tbody tr', ['factor','nc','paciente','dc']);

    console.log('📋 Datos ortodoncia a enviar:', data);

    try {
      const resp = await fetch('/api/pdf/ortodoncia/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('❌ Error al generar PDF:', err);
      alert('No se pudo generar el PDF. Revisa la consola.');
    }
  }, true); // <<---- CAPTURE: true
});
