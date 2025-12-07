const express = require('express');
const pacientesRoutes = require('./routes/pacientes.routes');
const { sanitizeBody } = require('./middlewares/sanitizeBody');
require('dotenv').config();

const app = express();

app.use(express.json({ limit: '5mb' }));

app.use(
  sanitizeBody({
    maxLength: 500000,
    escapeHtml: true,
    trim: true
  })
);

app.use('/patients', pacientesRoutes);

app.listen(3003, () => {
  console.log('Patients service running on port 3003');
});

app.requestTimeout = 0;  
app.headersTimeout = 0;