const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !['.html', '.js', '.css', '.svg', '.ico', '.png', '.webp'].includes(path.extname(file))) { res.writeHead(404).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.webp': 'image/webp' };
    res.writeHead(200, { 'Content-Type': type[path.extname(file)], 'Cache-Control': 'no-cache' });
    res.end(content);
  });
}).listen(port, '127.0.0.1', () => console.log(`Данциг: http://127.0.0.1:${port}`));
