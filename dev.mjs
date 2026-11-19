import { execFileSync } from 'node:child_process';
import { watch } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { migrateLocal } from './migrate.mjs';
import { accountApi, seedLocalDemo } from './account-api.mjs';

const sqlite = new DatabaseSync('local.sqlite');
migrateLocal(sqlite);
const DB={prepare(sql){const s=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this},async all(){return {results:s.all(...values)}},async first(){return s.get(...values)},async run(){return s.run(...values)}}}};

const clients = new Set();
await seedLocalDemo(DB);
let version = Date.now();
let worker = (await import('./dist/server/index.js')).default;

async function rebuild() {
  try {
    execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
    const nextVersion = version + 1;
    worker = (await import('./dist/server/index.js?v=' + nextVersion)).default;
    version = nextVersion;
    for (const client of clients) client.write('data: ' + version + '\n\n');
  } catch (error) {
    console.error('Preview menunggu perbaikan file.', error.message);
  }
}

let timer;
const inputs = new Set(['index.html', 'theme.css', 'motion.css', 'account.js', 'button.js', 'input.js', 'toggle.js', 'toast.js', 'motion.js', 'build.mjs', '.env.local']);
function queueBuild() {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 150);
}
watch('.', (_, file) => { if (!file || inputs.has(file)) queueBuild(); });
watch('worker', (_, file) => { if (!file || file === 'api.js') queueBuild(); });

let port = 3000;
const server = createServer(async (req, res) => {
  if (req.url === '/__preview/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    res.write('data: ' + version + '\n\n');
    clients.add(res);
    res.on('close', () => clients.delete(res));
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const url = 'http://localhost:' + port + req.url;
    const request = new Request(url, { method: req.method, headers: req.headers,
      ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
    const pageVersion = version;
    const response = req.url.startsWith('/api/account/')
      ? await accountApi(request, DB, req.socket.remoteAddress)
      : await worker.fetch(request, { DB });
    res.writeHead(response.status, { ...Object.fromEntries(response.headers), 'Cache-Control': 'no-store' });
    if (response.headers.get('Content-Type')?.startsWith('text/html')) {
      const reload = '<script>const previewEvents=new EventSource("/__preview/events");previewEvents.onmessage=e=>{if(Number(e.data)!==' + pageVersion + '){previewEvents.close();location.reload()}}</script>';
      res.end((await response.text()).replace('</body>', () => reload + '</body>'));
    } else {
      res.end(Buffer.from(await response.arrayBuffer()));
    }
  } catch {
    res.writeHead(500);
    res.end('Server error');
  }
});

server.on('error', error => {
  if (error.code !== 'EADDRINUSE' || port >= 3010) {
    console.error('Preview gagal dijalankan:', error.message);
    process.exit(1);
  }
  console.log(`Port ${port} sedang dipakai. Mencoba port ${port + 1}…`);
  server.listen(++port);
});
server.on('listening', () => console.log('R4hasiakuu: http://localhost:' + port));
server.listen(port);
