require('dotenv').config();
const express = require('express');
const whatsappRoutes = require('./routes/whatsapp.routes');

const app = express();
app.use(express.json());

// 👇 SIN prefijo, se montan directo en /
app.use('/', whatsappRoutes);

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'whatsapp-service' });
});

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
  console.log(`📲 whatsapp-service escuchando en puerto ${PORT}`);
});
