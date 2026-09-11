'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
require('./build.cjs').build();
const root = path.resolve(__dirname, '../dist/preview');
const server = http.createServer((req, res) => { let p; try {
    p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
}
catch {
    res.writeHead(400).end();
    return;
} if (p === root)
    p = path.join(root, 'index.html'); if (!p.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
} fs.readFile(p, (e, b) => { if (e) {
    res.writeHead(404).end();
    return;
} res.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript; charset=utf-8' : p.endsWith('.wav') ? 'audio/wav' : 'text/html; charset=utf-8'); res.end(b); }); });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Local game harness http://127.0.0.1:' + server.address().port));
