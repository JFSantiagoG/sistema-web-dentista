const express = require('express');
const appointmentsRoutes = require('./routes/appointments.routes');
require('dotenv').config();

const app = express();
app.use(express.json());

app.use('/appointments', appointmentsRoutes);


app.listen(3002, () => {
  console.log('Appointments service running on port 3002');
});
