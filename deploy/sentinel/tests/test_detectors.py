#!/usr/bin/env python3
"""בדיקות יחידה לגלאי ה-sentinel (בלי DB, בלי nft). הרצה:  python3 deploy/sentinel/tests/test_detectors.py
בודק בעיקר שני דברים: (1) תוקפים אמיתיים מזוהים וחסומים, (2) גולשים אמיתיים - גם כבדים - לא נחסמים לעולם."""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("sentinel", os.path.join(HERE, "..", "sentinel.py"))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

def sentinel():
    cfg = dict(m.DEFAULTS); cfg["mode"] = "enforce"
    return m.Sentinel(cfg, live=False)

def line(ip, uri, st=200, t="2026-11-13T00:10:00+00:00", method="GET", ua="Mozilla/5.0 Chrome/156", org="", wf="", ba="0", rt=0.01):
    return json.dumps({"t": t, "ip": ip, "m": method, "h": "ogenplay.com", "u": uri, "s": st, "b": 10, "rt": rt, "urt": "", "ua": ua,
                       "ref": "", "org": org, "ck": "0", "cs": "", "wf": wf, "ba": ba, "rl": 10, "pr": "HTTP/2.0"})

def feed(s, **kw):
    s.process(m.parse_line(line(**kw)))

def tm(sec, base_min=10):
    return "2026-11-13T00:%02d:%02d+00:00" % (base_min + sec // 60, sec % 60)

def run():
    # 1. כתובת פנימית נעלמת לגמרי (לא נספרת, לא נחסמת)
    s = sentinel(); feed(s, ip="127.0.0.1", uri="/.env", st=444, wf="scan"); assert "127.0.0.1" not in s.A

    # 2. גלישה רגילה - אפס זיהויים
    s = sentinel()
    for u in ["/", "/forum", "/api/apps/search?q=waze", "/users", "/_next/image?url=%2Fapi%2Fcdn%2Fx.webp&w=96&q=75"]: feed(s, ip="5.5.5.5", uri=u)
    assert not s.A["5.5.5.5"].types

    # 3. סורק: מזוהה וחסום תוך כמה בקשות
    s = sentinel()
    for i, p in enumerate(["/.env", "/wp-login.php", "/.git/config", "/phpmyadmin/", "/xmlrpc.php", "/.aws/credentials"]):
        feed(s, ip="6.6.6.6", uri=p, st=444, wf="scan", t=tm(i * 12))
    assert "scan" in s.A["6.6.6.6"].types and s.A["6.6.6.6"].block_count >= 1

    # 4. SQLi בהצפנה כפולה (בלי סימון של nginx) - עדיין מזוהה
    s = sentinel(); feed(s, ip="7.7.7.7", uri="/api/apps/search?q=1%2520union%2520select%25201"); assert "sqli" in s.A["7.7.7.7"].types

    # 5. brute force: 9 כשלי סיסמה; רענון טוקן שנכשל - לא נחשב
    s = sentinel()
    for i in range(9): feed(s, ip="8.8.8.8", uri="/api/sb/auth/v1/token?grant_type=password", st=400, method="POST", t=tm(i))
    assert "brute" in s.A["8.8.8.8"].types
    for i in range(12): feed(s, ip="9.9.9.9", uri="/api/sb/auth/v1/token?grant_type=refresh_token", st=400, method="POST", t=tm(i))
    assert "brute" not in s.A["9.9.9.9"].types

    # 6. CSRF חשוד רק עם Origin זר
    s = sentinel()
    feed(s, ip="4.4.4.4", uri="/api/forum/posts", st=403, method="POST", org="https://evil.example"); assert "csrf" in s.A["4.4.4.4"].types
    feed(s, ip="4.4.4.5", uri="/api/forum/posts", method="POST", org="https://ogenplay.com"); assert "csrf" not in s.A["4.4.4.5"].types

    # 7. בקשה שנקטעה / PRI אינן "שיטה חריגה"
    s = sentinel(); feed(s, ip="3.3.3.3", uri="-", st=400, method="-"); feed(s, ip="3.3.3.3", uri="*", st=400, method="PRI"); assert "method" not in s.A["3.3.3.3"].types

    # 8. התפרצות בודדת של גולש אמיתי (320 בקשות ב-10 שניות, פעם אחת) - לא נחסם
    s = sentinel()
    for i in range(320): feed(s, ip="2.2.2.2", uri="/api/notifications/feed", t=tm(i // 33))
    assert s.A["2.2.2.2"].block_count == 0

    # 9. דף עם עשרות תמונות שנדחו ב-429 (תמונות) - לא נחשב הצפה ולא נחסם
    s = sentinel()
    for sec in range(120):
        for k in range(70): feed(s, ip="2.2.2.3", uri="/_next/image?url=/api/cdn/i" + str(k) + ".webp&w=96&q=75", st=429, t=tm(sec))
    assert s.A["2.2.2.3"].block_count == 0 and "flood" not in s.A["2.2.2.3"].types

    # 10. הצפה מתמשכת (75 שניות, 400 בקשות לחלון) - נחסמת
    s = sentinel()
    for sec in range(75):
        for k in range(40): feed(s, ip="1.1.1.1", uri="/api/apps/search?q=a", st=429 if k % 3 else 200, t=tm(sec, 20))
    assert s.A["1.1.1.1"].block_count >= 1

    # 11. כתובת ברשימה הלבנה / טווח Cloudflare לא נחסמת לעולם
    cfg = dict(m.DEFAULTS); cfg["mode"] = "enforce"; cfg["whitelist"] = list(cfg["whitelist"]) + ["104.16.0.0/13"]
    s = m.Sentinel(cfg, live=False)
    for i, p in enumerate(["/.env", "/wp-login.php", "/.git/config", "/phpmyadmin/", "/xmlrpc.php"]): feed(s, ip="104.21.57.122", uri=p, st=444, wf="scan", t=tm(i * 12))
    assert "104.21.57.122" not in s.A and not s.blocked

    print("ALL DETECTOR TESTS PASSED (11 scenarios)")

if __name__ == "__main__":
    run()
