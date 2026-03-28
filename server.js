const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4141;
const ROOT = path.join(__dirname, 'src');

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
};

const server = http.createServer((req, res) => {
  const filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ReqStack running at http://127.0.0.1:${PORT}`);
  // Auto-open browser
  const open = process.platform === 'win32' ? 'start' :
               process.platform === 'darwin' ? 'open' : 'xdg-open';
  require('child_process').exec(`${open} http://127.0.0.1:${PORT}`);
});