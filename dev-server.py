"""Local dev server for the PT. Panji Bali Teknik static site.

Serves the site exactly like `python -m http.server`, but adds one extra
endpoint so the admin dashboard can write changes directly to
assets/js/data.js on disk instead of only saving to the browser's
localStorage.

This /api/save-data endpoint only exists here, in this local Python dev
server — it's for local editing/testing only.

For production hosting with real PHP support (e.g. Hostinger shared
hosting), api/save-data.php does the equivalent job server-side: once that
file is uploaded alongside the rest of the site, "Simpan Perubahan" writes
straight to assets/js/data.js on the live server automatically, with no
per-device setup. On hosts without PHP (GitHub Pages, Netlify static-only,
etc.), the admin dashboard falls back to the GitHub API sync (if configured)
or localStorage-only + the "Unduh data.js" manual-publish flow.

Run: python dev-server.py
Then open: http://localhost:8000/admin.html
"""
import http.server
import json
import os

PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_JS_PATH = os.path.join(ROOT, 'assets', 'js', 'data.js')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        if self.path == '/api/save-data':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                data = json.loads(body)
                js_content = 'window.SITE_DEFAULTS = ' + json.dumps(data, indent=4, ensure_ascii=False) + ';\n'
                with open(DATA_JS_PATH, 'w', encoding='utf-8') as f:
                    f.write(js_content)
                self._send_json(200, {'ok': True})
            except Exception as e:
                self._send_json(500, {'ok': False, 'error': str(e)})
        else:
            self.send_error(404, 'Not found')

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # Same-origin only (admin.html and this server share host:port), so
        # no CORS headers are needed; kept minimal on purpose.
        super().end_headers()


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('', PORT), Handler) as httpd:
        print(f'PT. Panji Bali Teknik dev server running at http://localhost:{PORT}')
        print(f'Admin dashboard: http://localhost:{PORT}/admin.html')
        print('Saving in the admin dashboard now writes directly to assets/js/data.js.')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')
