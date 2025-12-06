const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 8080;

app.use((req, res, next) => {
  // 10 minutos (en ms)
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);
  next();
});

// 🔐 Auth Service — SIN pathRewrite
app.use('/auth', createProxyMiddleware({
  target: 'http://localhost:3005',
  changeOrigin: true
}));


// 📋 Forms Service
app.use('/api/forms', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true
}));

// 📅 Appointments Service
app.use('/api/appointments', createProxyMiddleware({
  target: 'http://localhost:3002/appointments',
  changeOrigin: true,
  pathRewrite: { '^/api/appointments': '' }
}));


// 👤 Patients Service
app.use('/api/patients', createProxyMiddleware({
  target: 'http://localhost:3003/patients',
  changeOrigin: true,
  pathRewrite: { '^/api/patients': '' },
  timeout: 0,       
  proxyTimeout: 0,
}));

// 📲 WhatsApp Service
app.use('/api/whatsapp', createProxyMiddleware({
  target: 'http://localhost:3007',
  changeOrigin: true,
  pathRewrite: { '^/api/whatsapp': '' }
}));


// 📁 Files Service
app.use('/api/files', createProxyMiddleware({
  target: 'http://localhost:3004',
  changeOrigin: true
}));

// 📄 PDF Generator
app.use('/api/pdf', createProxyMiddleware({
  target: 'http://localhost:3006',
  changeOrigin: true
}));

// 🖼️ Visualizador Flask
app.use('/static', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true,
  pathRewrite: { '^/static': '/static' }
}));

app.use('/visualizador', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true,
  pathRewrite: { '^/visualizador': '' }
}));

app.use('/uploads', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true
}));

// 🌐 Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// 🏠 Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
  //
});

// 🚀 Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Gateway corriendo en http://localhost:${PORT}`);
});
