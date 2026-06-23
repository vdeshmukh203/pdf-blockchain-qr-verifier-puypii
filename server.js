'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 7432;
const DIR = __dirname;
const autoOpen = !process.argv.includes('--no-open');
const CONFIG = path.join(DIR, 'config.json');
const HTML = path.join(DIR, 'blockchain-verifier.html');

const CALENDARS = [
  'alice.btc.calendar.opentimestamps.org',
  'bob.btc.calendar.opentimestamps.org',
  'finney.calendar.eternitywall.com',
];

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (_) { return {}; }
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG, JSON.stringify(data, null, 2), 'utf8');
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` :
              process.platform === 'darwin' ? `open "${url}"` :
              `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function otsRequest(host, hashHex) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(hashHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const req = https.request({
      hostname: host, path: '/digest', method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length },
      timeout: 15000
    }, res => {
      if (res.statusCode === 200 || res.statusCode === 201) resolve(`https://${host}`);
      else reject(new Error(`Status ${res.statusCode}`));
      res.resume();
    });
    req.on('timeout', () => req.destroy());
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function readBody(req) {
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => s += c);
    req.on('end', () => resolve(s));
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // Serve HTML
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    try {
      const html = fs.readFileSync(HTML, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      });
      res.end(html);
    } catch (_) {
      const page = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Setup needed</title>
<style>body{font-family:sans-serif;background:#0f1923;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#1f2937;border:1px solid #374151;border-radius:12px;padding:32px 36px;max-width:540px;line-height:1.6}
h2{color:#d4a017;margin-top:0;font-size:18px}code{background:#111827;padding:2px 8px;border-radius:4px;font-family:monospace;font-size:13px;word-break:break-all}
ul{padding-left:20px}li{margin:8px 0}a{color:#60a5fa}</style></head>
<body><div class="box">
<h2>&#9888; blockchain-verifier.html not found</h2>
<p>The server is running but cannot find the app file.<br>It is looking for:</p>
<p><code>${HTML}</code></p>
<p><strong>Fix:</strong> Make sure <code>blockchain-verifier.html</code> and <code>server.js</code> are in the <strong>same folder</strong>, then restart the server.</p>
<ul>
<li>Put all 5 files together in one folder:<br><code>blockchain-verifier.html &nbsp; server.js &nbsp; server.py &nbsp; start.bat &nbsp; start.sh</code></li>
<li>Double-click <code>start.bat</code> (Windows) or run <code>./start.sh</code> (Mac/Linux) from that folder</li>
<li>The browser will open <code>http://localhost:7432</code> automatically</li>
</ul>
</div></body></html>`;
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page);
    }
    return;
  }

  if (req.method !== 'POST') { res.writeHead(404); res.end('Not found'); return; }

  let data;
  try { data = JSON.parse(await readBody(req)); } catch (_) { res.writeHead(400); res.end('{}'); return; }

  const json = (obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  };

  // OTS proxy
  if (url === '/api/ots') {
    const hash = data.hash || '';
    if (!/^[0-9a-f]{64}$/.test(hash)) { json({ ok: false, error: 'Invalid hash' }); return; }
    for (const host of CALENDARS) {
      try { json({ ok: true, calendar: await otsRequest(host, hash) }); return; } catch (_) {}
    }
    json({ ok: false, error: 'All calendars unreachable' });
    return;
  }

  // Auth
  if (url === '/api/auth') {
    const cfg = readConfig();
    if (data.action === 'check') {
      const hasPassword = !!cfg.pw_hash;
      if (!hasPassword) { json({ ok: false, hasPassword: false }); return; }
      json({ ok: cfg.pw_hash === data.hash, hasPassword: true });
      return;
    }
    if (data.action === 'set') {
      cfg.pw_hash = data.hash || '';
      writeConfig(cfg);
      json({ ok: true });
      return;
    }
    json({ ok: false, error: 'Unknown action' });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Blockchain Verifier running at ${url}`);
  console.log('Press Ctrl+C to stop.\n');
  console.log('IMPORTANT: If Windows Firewall asks "Allow Node.js?", click Allow.');
  console.log('           This is needed for Bitcoin (OTS) anchoring to work.\n');
  if (autoOpen) setTimeout(() => openBrowser(url), 500);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Is the server already running?`);
  else console.error(err.message);
  process.exit(1);
});
