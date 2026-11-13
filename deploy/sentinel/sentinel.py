#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ogen-sentinel - מערכת זיהוי תקיפות בזמן אמת לאתר עוגן פליי.

איך זה עובד (ובלי לפגוע במהירות האתר):
  * רץ כתהליך נפרד לגמרי, ומנתח את לוג ה-JSON של nginx אחרי שהבקשה כבר נענתה - לא נמצא בנתיב הבקשה בכלל.
  * רץ בעדיפות נמוכה ומוגבל זיכרון/CPU ע"י systemd.
  * לכל כתובת IP נבנה פרופיל: אילו סוגי התקפה ניסתה, אילו נתיבים, באיזה כלי (User-Agent), ציון סיכון עם דעיכה.
  * משגר אירועים, מדדים ופרופילי תוקפים ל-Supabase (לוח הניהול קורא משם), וחוסם תוקפים ברורים דרך nftables
    (קרנל, לפני conntrack) עם חסימה זמנית מדורגת. חסימה לעולם לא חלה על רשת פנימית / רשימה לבנה.
  * מצב ברירת מחדל: observe (מתעד ולא חוסם); הפעלת חסימה אוטומטית מלוח הניהול (mode=enforce).

שימוש:
  sentinel.py                         # מצב חי (שירות)
  sentinel.py --replay FILE [...]     # הרצה על לוג היסטורי (nginx combined או JSON), בלי DB ובלי חסימות - לבדיקות
"""
import argparse, collections, gzip, http.client, ipaddress, json, os, re, signal, subprocess, sys, threading, time
from urllib.parse import unquote, urlsplit, parse_qsl

VERSION = "1.0"
CFG_PATH = os.environ.get("SENTINEL_CONFIG", "/etc/ogen-sentinel/config.json")
LOG_PATH = os.environ.get("SENTINEL_LOG", "/var/log/nginx/ogen_json.log")
KILL_SWITCH = "/etc/ogen-sentinel/DISABLE_BLOCK"

DEFAULTS = {
    "mode": "observe",                 # observe | enforce  (נשלט גם מלוח הניהול)
    "whitelist": ["127.0.0.0/8", "::1/128", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"],
    "block_score": 100,                # ציון שממנו חוסמים (במצב enforce)
    "block_seconds": [900, 3600, 86400, 604800],   # חסימה מדורגת לפי מספר פעמים שנחסם
    "max_blocks_per_min": 15,          # שסתום ביטחון נגד חסימות המוניות בטעות
    "safety_trip_blocks_10min": 120,   # יותר מזה -> חוזרים למצב observe ומתריעים
    "score_half_life_s": 600,
    "flood_req_10s": 300,              # בקשות "אמיתיות" (בלי קבצים סטטיים) ב-10 שניות מכתובת אחת (ה-nginx מגביל ל-15 לשנייה)
    "flood_429_60s": 60,
    "brute_fail_300s": 8,
    "notfound_distinct_60s": 20,
    "enum_distinct_60s": 15,
    "admin_probe_300s": 4,
    "slow_408_60s": 3,
    "supabase_url": "",                # נטען מ-/opt/ogen-play/.env.local אם ריק
    "supabase_key": "",
    "env_file": "/opt/ogen-play/.env.local",
    "flush_seconds": 2.0,
    "poll_seconds": 5.0,
    "own_hosts": ["ogenplay.com", "www.ogenplay.com", "api.ogenplay.com"],
}

# ---------------------------------------------------------------- סיווג התקפות
FAMILY = {
    "scan":        ("סריקת תשתית / קבצים רגישים", "recon"),
    "exploit":     ("ניסיון חדירה (Path Traversal / LFI / RFI / Log4Shell)", "code"),
    "sqli":        ("SQL Injection", "code"),
    "xss":         ("XSS (הזרקת סקריפט)", "code"),
    "cmdi":        ("הזרקת פקודות (RCE)", "code"),
    "ssrf":        ("ניסיון SSRF (כתובות פנימיות)", "code"),
    "bad_ua":      ("כלי תקיפה מוכר (User-Agent)", "recon"),
    "flood":       ("הצפת בקשות (HTTP Flood)", "ddos"),
    "slow":        ("התקפה איטית (Slowloris)", "ddos"),
    "brute":       ("ניחוש סיסמאות / Brute Force", "auth"),
    "admin_probe": ("ניסיון הסלמת הרשאות (נתיבי ניהול)", "auth"),
    "enum":        ("סריקת מזהים (IDOR / Enumeration)", "auth"),
    "recon404":    ("גילוי נתיבים (Directory Brute-force)", "recon"),
    "method":      ("שימוש חריג ב-HTTP (שיטה לא צפויה)", "recon"),
    "csrf":        ("חשד ל-CSRF (Origin זר בפעולה משנה מצב)", "auth"),
    "errors":      ("גרימת שגיאות שרת חוזרת (Fuzzing)", "code"),
    "volume":      ("עליית תנועה חריגה מבוזרת (DDoS אפשרי)", "ddos"),
    "stuffing":    ("חשד ל-Credential Stuffing מבוזר", "auth"),
}
POINTS = {"scan": 40, "exploit": 60, "sqli": 60, "xss": 60, "cmdi": 70, "ssrf": 30, "bad_ua": 80, "flood": 55,
          "slow": 40, "brute": 70, "admin_probe": 25, "enum": 40, "recon404": 50, "method": 25, "csrf": 8, "errors": 20}
# כמה מהנקודות נוספות כשמזהים שוב את אותו דבר תוך זמן ה-cooldown. הצפה/שיטה/CSRF לא מצטברות מהחזרות -
# כדי שמשתמש אמיתי עם התפרצות בקשות קצרה (למשל לולאת polling) לא ייחסם; תוקף אמיתי חוצה כמה חלונות זמן.
REPEAT = {"flood": 0.0, "method": 0.0, "csrf": 0.0, "slow": 0.0, "recon404": 0.05}
SEVERITY = {"scan": "medium", "exploit": "high", "sqli": "high", "xss": "high", "cmdi": "critical", "ssrf": "medium",
            "bad_ua": "medium", "flood": "high", "slow": "medium", "brute": "high", "admin_probe": "high",
            "enum": "medium", "recon404": "low", "method": "low", "csrf": "low", "errors": "low",
            "volume": "critical", "stuffing": "critical"}
TOOLS = [(re.compile(p, re.I), n) for p, n in [
    (r"sqlmap", "sqlmap"), (r"nikto", "Nikto"), (r"nmap", "Nmap"), (r"masscan", "Masscan"), (r"zgrab", "ZGrab"),
    (r"nuclei", "Nuclei"), (r"gobuster|dirbuster|dirb/|feroxbuster|ffuf", "Directory fuzzer"), (r"wpscan", "WPScan"),
    (r"acunetix|netsparker|burp", "Web scanner"), (r"hydra", "Hydra"), (r"python-requests", "Python script"),
    (r"curl/", "curl"), (r"go-http-client", "Go client"), (r"libwww|wget|java/", "Script client")]]

# תבניות (משקפות את nginx 04-ogen-security.conf, אבל על הכתובת המפוענחת - גם הצפנה כפולה)
RX = {
    "scan": re.compile(r"(?:^|/)\.(?:env|git|svn|hg|ds_store|htaccess|htpasswd|aws|ssh|bash_history|npmrc|docker)(?:$|[/?])|/(?:wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|wlwmanifest|phpmyadmin|pma/|adminer|cgi-bin|boaform|hnap1|actuator|solr/|jenkins|manager/html|vendor/phpunit|_ignition|server-status|console/|config\.json|backup\.(?:zip|sql|tar))|\.(?:php\d?|asp|aspx|jsp|jspx|cgi|sql|bak|swp|ini|yml|yaml|conf)(?:$|\?|/)", re.I),
    "exploit": re.compile(r"\$\{jndi:|\.\./\.\./|\.\.%2f|/etc/passwd|/etc/shadow|/proc/self|php://|expect://|zip://|phar://|data://text|file://|gopher://|ldap://|dict://", re.I),
    "sqli": re.compile(r"union(?:\s|\+|/\*.*?\*/)+(?:all\s+)?select|information_schema|sleep\(\s*\d|benchmark\(\s*\d|waitfor\s+delay|extractvalue\(|updatexml\(|pg_sleep\(|load_file\(|'\s*(?:or|and)\s+(?:'|\d)|'\s*(?:--|#)", re.I),
    "xss": re.compile(r"<script|javascript:|vbscript:|on(?:error|load|mouseover)\s*=|<svg|<iframe|<img[\s/]|document\.cookie|alert\(|<body", re.I),
    "cmdi": re.compile(r"(?:;|\||`|\$\()\s*(?:wget|curl|nc|ncat|bash|sh|cat|id|whoami|uname|ls|ping|powershell|cmd)(?:\s|;|$)", re.I),
    "ssrf": re.compile(r"169\.254\.169\.254|metadata\.google\.internal|(?:^|[=/])localhost[:/]|127\.0\.0\.1|0\.0\.0\.0|\[::1\]", re.I),
}
STATIC_RX = re.compile(r"^/(?:_next/static/|_next/image|api/cdn/|favicon|robots\.txt|sitemap|manifest|icons?/|images?/)")
# כשלי התחברות/אימות (ניחוש): רק כשלון ב-token של סיסמה, או באימות שלבי איפוס הסיסמה
AUTH_FAIL_RX = re.compile(r"^/api/sb/auth/v1/token|^/auth/v1/token|^/api/auth/reset-(?:verify|question|escalate|assistant)")
# נקודות קצה ששולחות מייל / חושפות קיום משתמש: סופרים כל בקשה (גם מוצלחת) - שימוש לרעה/ספאם/ניחוש כתובות
AUTH_SPAM_RX = re.compile(r"^/api/sb/auth/v1/(?:recover|otp|magiclink|resend)|^/auth/v1/(?:recover|otp)|^/api/auth/(?:reset-request|email-exists)")
ADMIN_RX = re.compile(r"^/api/admin/|^/dashboard/admin")
ID_RX = re.compile(r"^/api/[a-z0-9/_-]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
OK_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"}
COMBINED_RX = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"')
MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}

def epoch_utc(y, mo, d, h, mi, s):
    # ימים מאז 1970 (אלגוריתם civil-from-days)
    y -= mo <= 2
    era = (y if y >= 0 else y - 399) // 400
    yoe = y - era * 400
    doy = (153 * (mo + (-3 if mo > 2 else 9)) + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return (era * 146097 + doe - 719468) * 86400 + h * 3600 + mi * 60 + s

def parse_line(line):
    """מחזיר dict אחיד או None. תומך ב-JSON (ogen_json) וב-combined."""
    line = line.strip()
    if not line:
        return None
    if line[0] == "{":
        try:
            j = json.loads(line)
            t = j["t"]
            ts = epoch_utc(int(t[0:4]), int(t[5:7]), int(t[8:10]), int(t[11:13]), int(t[14:16]), int(t[17:19]))
            off = t[19:]
            if off and off[0] in "+-" and len(off) >= 6:
                sec = (int(off[1:3]) * 3600 + int(off[4:6]) * 60) * (1 if off[0] == "+" else -1)
                ts -= sec
            return {"ts": ts, "ip": j["ip"], "m": j["m"], "host": j.get("h", ""), "u": j["u"], "s": int(j["s"]), "b": j.get("b", 0),
                    "rt": float(j.get("rt") or 0), "ua": j.get("ua", ""), "org": j.get("org", ""), "ck": j.get("ck", "0") == "1",
                    "cs": j.get("cs", ""), "wf": j.get("wf", ""), "ba": j.get("ba", "0") == "1"}
        except Exception:
            return None
    m = COMBINED_RX.match(line)
    if not m:
        return None
    ip, tm, req, status, size, ref, ua = m.groups()
    try:
        d, mon, yh = tm.split("/")            # 12 / Nov / 2026:23:36:06 +0000  (הלוג הישן תמיד ב-UTC)
        ts = epoch_utc(int(yh[0:4]), MONTHS[mon], int(d), int(yh[5:7]), int(yh[8:10]), int(yh[11:13]))
        parts = req.split(" ")
        method = parts[0]
        uri = parts[1] if len(parts) > 1 else ""
    except Exception:
        return None
    return {"ts": ts, "ip": ip, "m": method, "host": "", "u": uri, "s": int(status), "b": 0, "rt": 0.0, "ua": ua, "org": "",
            "ck": False, "cs": "", "wf": "", "ba": False}

def deep_unquote(s):
    for _ in range(3):
        n = unquote(s)
        if n == s:
            break
        s = n
    return s

def tool_from_ua(ua):
    for rx, name in TOOLS:
        if rx.search(ua or ""):
            return name
    return ""

# ---------------------------------------------------------------- מצב לכל IP
class Attacker:
    __slots__ = ("ip", "first", "last", "hits", "score", "score_ts", "types", "samples", "uas", "paths", "statuses",
                 "reqs", "r429", "auth_fail", "nf_paths", "enum_ids", "admin_probe", "slow", "waf_hits", "err5",
                 "blocked_until", "block_count", "cool", "dirty", "static_n", "tool")
    def __init__(self, ip, ts):
        self.ip = ip; self.first = ts; self.last = ts; self.hits = 0; self.score = 0.0; self.score_ts = ts
        self.types = collections.Counter(); self.samples = []; self.uas = collections.Counter(); self.paths = collections.Counter()
        self.statuses = collections.Counter()
        self.reqs = collections.deque(); self.r429 = collections.deque(); self.auth_fail = collections.deque()
        self.nf_paths = collections.deque(); self.enum_ids = collections.deque(); self.admin_probe = collections.deque()
        self.slow = collections.deque(); self.waf_hits = collections.deque(); self.err5 = collections.deque()
        self.blocked_until = 0; self.block_count = 0; self.cool = {}; self.dirty = False; self.static_n = 0; self.tool = ""

def from_iso(s):
    """'2026-11-12T23:36:06Z' / '...+00:00' -> epoch (UTC)"""
    return epoch_utc(int(s[0:4]), int(s[5:7]), int(s[8:10]), int(s[11:13]), int(s[14:16]), int(s[17:19]))

def _trim(dq, cutoff):
    while dq:
        head = dq[0]
        t = head[0] if isinstance(head, tuple) else head
        if t < cutoff: dq.popleft()
        else: break

class Sentinel:
    def __init__(self, cfg, live=True):
        self.cfg = cfg; self.live = live
        self.A = {}                         # ip -> Attacker
        self.events = []                    # ממתינים לשליחה ל-DB
        self.dirty_attackers = set()
        self.whitelist_nets = [ipaddress.ip_network(x, strict=False) for x in cfg["whitelist"]]
        self.allow_ips = set()              # רשימה לבנה מהלוח
        self.blocked = {}                   # ip -> until
        self.block_times = collections.deque()
        self.minute = {}                    # דקה -> מדדים
        self.cur_min = None
        self.ewma_rps = None; self.ewma_auth = 0.5
        self.stats = collections.Counter()
        self.mode = cfg["mode"]
        self.lock = threading.Lock()
        self.global_cool = {}
        self.event_counts = collections.Counter()
        self.flagged = {}                   # לדוחות replay

    # ---------- עזרים
    def is_whitelisted(self, ip):
        if ip in self.allow_ips: return True
        try:
            a = ipaddress.ip_address(ip)
        except ValueError:
            return True
        return any(a in n for n in self.whitelist_nets)

    def get(self, ip, ts):
        a = self.A.get(ip)
        if a is None:
            if len(self.A) > 60000: self.gc(ts, force=True)
            a = Attacker(ip, ts); self.A[ip] = a
        return a

    def decay(self, a, ts):
        if a.score > 0 and ts > a.score_ts:
            a.score *= 0.5 ** ((ts - a.score_ts) / self.cfg["score_half_life_s"])
        a.score_ts = ts

    def emit(self, ts, ip, typ, detail, path="", method="", status=0, ua="", sev=None, count=1, blocked=False):
        sev = sev or SEVERITY.get(typ, "low")
        ev = {"ts": ts, "ip": ip, "type": typ, "severity": sev, "path": path[:300], "method": method[:10], "status": status,
              "ua": (ua or "")[:200], "details": detail, "count": count, "blocked": blocked}
        self.events.append(ev)
        self.event_counts[typ] += 1
        if len(self.events) > 20000: del self.events[:5000]

    def flag(self, a, ts, typ, detail, e=None, cooldown=20, points=None, sev=None, force=False):
        """רושם זיהוי: מוסיף נקודות, מייצר אירוע (עם הגבלת קצב לאירועים זהים), ומעדכן פרופיל."""
        self.decay(a, ts)
        a.types[typ] += 1
        a.dirty = True; self.dirty_attackers.add(a.ip)
        pts = POINTS.get(typ, 10) if points is None else points
        key = typ
        last = a.cool.get(key, 0)
        if force or ts - last >= cooldown:
            a.cool[key] = ts
            a.score += pts
            if len(a.samples) < 8 and e is not None:
                a.samples.append({"ts": ts, "type": typ, "path": (e["u"] or "")[:160], "status": e["s"]})
            self.emit(ts, a.ip, typ, detail, e["u"] if e else "", e["m"] if e else "", e["s"] if e else 0, e["ua"] if e else "", sev=sev)
            self.flagged.setdefault(a.ip, collections.Counter())[typ] += 1
            self.maybe_block(a, ts)
        else:
            a.score += pts * REPEAT.get(typ, 0.1)   # חזרות מהירות מוסיפות מעט, כדי שתוקף עיקש יחצה סף בכל זאת

    def maybe_block(self, a, ts):
        if a.score < self.cfg["block_score"] or ts < a.blocked_until: return
        if self.is_whitelisted(a.ip): return
        if self.mode != "enforce" and self.live:
            return
        if os.path.exists(KILL_SWITCH) and self.live: return
        # שסתום ביטחון
        while self.block_times and self.block_times[0] < ts - 60: self.block_times.popleft()
        if len(self.block_times) >= self.cfg["max_blocks_per_min"]:
            self.emit(ts, a.ip, "safety", {"msg": "הגבלת קצב חסימות הופעלה"}, sev="medium"); return
        secs = self.cfg["block_seconds"][min(a.block_count, len(self.cfg["block_seconds"]) - 1)]
        a.block_count += 1; a.blocked_until = ts + secs
        self.block_times.append(ts); self.blocked[a.ip] = a.blocked_until
        main = a.types.most_common(1)[0][0] if a.types else "?"
        self.emit(ts, a.ip, "blocked", {"seconds": secs, "reason": main, "score": round(a.score), "level": a.block_count}, sev="high", blocked=True)
        if self.live: self.nft_add(a.ip, secs)
        self.queue_block(a.ip, a.blocked_until, main, a.score)

    # ---------- מדדים גלובליים לפי דקה + זיהוי חריגות
    def tick_minute(self, ts, e=None):
        m = int(ts // 60)
        if self.cur_min is None: self.cur_min = m
        if m != self.cur_min:
            self.close_minute(self.cur_min)
            self.cur_min = m
        d = self.minute.get(m)
        if d is None:
            d = {"req": 0, "s2": 0, "s3": 0, "s4": 0, "s5": 0, "r429": 0, "blocked": 0, "ips": set(), "bytes": 0, "rt": [],
                 "authfail": 0, "waf": 0, "cache": 0, "static": 0, "subnets": collections.Counter(), "paths": collections.Counter(), "af_ips": collections.Counter()}
            self.minute[m] = d
        return d

    def close_minute(self, m):
        d = self.minute.get(m)
        if not d: return
        rps = d["req"] / 60.0
        base = self.ewma_rps
        ts = (m + 1) * 60
        ips = len(d["ips"])
        # תנועה חריגה מבוזרת: הרבה כתובות, נפח גבוה בהרבה מהרגיל
        if base is not None and d["req"] > max(1500, 4 * base * 60) and ips > 40:
            top = d["subnets"].most_common(3); topp = d["paths"].most_common(3)
            if ts - self.global_cool.get("volume", 0) > 120:
                self.global_cool["volume"] = ts
                self.emit(ts, "*", "volume", {"rps": round(rps, 1), "baseline_rps": round(base, 1), "unique_ips": ips,
                          "top_subnets": top, "top_paths": topp}, sev="critical")
        if base is not None and d["authfail"] >= max(30, 6 * self.ewma_auth * 1.0) and len(d["af_ips"]) >= 8 and max(d["af_ips"].values()) <= 6:
            if ts - self.global_cool.get("stuffing", 0) > 300:
                self.global_cool["stuffing"] = ts
                self.emit(ts, "*", "stuffing", {"failures_in_minute": d["authfail"], "distinct_ips": len(d["af_ips"]),
                          "max_per_ip": max(d["af_ips"].values())}, sev="critical")
        if d["s5"] >= 20 and d["s5"] > 0.05 * max(1, d["req"]):
            if ts - self.global_cool.get("errors", 0) > 300:
                self.global_cool["errors"] = ts
                self.emit(ts, "*", "errors", {"count_5xx": d["s5"], "requests": d["req"]}, sev="medium")
        self.ewma_rps = rps if base is None else (0.9 * base + 0.1 * rps)
        self.ewma_auth = 0.9 * self.ewma_auth + 0.1 * d["authfail"]
        self.stats["minutes"] += 1
        d["closed"] = True
        # שומרים 90 דקות אחרונות בזיכרון
        for old in [k for k in self.minute if k < m - 90]: del self.minute[old]

    # ---------- עיבוד אירוע בקשה בודדת
    def process(self, e):
        ts = e["ts"]; ip = e["ip"]
        d = self.tick_minute(ts)
        # בקשות פנימיות (localhost, רשת פרטית, רשימה לבנה) לא נספרות בכלל - המדדים בלוח הם של גולשים/תוקפים אמיתיים בלבד
        if self.is_whitelisted(ip):
            self.stats["internal"] += 1
            return
        d["req"] += 1; st = e["s"]
        if st < 300: d["s2"] += 1
        elif st < 400: d["s3"] += 1
        elif st < 500: d["s4"] += 1
        else: d["s5"] += 1
        if st == 429: d["r429"] += 1
        # זמני תגובה: בלי בקשות שנקטעו/פגו (400/408/444) - הן ארוכות בגלל התוקף ולא בגלל האתר ומעוותות את המדד
        if e["rt"] and st not in (400, 408, 444) and len(d["rt"]) < 2000: d["rt"].append(e["rt"])
        if e["cs"] in ("HIT", "STALE", "UPDATING"): d["cache"] += 1
        d["ips"].add(ip)
        self.stats["lines"] += 1

        a = self.get(ip, ts)
        a.last = ts; a.hits += 1; a.statuses[st] += 1
        uri = e["u"] or ""
        split = urlsplit(uri); path = split.path or "/"
        qs = split.query
        dec_path = deep_unquote(path)
        dec_all = deep_unquote(uri)
        is_static = bool(STATIC_RX.match(path))
        if e["ua"]: a.uas[e["ua"][:120]] += 1
        if not a.tool:
            a.tool = tool_from_ua(e["ua"])
        if not is_static and len(a.paths) < 200: a.paths[dec_path[:100]] += 1
        d["subnets"][".".join(ip.split(".")[:3]) + ".0/24" if "." in ip else ip.rsplit(":", 3)[0] + "::/48"] += 1
        d["paths"][dec_path[:60]] += 1
        a.dirty = True; self.dirty_attackers.add(ip)
        if st == 444 or (st == 403 and e["wf"]): d["waf"] += 1
        if ts < a.blocked_until: d["blocked"] += 1

        # ---- סיווג תוכן (nginx כבר סימן wf=; כאן מחשבים שוב על הכתובת המפוענחת כדי לתפוס הצפנה כפולה)
        hit_types = []
        if e["wf"] in ("scan", "exploit", "sqli", "xss", "cmdi", "ssrf"): hit_types.append(e["wf"])
        else:
            for k in ("scan", "exploit", "sqli", "xss", "cmdi", "ssrf"):
                if RX[k].search(dec_all): hit_types.append(k)
        for k in hit_types:
            self.flag(a, ts, k, {"path": dec_path[:160], "query": deep_unquote(qs)[:200], "status": st, "nginx_blocked": st in (403, 444)}, e,
                      cooldown=10, force=(k in ("cmdi", "exploit") and a.types[k] == 0))
        if e["ba"]:
            self.flag(a, ts, "bad_ua", {"ua": e["ua"][:120], "tool": a.tool}, e, cooldown=60)
        # שיטות חריגות בלבד (TRACE, CONNECT, PROPFIND...). בקשה שבוטלה/נקטעה נרשמת כ-"-" או ריקה, וקדם-חיבור HTTP/2 הוא PRI - לא חשודים.
        if e["m"] not in OK_METHODS and e["m"].isalpha() and e["m"] != "PRI":
            self.flag(a, ts, "method", {"method": e["m"]}, e, cooldown=60)

        # ---- הצפה: בקשות "אמיתיות" בלבד
        if is_static:
            a.static_n += 1
        else:
            a.reqs.append(ts); _trim(a.reqs, ts - 10)
            if len(a.reqs) >= self.cfg["flood_req_10s"]:
                self.flag(a, ts, "flood", {"requests_10s": len(a.reqs), "status_mix": dict(a.statuses.most_common(4))}, e, cooldown=30)
        # 429 על תמונות/קבצים סטטיים הוא לא סימן להתקפה (דף עם עשרות אייקונים יורה אותם בבת אחת) - סופרים רק בקשות "אמיתיות"
        if st == 429 and not is_static:
            a.r429.append(ts); _trim(a.r429, ts - 60)
            if len(a.r429) >= self.cfg["flood_429_60s"]:
                self.flag(a, ts, "flood", {"rate_limited_60s": len(a.r429)}, e, cooldown=30)
        if st == 408 or (st == 400 and e["rt"] > 8):
            a.slow.append(ts); _trim(a.slow, ts - 60)
            if len(a.slow) >= self.cfg["slow_408_60s"]:
                self.flag(a, ts, "slow", {"slow_requests_60s": len(a.slow)}, e, cooldown=60)

        # ---- אימות: ניחוש סיסמאות
        if e["m"] == "POST" and AUTH_FAIL_RX.match(path) and ("grant_type=password" in qs or not path.endswith("/token")):
            if st in (400, 401, 403, 422, 429):
                a.auth_fail.append(ts); _trim(a.auth_fail, ts - 300)
                d["authfail"] += 1; d["af_ips"][ip] += 1
                if len(a.auth_fail) >= self.cfg["brute_fail_300s"]:
                    self.flag(a, ts, "brute", {"failed_attempts_5min": len(a.auth_fail), "endpoint": path[:80]}, e, cooldown=60)
        elif e["m"] == "POST" and AUTH_SPAM_RX.match(path):
            a.auth_fail.append(ts); _trim(a.auth_fail, ts - 300)
            if len(a.auth_fail) >= self.cfg["brute_fail_300s"]:
                self.flag(a, ts, "brute", {"requests_5min": len(a.auth_fail), "endpoint": path[:80], "note": "ניצול נקודת מייל/איפוס"}, e, cooldown=120)
        # ---- הרשאות: סריקת נתיבי ניהול
        if ADMIN_RX.match(path) and st in (401, 403, 404):
            a.admin_probe.append(ts); _trim(a.admin_probe, ts - 300)
            if len(a.admin_probe) >= self.cfg["admin_probe_300s"]:
                self.flag(a, ts, "admin_probe", {"attempts_5min": len(a.admin_probe), "path": path[:100]}, e, cooldown=60)
        # ---- IDOR / סריקת מזהים
        if st in (403, 404) and ID_RX.match(path):
            a.enum_ids.append((ts, path)); _trim(a.enum_ids, ts - 60)
            if len({p for _, p in a.enum_ids}) >= self.cfg["enum_distinct_60s"]:
                self.flag(a, ts, "enum", {"distinct_ids_60s": len({p for _, p in a.enum_ids})}, e, cooldown=60)
        # ---- גילוי נתיבים: הרבה 404 שונים
        if st == 404 and not is_static:
            a.nf_paths.append((ts, dec_path)); _trim(a.nf_paths, ts - 60)
            n = len({p for _, p in a.nf_paths})
            if n >= self.cfg["notfound_distinct_60s"]:
                self.flag(a, ts, "recon404", {"distinct_404_60s": n}, e, cooldown=60)
        # ---- שגיאות שרת חוזרות מאותה כתובת (fuzzing)
        if st >= 500:
            a.err5.append(ts); _trim(a.err5, ts - 60)
            if len(a.err5) >= 15:
                self.flag(a, ts, "errors", {"errors_60s": len(a.err5)}, e, cooldown=120)
        # ---- CSRF חשוד: פעולה משנה מצב עם Origin מדומיין זר (דפדפן שולח Origin תמיד בבקשות חוצות-אתר)
        if e["m"] in ("POST", "PUT", "PATCH", "DELETE") and e["org"] and path.startswith("/api/"):
            try:
                oh = urlsplit(e["org"]).hostname or ""
            except Exception:
                oh = ""
            if oh and oh not in self.cfg["own_hosts"] and not e["org"].startswith(("chrome-extension://", "moz-extension://", "capacitor://", "file://")):
                self.flag(a, ts, "csrf", {"origin": e["org"][:80], "path": path[:80]}, e, cooldown=300)

        # רק 'דעיכה' ללא אירוע חדש: חשוב לכתובות שנעצרו
        if a.score > 0: self.decay(a, ts)

    # ---------- ניקוי זיכרון
    def gc(self, now, force=False):
        cut = now - 1800
        dead = [ip for ip, a in self.A.items() if a.last < cut and a.score < 5 and ip not in self.blocked]
        for ip in dead: del self.A[ip]
        if force and len(self.A) > 50000:
            for ip, a in sorted(self.A.items(), key=lambda kv: kv[1].score)[:10000]: del self.A[ip]
        for ip in [i for i, u in self.blocked.items() if u < now]: del self.blocked[ip]

    # ---------- חסימות (nftables) - רק במצב חי
    def nft(self, args, stdin=None):
        try:
            r = subprocess.run(["nft"] + args, input=stdin, capture_output=True, text=True, timeout=5)
            return r.returncode == 0, r.stderr.strip()
        except Exception as ex:
            return False, str(ex)

    def nft_setup(self):
        script = """
add table inet ogen_sentinel
add set inet ogen_sentinel block4 { type ipv4_addr; flags timeout; }
add set inet ogen_sentinel block6 { type ipv6_addr; flags timeout; }
add chain inet ogen_sentinel pre { type filter hook prerouting priority -300; policy accept; }
add rule inet ogen_sentinel pre ip saddr @block4 tcp dport { 80, 443 } drop
add rule inet ogen_sentinel pre ip6 saddr @block6 tcp dport { 80, 443 } drop
"""
        # idempotent: אם הטבלה קיימת נשארים איתה (כולל החסימות הפעילות)
        ok, _ = self.nft(["list", "table", "inet", "ogen_sentinel"])
        if not ok:
            ok2, err = self.nft(["-f", "-"], stdin=script)
            log("nft setup:", "ok" if ok2 else err)

    def nft_add(self, ip, secs):
        s = "block6" if ":" in ip else "block4"
        ok, err = self.nft(["add", "element", "inet", "ogen_sentinel", s, "{", ip, "timeout", f"{int(secs)}s", "}"])
        if not ok: log("nft add failed", ip, err)

    def nft_del(self, ip):
        s = "block6" if ":" in ip else "block4"
        self.nft(["delete", "element", "inet", "ogen_sentinel", s, "{", ip, "}"])

    # ---------- תור הכתיבה ל-DB (נבנה ע"י Writer)
    def queue_block(self, ip, until, reason, score):
        self.pending_blocks = getattr(self, "pending_blocks", [])
        self.pending_blocks.append({"ip": ip, "status": "blocked", "until": iso(until), "reason": reason, "source": "auto", "updated_at": iso(time.time())})

# ---------------------------------------------------------------- כלים
def iso(ts):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=sys.stderr, flush=True)

def load_cfg():
    cfg = dict(DEFAULTS)
    try:
        with open(CFG_PATH, encoding="utf-8") as f: cfg.update(json.load(f))
    except FileNotFoundError:
        pass
    env = {}
    try:
        with open(cfg["env_file"], encoding="utf-8", errors="ignore") as f:
            for ln in f:
                ln = ln.strip()
                if "=" in ln and not ln.startswith("#"):
                    k, v = ln.split("=", 1); env[k] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    # טווחי Cloudflare: לעולם לא חוסמים אותם (חסימת כתובת של Cloudflare = חסימת אלפי משתמשים לגיטימיים)
    try:
        with open("/etc/ogen-sentinel/cloudflare.txt", encoding="utf-8") as f:
            cfg["whitelist"] = list(cfg["whitelist"]) + [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]
    except FileNotFoundError:
        pass
    cfg["supabase_url"] = cfg["supabase_url"] or env.get("SUPABASE_INTERNAL_URL") or "http://127.0.0.1:8000"
    cfg["supabase_key"] = cfg["supabase_key"] or env.get("SUPABASE_SECRET_KEY", "")
    return cfg

def profile_of(a, ts):
    """סיכום קריא של התוקף: מה ניסה, באיזה כלי, מה היעד."""
    main = a.types.most_common(3)
    labels = [FAMILY.get(t, (t, ""))[0] for t, _ in main]
    fam = {FAMILY.get(t, ("", ""))[1] for t, _ in main}
    return {"label": " + ".join(labels), "families": sorted(f for f in fam if f), "tool": a.tool,
            "top_paths": [p for p, _ in a.paths.most_common(6)], "samples": a.samples[:8],
            "statuses": dict(a.statuses.most_common(6)), "user_agents": [u for u, _ in a.uas.most_common(3)]}

class Writer(threading.Thread):
    """שולח ל-Supabase ב-REST פנימי (127.0.0.1:8000), בלי להשפיע על נתיב הבקשות."""
    def __init__(self, s):
        super().__init__(daemon=True); self.s = s; self.stop = False; self.conn = None; self.fail = 0
        self.last_poll_ts = "1970-01-01T00:00:00Z"; self.last_minute_sent = 0
    def req(self, method, path, body=None, headers=None):
        cfg = self.s.cfg; u = urlsplit(cfg["supabase_url"])
        h = {"apikey": cfg["supabase_key"], "Authorization": "Bearer " + cfg["supabase_key"], "Content-Type": "application/json"}
        if headers: h.update(headers)
        for attempt in (0, 1):
            try:
                if self.conn is None: self.conn = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=10)
                self.conn.request(method, path, body=json.dumps(body) if body is not None else None, headers=h)
                r = self.conn.getresponse(); data = r.read()
                if r.status >= 300: raise RuntimeError(f"{r.status} {data[:200]!r}")
                return json.loads(data) if data else None
            except Exception as ex:
                try: self.conn.close()
                except Exception: pass
                self.conn = None
                if attempt: raise ex
    def run(self):
        s = self.s; last_poll = 0; last_flush = 0
        while not self.stop:
            time.sleep(0.5); now = time.time()
            try:
                if now - last_flush >= s.cfg["flush_seconds"]:
                    last_flush = now; self.flush()
                if now - last_poll >= s.cfg["poll_seconds"]:
                    last_poll = now; self.poll()
                self.fail = 0
            except Exception as ex:
                self.fail += 1
                if self.fail in (1, 5, 30): log("db error:", ex)
    def flush(self):
        s = self.s
        with s.lock:
            evs, s.events = s.events, []
            att = [s.A[ip] for ip in list(s.dirty_attackers) if ip in s.A]; s.dirty_attackers.clear()
            blocks = getattr(s, "pending_blocks", []); s.pending_blocks = []
            mins = []; max_m = self.last_minute_sent
            for m, d in sorted(s.minute.items()):
                if d.get("closed") and m > self.last_minute_sent:
                    rt = sorted(d["rt"]); p95 = rt[int(len(rt) * 0.95)] if rt else 0
                    mins.append({"minute": iso(m * 60), "req": d["req"], "s2xx": d["s2"], "s3xx": d["s3"], "s4xx": d["s4"], "s5xx": d["s5"],
                                 "r429": d["r429"], "blocked_hits": d["blocked"], "unique_ips": len(d["ips"]), "waf_blocked": d["waf"],
                                 "auth_failures": d["authfail"], "avg_rt_ms": round(1000 * sum(rt) / len(rt), 1) if rt else 0,
                                 "p95_rt_ms": round(1000 * p95, 1), "cache_hits": d["cache"]})
                    max_m = max(max_m, m)
            now = time.time()
            att_rows = [{"ip": a.ip, "first_seen": iso(a.first), "last_seen": iso(a.last), "hits": a.hits, "score": round(a.score, 1),
                         "attack_types": sorted(a.types), "type_counts": dict(a.types), "profile": profile_of(a, now),
                         "blocked_until": iso(a.blocked_until) if a.blocked_until > now else None, "block_count": a.block_count,
                         "updated_at": iso(now)} for a in att if a.types or a.score > 0]
        failed = []
        try:
            if evs:
                self.req("POST", "/rest/v1/security_events", [{"ts": iso(e["ts"]), "ip": e["ip"], "type": e["type"], "severity": e["severity"],
                         "path": e["path"], "method": e["method"], "status": e["status"], "ua": e["ua"], "details": e["details"],
                         "count": e["count"], "blocked": e["blocked"]} for e in evs], {"Prefer": "return=minimal"})
            if att_rows:
                self.req("POST", "/rest/v1/security_attackers?on_conflict=ip", att_rows, {"Prefer": "resolution=merge-duplicates,return=minimal"})
            if blocks:
                self.req("POST", "/rest/v1/security_blocklist?on_conflict=ip", blocks, {"Prefer": "resolution=merge-duplicates,return=minimal"})
            if mins:
                self.req("POST", "/rest/v1/security_metrics?on_conflict=minute", mins, {"Prefer": "resolution=merge-duplicates,return=minimal"})
                self.last_minute_sent = max_m
        except Exception:
            with s.lock:     # מחזירים לתור (עם תקרה) ומנסים שוב בסיבוב הבא
                s.events = (evs + s.events)[-5000:]
                for a in att: s.dirty_attackers.add(a.ip)
                s.pending_blocks = (blocks + getattr(s, "pending_blocks", []))[-500:]
            raise
    def poll(self):
        """קורא הוראות מהלוח: חסימות ידניות, שחרור, רשימה לבנה והגדרות (mode)."""
        s = self.s
        rows = self.req("GET", "/rest/v1/security_blocklist?select=*&source=eq.manual&updated_at=gt." + self.last_poll_ts + "&order=updated_at.asc&limit=200")
        for r in rows or []:
            ip = r["ip"]; st = r["status"]; self.last_poll_ts = max(self.last_poll_ts, r["updated_at"])
            with s.lock:
                if st == "blocked":
                    until = from_iso(r["until"]) if r.get("until") else time.time() + 3600
                    secs = max(60, until - time.time()); s.blocked[ip] = until
                    a = s.A.get(ip); 
                    if a: a.blocked_until = until
                    if not s.is_whitelisted(ip): s.nft_add(ip, secs)
                    log("manual block", ip, int(secs))
                elif st in ("released", "allowed"):
                    s.nft_del(ip); s.blocked.pop(ip, None)
                    a = s.A.get(ip)
                    if a: a.blocked_until = 0; a.score = 0
                    if st == "allowed": s.allow_ips.add(ip)
                    else: s.allow_ips.discard(ip)
                    log("released/allowed", ip, st)
        cfg = self.req("GET", "/rest/v1/security_settings?select=*&id=eq.1")
        if cfg:
            c = cfg[0]
            with s.lock:
                if c.get("mode") in ("observe", "enforce") and c["mode"] != s.mode:
                    log("mode ->", c["mode"]); s.mode = c["mode"]
                if c.get("block_score"): s.cfg["block_score"] = int(c["block_score"])
                s.cfg["whitelist_extra"] = c.get("whitelist") or []
                for x in s.cfg["whitelist_extra"]:
                    try:
                        n = ipaddress.ip_network(x, strict=False)
                        if n not in s.whitelist_nets: s.whitelist_nets.append(n)
                    except ValueError: pass
        # ניקוי נתונים ישנים פעם ביום (פונקציה במסד: אירועים 30 יום, מדדים 90 יום)
        if time.time() - getattr(self, "last_prune", 0) > 86400:
            self.last_prune = time.time()
            try: self.req("POST", "/rest/v1/rpc/security_prune", {})
            except Exception as ex: log("prune failed:", ex)
        # אחזור חסימות פעילות אחרי הפעלה מחדש (פעם אחת)
        if not getattr(self, "restored", False):
            self.restored = True
            act = self.req("GET", "/rest/v1/security_blocklist?select=ip,until&status=eq.blocked&until=gt." + iso(time.time()))
            for r in act or []:
                until = from_iso(r["until"])
                s.blocked[r["ip"]] = until; s.nft_add(r["ip"], max(60, until - time.time()))
            if act: log("restored", len(act), "active blocks")
            with s.lock: s.stats["restored"] = len(act or [])

# ---------------------------------------------------------------- ריצה
def follow(path, s, stop):
    """עוקב אחרי הקובץ (כמו tail -F): מתמודד עם רוטציה, ועם שורה שנכתבה רק חלקית."""
    f = None; inode = None; partial = ""; first = True
    while not stop.is_set():
        try:
            st = os.stat(path)
            if f is None or st.st_ino != inode or st.st_size < f.tell():
                if f: f.close()
                f = open(path, "r", encoding="utf-8", errors="replace"); inode = st.st_ino; partial = ""
                if first:
                    f.seek(0, os.SEEK_END); first = False      # בהפעלה ראשונה מתחילים מהסוף
        except FileNotFoundError:
            time.sleep(1); continue
        chunk = f.readline()
        if not chunk:
            time.sleep(0.25); s.maintenance(); continue
        if not chunk.endswith("\n"):
            partial += chunk; continue
        line, partial = partial + chunk, ""
        e = parse_line(line)
        if e:
            with s.lock: s.process(e)

def main_live():
    try: os.nice(10)
    except Exception: pass
    cfg = load_cfg(); s = Sentinel(cfg, live=True)
    s.nft_setup()
    last = {"gc": 0}
    def maintenance():
        now = time.time()
        if now - last["gc"] > 60:
            last["gc"] = now
            with s.lock:
                s.gc(now)
                s.tick_minute(now)         # סוגר דקות גם כשאין תנועה
                # בלימת חסימות המוניות
                while s.block_times and s.block_times[0] < now - 600: s.block_times.popleft()
                if s.mode == "enforce" and len(s.block_times) >= cfg["safety_trip_blocks_10min"]:
                    s.mode = "observe"; s.emit(now, "*", "safety", {"msg": "יותר מדי חסימות - חזרה למצב observe"}, sev="critical")
    s.maintenance = maintenance
    w = Writer(s); w.start()
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set()); signal.signal(signal.SIGINT, lambda *_: stop.set())
    log(f"sentinel {VERSION} started, mode={s.mode}, log={LOG_PATH}")
    follow(LOG_PATH, s, stop)
    w.stop = True
    try: w.flush()
    except Exception: pass

def replay(files, cfg_over=None):
    cfg = dict(DEFAULTS); cfg["mode"] = "enforce"
    if cfg_over: cfg.update(cfg_over)
    s = Sentinel(cfg, live=False); n = 0; t0 = time.time(); first = last = None
    for fn in files:
        op = gzip.open if fn.endswith(".gz") else open
        with op(fn, "rt", encoding="utf-8", errors="replace") as f:
            for line in f:
                e = parse_line(line)
                if not e: continue
                if first is None: first = e["ts"]
                last = e["ts"]; n += 1
                s.process(e)
                if n % 200000 == 0: s.gc(e["ts"])
    if last: s.close_minute(s.cur_min)
    dur = time.time() - t0
    out = {"lines": n, "seconds": round(dur, 1), "lines_per_sec": int(n / dur) if dur else 0,
           "period": [iso(first or 0), iso(last or 0)], "unique_ips": len(s.A), "events_by_type": dict(s.event_counts),
           "blocked_ips": sum(1 for a in s.A.values() if a.block_count), "flagged_ips": len(s.flagged)}
    top = sorted(s.A.values(), key=lambda a: -sum(a.types.values()))[:15]
    out["top_flagged"] = [{"ip": a.ip, "hits": a.hits, "types": dict(a.types), "score": round(a.score), "blocks": a.block_count, "tool": a.tool,
                           "ua": (a.uas.most_common(1)[0][0][:60] if a.uas else ""), "paths": [p for p, _ in a.paths.most_common(3)]} for a in top if a.types]
    out["global_events"] = [e for e in s.events if e["ip"] == "*"][:10]
    # דוגמאות לסוגים נדירים - כדי לבדוק ידנית שאין התראות שווא
    rare = {}
    for ev in s.events:
        if ev["type"] in ("exploit", "sqli", "xss", "cmdi", "ssrf", "brute", "admin_probe", "enum", "slow", "csrf", "errors", "method"):
            lst = rare.setdefault(ev["type"], [])
            if len(lst) < 4: lst.append({"ip": ev["ip"], "path": ev["path"][:120], "status": ev["status"], "details": ev["details"]})
    out["rare_samples"] = rare
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--replay", nargs="+")
    ap.add_argument("--whitelist", default="", help="כתובות IP להחרגה בהרצת replay (מופרדות בפסיק)")
    ap.add_argument("--whitelist-file", default="", help="קובץ טווחי CIDR להחרגה (שורה לכל טווח)")
    ap.add_argument("--no-block", action="store_true", help="replay במצב observe (בלי סימולציית חסימה)")
    args = ap.parse_args()
    if args.replay:
        extra = [x for x in args.whitelist.split(",") if x]
        if args.whitelist_file:
            with open(args.whitelist_file, encoding="utf-8") as f: extra += [ln.strip() for ln in f if ln.strip()]
        over = {"whitelist": DEFAULTS["whitelist"] + extra}
        if args.no_block: over["mode"] = "observe"
        r = replay(args.replay, over)
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        main_live()
