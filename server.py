#!/usr/bin/env python3
"""Blockchain Verifier — local server (Python fallback, no pip required)."""
import http.server
import json
import os
import ssl
import sys
import threading
import urllib.request
import webbrowser

PORT = 7432
DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(DIR, 'config.json')
HTML = os.path.join(DIR, 'blockchain-verifier.html')

CALENDARS = [
    'alice.btc.calendar.opentimestamps.org',
    'bob.btc.calendar.opentimestamps.org',
    'finney.calendar.eternitywall.com',
]


def read_config():
    try:
        with open(CONFIG, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def write_config(data):
    with open(CONFIG, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def ots_request(host, hash_hex):
    body = bytes(int(hash_hex[i:i+2], 16) for i in range(0, 64, 2))
    req = urllib.request.Request(
        f'https://{host}/digest', data=body,
        headers={'Content-Type': 'application/octet-stream'}, method='POST')
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        if resp.status in (200, 201):
            return f'https://{host}'
    raise Exception(f'Status {resp.status}')


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            try:
                with open(HTML, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except Exception:
                self.send_response(404); self.end_headers()
        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length).decode()
        try:
            data = json.loads(raw)
        except Exception:
            self.send_response(400); self.end_headers(); return

        if self.path == '/api/ots':
            hash_hex = data.get('hash', '')
            if len(hash_hex) != 64 or not all(c in '0123456789abcdef' for c in hash_hex):
                self.send_json({'ok': False, 'error': 'Invalid hash'}, 400); return
            for host in CALENDARS:
                try:
                    self.send_json({'ok': True, 'calendar': ots_request(host, hash_hex)}); return
                except Exception:
                    pass
            self.send_json({'ok': False, 'error': 'All calendars unreachable'})
            return

        if self.path == '/api/auth':
            cfg = read_config()
            action = data.get('action')
            if action == 'check':
                has_pw = bool(cfg.get('pw_hash'))
                if not has_pw:
                    self.send_json({'ok': False, 'hasPassword': False}); return
                self.send_json({'ok': cfg['pw_hash'] == data.get('hash', ''), 'hasPassword': True})
                return
            if action == 'set':
                cfg['pw_hash'] = data.get('hash', '')
                write_config(cfg)
                self.send_json({'ok': True})
                return
            self.send_json({'ok': False, 'error': 'Unknown action'}, 400)
            return

        self.send_response(404); self.end_headers()


if __name__ == '__main__':
    try:
        httpd = http.server.HTTPServer(('127.0.0.1', PORT), Handler)
    except OSError as e:
        print(f'Error: {e}'); sys.exit(1)
    url = f'http://localhost:{PORT}'
    print(f'Blockchain Verifier running at {url}')
    print('Press Ctrl+C to stop.')
    if '--no-open' not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
