'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), { spawn } = require('node:child_process');
const delay = ms => new Promise(r => setTimeout(r, ms));
class CDP {
    constructor(socket) { this.socket = socket; this.id = 0; this.pending = new Map(); this.events = []; socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id) {
        const p = this.pending.get(data.id);
        if (p) {
            this.pending.delete(data.id);
            clearTimeout(p.timer);
            data.error ? p.reject(new Error(JSON.stringify(data.error))) : p.resolve(data.result);
        }
    }
    else
        this.events.push(data); }); }
    send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout ' + method)); }, 30000); this.pending.set(id, { resolve, reject, timer }); this.socket.send(JSON.stringify({ id, method, params, sessionId })); }); }
    async evaluate(expression, sessionId) { const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); if (r.exceptionDetails)
        throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
    close() { for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('closed'));
    } this.pending.clear(); this.socket.close(); }
}
async function launch() {
    const root = path.resolve(__dirname, '..'), preview = path.join(root, 'dist/preview');
    const server = http.createServer((req, res) => { const name = new URL(req.url, 'http://localhost').pathname; const file = path.join(preview, name === '/' ? 'index.html' : name.slice(1)); if (!file.startsWith(preview + path.sep)) {
        res.writeHead(403).end();
        return;
    } fs.readFile(file, (e, b) => { if (e) {
        res.writeHead(404).end();
        return;
    } res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wav') ? 'audio/wav' : 'text/html; charset=utf-8'); res.end(b); }); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    fs.mkdirSync(path.join(root, 'work'), { recursive: true });
    const profile = fs.mkdtempSync(path.join(root, 'work/browser-' + process.pid + '-'));
    const exe = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const child = spawn(exe, ['--headless', '--disable-gpu', '--in-process-gpu', '--no-sandbox', '--disable-features=RendererCodeIntegrity', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', b => stderr += b.toString());
    let cdp;
    try {
        const active = path.join(profile, 'DevToolsActivePort');
        let port;
        for (let i = 0; i < 200; i++) {
            try {
                if (fs.existsSync(active)) {
                    port = fs.readFileSync(active, 'utf8').split('\n')[0];
                    if (port)
                        break;
                }
            }
            catch (e) {
                if (e.code !== 'EBUSY')
                    throw e;
            }
            if (child.exitCode !== null)
                throw new Error('Browser exited ' + stderr);
            await delay(100);
        }
        if (!port)
            throw new Error('Browser did not start: ' + stderr);
        const version = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
        const ws = new WebSocket(version.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
        cdp = new CDP(ws);
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }), { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send('Page.enable', {}, sessionId);
        return { cdp, sessionId, url: 'http://127.0.0.1:' + server.address().port, version: version.Browser, async close() { try {
                await cdp.send('Browser.close');
            }
            catch { } cdp.close(); child.kill(); await new Promise(r => server.close(r)); } };
    }
    catch (e) {
        cdp?.close();
        child.kill();
        server.close();
        throw new Error(e.message + '\nBrowser diagnostics: ' + stderr.slice(-3000));
    }
}
module.exports = { launch, delay };
