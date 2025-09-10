const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static('public'));

// Lista de formularios
const FORMULARIOS = [
    "Hoja de Evolución",
    "Odontograma Final",
    "Historia Clínica de Ortodoncia",
    "Receta Médica",
    "Presupuesto",
    "Tríptico Postoperatorio",
    "Justificante",
    "Historia Clínica",
    "Consentimiento Quirúrgico",
    "Consentimiento Odontológico",
    "Diagnóstico y Plan - PX Infantil"
];

// GET /api/forms/list → devuelve lista de formularios
app.get('/list', (req, res) => {
    res.json(FORMULARIOS);
});

// GET /api/forms/:id → devuelve HTML del formulario
app.get('/:id', (req, res) => {
    const id = req.params.id;
    const index = parseInt(id) - 1;

    if (index < 0 || index >= FORMULARIOS.length) {
        return res.status(404).send('Formulario no encontrado');
    }

    const nombre = FORMULARIOS[index];
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${nombre}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="bg-light">
            <div class="container py-5">
                <h1 class="text-center mb-4">${nombre}</h1>
                <div class="bg-white p-4 rounded shadow">
                    <form>
                        <div class="mb-3">
                            <label class="form-label">Nombre del Paciente</label>
                            <input type="text" class="form-control">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Fecha</label>
                            <input type="date" class="form-control">
                        </div>
                        <!-- Aquí irían los campos específicos de cada formulario -->
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </form>
                </div>
                <div class="text-center mt-4">
                    <a href="/" class="btn btn-outline-secondary">← Volver al inicio</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`📄 Servicio de formularios corriendo en http://localhost:${PORT}`);
});
