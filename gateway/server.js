const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 8080;

app.use('/static', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true,
  pathRewrite: { '^/static': '/static' }
}));

// 2. Proxy para visualizador
app.use('/visualizador', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true,
  pathRewrite: { '^/visualizador': '' }
}));

// 3. Proxy para uploads
app.use('/uploads', createProxyMiddleware({
  target: 'http://localhost:3010',
  changeOrigin: true
}));

// Otros microservicios (si los usas)
app.use('/api/forms', createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }));
app.use('/api/appointments', createProxyMiddleware({ target: 'http://localhost:3002', changeOrigin: true }));
app.use('/api/patients', createProxyMiddleware({ target: 'http://localhost:3003', changeOrigin: true }));
app.use('/api/files', createProxyMiddleware({ target: 'http://localhost:3004', changeOrigin: true }));
app.use('/api/auth', createProxyMiddleware({ target: 'http://localhost:3005', changeOrigin: true }));
app.use('/api/pdf', createProxyMiddleware({ target: 'http://localhost:3006', changeOrigin: true }));

// Estáticos del gateway (solo para la raíz del gateway)
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Gateway corriendo en http://localhost:${PORT}`);
});
