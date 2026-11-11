import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = new URL('../../apps/web/public', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = url.pathname === '/' ? '/test.html' : url.pathname;
  const full = file === '/test.html' ? new URL('./test.html', import.meta.url).pathname : path.join(root, file);
  if (!fs.existsSync(full)) { res.writeHead(404); res.end('no'); return; }
  const h = { 'content-type': types[path.extname(full)] ?? 'text/plain' };
  if (file === '/strudel/frame.html') {
    h['content-security-policy'] = "default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src blob:; connect-src 'none'; sandbox allow-scripts";
    h['permissions-policy'] = 'autoplay=(), camera=(), microphone=(), geolocation=()';
  }
  res.writeHead(200, h); res.end(fs.readFileSync(full));
}).listen(8123, () => console.log('up'));
