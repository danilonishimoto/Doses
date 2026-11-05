import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const cert = fs.readFileSync('certs/server.crt');
const key = fs.readFileSync('certs/server.key');
const ca = fs.readFileSync('certs/ca.crt');

// 1. Servidor HTTP simples na porta 5175 exclusivamente para baixar a Autoridade Certificadora (CA)
const caServer = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/x-x509-ca-cert',
    'Content-Disposition': 'attachment; filename="doses-ca.crt"',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(ca);
});

caServer.listen(5175, '0.0.0.0', () => {
  console.log('[CA Download HTTP] Disponível em http://192.168.68.103:5175/doses-ca.crt');
});

// 2. Servidor HTTPS Reverso na porta 8443 com certificado SAN válido
const httpsProxy = https.createServer({ key, cert }, (req, res) => {
  if (req.url === '/doses-ca.crt') {
    res.writeHead(200, {
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="doses-ca.crt"'
    });
    return res.end(ca);
  }

  const clientReq = http.request({
    hostname: '127.0.0.1',
    port: 5173,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:5173',
      'x-forwarded-proto': 'https'
    }
  }, (clientRes) => {
    res.writeHead(clientRes.statusCode, clientRes.headers);
    clientRes.pipe(res);
  });

  clientReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro no Proxy Gateway: ' + err.message);
  });

  req.pipe(clientReq);
});

// Upgrade para WebSockets (Vite HMR)
httpsProxy.on('upgrade', (req, socket, head) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: 5173,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:5173'
    }
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => {
    socket.destroy();
  });

  proxyReq.end();
});

const HTTPS_PORT = 8443;
httpsProxy.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`[PWA Mobile HTTPS] Ativo em https://192.168.68.103:${HTTPS_PORT}`);
});
