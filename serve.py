# A local server for the site: like "python -m http.server 8000", but it tells the browser to check every file
# for changes on each reload, so whatever you edit always shows up. (With plain http.server the browser may keep
# using an old copy for hours, and Ctrl+Shift+R doesn't refresh the files the game loads later, like the buildings.)
#
#   python serve.py         then open http://localhost:8000   (Ctrl+C stops it)
#   python serve.py 8001    to use another port

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    # Stockfish (the Chess House's opponent) is WebAssembly; older Pythons don't know its type.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm'}

    def end_headers(self):
        # "no-cache" still lets the browser keep files, but it must ask first; unchanged files cost almost nothing.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=str(Path(__file__).resolve().parent))  # this folder, wherever it's run from
    with ThreadingHTTPServer(('', port), handler) as server:
        print(f'Serving the site on http://localhost:{port} (Ctrl+C to stop)')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
