#!/usr/bin/env python3
"""
Tiny zero-dependency web server to hand the Minimal Alarm APK to your phone.

No ADB, no USB. Your phone and this computer just need to be on the same
Wi-Fi / LAN. Run it, then open the printed http://<ip>:<port> URL on your
phone's browser and tap Download.

    python3 serve_apk.py            # auto-finds the newest built APK
    python3 serve_apk.py path.apk  # serve a specific APK
    PORT=9000 python3 serve_apk.py  # custom port (default 8000)
"""
import http.server
import io
import os
import socket
import sys
import glob

PORT = int(os.environ.get("PORT", "8000"))
DOWNLOAD_NAME = "MinimalAlarm.apk"
HERE = os.path.dirname(os.path.abspath(__file__))


def find_apk() -> str:
    if len(sys.argv) > 1:
        candidate = os.path.abspath(sys.argv[1])
        if not os.path.isfile(candidate):
            sys.exit(f"APK not found: {candidate}")
        return candidate
    # Prefer a release APK: it embeds the JS bundle and runs standalone. A debug
    # APK has NO bundle and needs Metro — installing it gives the dreaded
    # "Unable to load script" screen. So we only fall back to debug if there is
    # no release, and we warn loudly.
    release = glob.glob(os.path.join(HERE, "android/app/build/outputs/apk/release/*.apk"))
    debug = glob.glob(os.path.join(HERE, "android/app/build/outputs/apk/debug/*.apk"))
    if release:
        chosen = max(release, key=os.path.getmtime)
    elif debug:
        chosen = max(debug, key=os.path.getmtime)
        print("\n  ⚠️  Only a DEBUG APK was found. It needs Metro running and will")
        print("      show 'Unable to load script' on the phone. Build a release:")
        print("      JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./android/gradlew -p android \\")
        print("        assembleRelease -PreactNativeArchitectures=arm64-v8a\n")
    else:
        sys.exit("No APK found. Build a release first (see README) or pass a path.")
    warn_if_no_bundle(chosen)
    return chosen


def warn_if_no_bundle(apk: str):
    """Guard against serving an APK with no embedded JS bundle."""
    import zipfile

    try:
        with zipfile.ZipFile(apk) as zf:
            names = zf.namelist()
    except zipfile.BadZipFile:
        sys.exit(f"APK is not a valid zip: {apk}")
    if not any(n.endswith("index.android.bundle") for n in names):
        print("\n  ⚠️  WARNING: this APK has no embedded JS bundle — it will need")
        print("      Metro and show 'Unable to load script'. Use a release build.\n")


def lan_ips() -> list:
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # no packets actually sent
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass
    return sorted(ips)


APK_PATH = find_apk()
APK_SIZE = os.path.getsize(APK_PATH)
APK_MB = APK_SIZE / (1024 * 1024)


def landing_html() -> bytes:
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Minimal Alarm</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family:-apple-system,Roboto,Segoe UI,sans-serif;
    background:linear-gradient(160deg,#356AE6,#2D4AA5 55%,#202C60);
    min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }}
  .card {{ background:#fff; border-radius:28px; padding:34px 26px; max-width:380px; width:100%;
    box-shadow:0 24px 60px rgba(11,18,32,.28); text-align:center; }}
  .badge {{ width:72px; height:72px; border-radius:24px; margin:0 auto 18px;
    background:linear-gradient(160deg,#356AE6,#2D4AA5); display:flex; align-items:center;
    justify-content:center; font-size:34px; color:#fff; }}
  .eyebrow {{ letter-spacing:2px; font-size:11px; font-weight:800; color:#356AE6; }}
  h1 {{ font-size:26px; margin:8px 0 6px; color:#151922; letter-spacing:-.5px; }}
  p {{ color:#707783; font-size:15px; line-height:1.5; margin:0 0 22px; }}
  a.dl {{ display:block; background:#356AE6; color:#fff; text-decoration:none; font-weight:700;
    font-size:17px; padding:16px; border-radius:16px; }}
  a.dl:active {{ background:#2D4AA5; }}
  .meta {{ margin-top:14px; font-size:12px; color:#A9B0AA; }}
  ol {{ text-align:left; color:#707783; font-size:13px; line-height:1.7; margin:20px 4px 0;
    padding-left:20px; }}
</style></head>
<body>
  <div class="card">
    <div class="badge">✦</div>
    <div class="eyebrow">MINIMAL ALARM</div>
    <h1>Install on this phone</h1>
    <p>A calmer way to wake. Tap below to download, then open the file to install.</p>
    <a class="dl" href="/{DOWNLOAD_NAME}" download>Download APK ({APK_MB:.0f} MB)</a>
    <div class="meta">arm64 build · {os.path.basename(APK_PATH)}</div>
    <ol>
      <li>Tap <b>Download APK</b> above.</li>
      <li>Open the downloaded file.</li>
      <li>If prompted, allow installing from this browser, then tap <b>Install</b>.</li>
    </ol>
  </div>
</body></html>""".encode("utf-8")


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stdout.write(" · " + (fmt % args) + "\n")

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            body = landing_html()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/" + DOWNLOAD_NAME:
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.android.package-archive")
            self.send_header("Content-Disposition", f'attachment; filename="{DOWNLOAD_NAME}"')
            self.send_header("Content-Length", str(APK_SIZE))
            self.end_headers()
            with open(APK_PATH, "rb") as fh:
                self._copy(fh)
            return
        self.send_error(404, "Not found")

    def _copy(self, fh):
        while True:
            chunk = fh.read(64 * 1024)
            if not chunk:
                break
            try:
                self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break


def serve_on_free_port(start: int):
    """Bind `start`, or the next free port after it if that one is busy."""
    for port in range(start, start + 25):
        try:
            server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
            return server, port
        except OSError as err:
            if err.errno == 98:  # EADDRINUSE
                print(f"  Port {port} is in use, trying {port + 1}…")
                continue
            raise
    sys.exit(f"No free port found in range {start}-{start + 24}. Set PORT=<n>.")


def main():
    server, port = serve_on_free_port(PORT)
    ips = lan_ips()
    bar = "─" * 52
    print("\n" + bar)
    print("  Minimal Alarm — APK download server")
    print(bar)
    print(f"  Serving : {APK_PATH}")
    print(f"  Size    : {APK_MB:.1f} MB")
    print("\n  On your phone's browser (same Wi-Fi), open:")
    if ips:
        for ip in ips:
            print(f"      →  http://{ip}:{port}")
    else:
        print(f"      →  http://<this-computer-ip>:{port}")
    print(f"\n  Also on this computer:  http://localhost:{port}")
    print("\n  Press Ctrl+C to stop.")
    print(bar + "\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
