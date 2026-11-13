# מרכז אבטחה ו-Sentinel - עוגן פליי

מערכת הגנה וזיהוי תקיפות בזמן אמת. **עיקרון מנחה: אפס פגיעה במהירות האתר** - כל הניתוח רץ מחוץ לנתיב הבקשה.

## איך זה בנוי

```
גולש/תוקף ──> nginx ──> Next.js ──> Supabase
                │
                ├─ שכבה 1 (מיקרו-שניות, בזיכרון nginx): חסימת סריקות/הזרקות/כותרות עקיפה, הגבלת קצב, CSRF, ניתוק התקפות איטיות
                └─ לוג JSON (ogen_json.log, כתיבה בחבילות)
                         │
                         ▼
                 ogen-sentinel (תהליך נפרד, nice 10, 30% CPU, 300MB)  ── קורא את הלוג אחרי שהבקשה כבר נענתה
                         │   מזהה: הצפה, סריקה, SQLi/XSS/LFI/RCE/SSRF, brute force, IDOR, הסלמת הרשאות, CSRF, Slowloris, DDoS מבוזר, Credential Stuffing
                         │   בונה פרופיל לכל IP (ציון סיכון עם דעיכה, כלי תקיפה, נתיבים, ציר זמן)
                         ├─ כותב ל-Supabase: security_events / security_attackers / security_metrics
                         └─ חוסם בקרנל (nftables, לפני conntrack) לפורטים 80/443, זמנית ומדורגת: 15 דק' → שעה → יממה → שבוע
                                          ▲
לוח הניהול (admin → "מרכז אבטחה") ───────┘ קורא דרך /api/admin/security/* (מנהל בפועל בלבד), חסימה/שחרור/רשימה לבנה/מצב
```

## קבצים
| קובץ | מה זה |
|---|---|
| `sentinel.py` | הליבה: ניתוח לוג, זיהוי, פרופילים, חסימות nftables, כתיבה ל-DB. `--replay FILE` מריץ על לוג היסטורי לבדיקה |
| `ogen-sentinel.service` | שירות systemd מוקשח (עדיפות נמוכה, תקרות משאבים, הרשאות מינימליות) |
| `install.sh` | התקנה/עדכון בשרת (אידמפוטנטי) |
| `nginx/04-ogen-security.conf` | לוג JSON, מפות WAF-lite, הגבלת ניחוש סיסמאות, CSRF, חסימת `Next-Action` |
| `nginx/ogen-waf.snippet.conf` | ה-`if`ים שנכללים בכל server של HTTPS |
| `nginx/01-ogen-exempt.conf`, `05-ogen-default.conf` | החרגת כתובות פנימיות מהגבלות; שרת ברירת מחדל שמנתק בקשות לפי IP/Host מזויף |
| `nginx/apply-nginx-sec.sh` | מחיל את כל שכבת nginx עם גיבוי, בדיקת תחביר ושחזור אוטומטי |
| `host-harden.sh` | הקשחת קרנל (SYN flood), SSH, ביטול rpcbind, fail2ban ל-SSH, הגבלת ICMP, הרשאות קבצי סודות |
| `tests/` | `perf-test.js` (מדידת ביצועים), `attack-sim.py` (הדמיית התקפות על האתר שלנו), `replay-run.sh` (הרצת הגלאי על לוגים אמיתיים) |

## הפעלה
```bash
# 1. טבלאות (גם נטענות אוטומטית ע"י auto-deploy כשהמיגרציה 0083 נמזגת - אידמפוטנטית)
sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/0083_security_center.sql
# 2. שירות
bash deploy/sentinel/install.sh
# 3. מצב: observe (מתעד בלבד) / enforce (חוסם אוטומטית) - מתג בלוח הניהול, או:
sudo docker exec supabase-db psql -U postgres -c "update security_settings set mode='enforce' where id=1"
```

## בטיחות
* **מתג חירום:** `sudo touch /etc/ogen-sentinel/DISABLE_BLOCK` - מפסיק כל חסימה מיד (הזיהוי ממשיך). למחוק את הקובץ כדי לחזור.
* **שחרור כתובת:** מהלוח (לשונית "מרכז אבטחה") או `sudo nft delete element inet ogen_sentinel block4 { 1.2.3.4 }`.
* כתובות פנימיות, טווחי Cloudflare והרשימה הלבנה **לעולם לא נחסמות**. חסימה חלה רק על TCP 80/443 (SSH ו-SIP לא נפגעים).
* שסתומי ביטחון: מקסימום 15 חסימות בדקה; מעל 120 ב-10 דקות המערכת חוזרת אוטומטית ל-observe ומתריעה.
* חסימות זמניות בלבד ומדורגות, כך שטעות לא הופכת לחסימה קבועה.

## רמות הגנה (ומה כל אחת תופסת)
1. **nginx (מיידי, בקרנל של nginx):** סריקות (`.env`, `wp-login`, `.git`...) → ניתוק; SQLi/XSS/LFI/RCE/Log4Shell בכתובת → 403; כלי תקיפה לפי User-Agent → ניתוק; `x-middleware-subrequest` ו-`Next-Action` → חסום; POST חוצה-אתר ל-API → 403; ניחוש סיסמאות → 12 לדקה לכתובת; הצפה → 15 בקשות/שנייה; התקפות איטיות → ניתוק אחרי 10 שניות.
2. **sentinel (שניות):** זיהוי דפוסים שלא נראים בבקשה בודדת (סריקה איטית, brute force, IDOR, DDoS מבוזר, Credential Stuffing) וחסימה בקרנל.
3. **קרנל/רשת:** syncookies, backlog מוגדל, חסימת ICMP flood, fail2ban ל-SSH.
4. **Cloudflare (מומלץ):** ספיגת DDoS נפחי (L3/L4) - השרת עצמו לא יכול לעמוד בהצפה נפחית. nginx כבר מוכן (real_ip מ-Cloudflare).

## בדיקות
```bash
python3 sentinel.py --replay /var/log/nginx/access.log.1 --whitelist <ip-השרת>      # תוצאות על תנועה אמיתית
python3 tests/attack-sim.py all                                                       # מהרשת החיצונית: סריקות, הזרקות, brute force, הצפה, Slowloris
node tests/perf-test.js LABEL 5                                                       # השוואת ביצועים לפני/אחרי
```
