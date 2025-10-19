const express = require('express');
const pacientesRoutes = require('./routes/pacientes.routes');
require('dotenv').config();
const app = express();
app.use(express.json());


app.use('/patients', pacientesRoutes);

app.listen(3003, () => {
  console.log('Patients service running on port 3003');
});
