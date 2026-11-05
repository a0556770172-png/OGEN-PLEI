#!/usr/bin/env bash
# אבחון עומסים בשרת עוגן פליי - קריאה בלבד, לא משנה כלום ולא מדפיס סיסמאות/מפתחות.
# הרצה בשרת:   bash /opt/ogen-play/deploy/diagnose.sh
# התוצאה נשמרת גם בקובץ ~/ogen-diagnose.txt (אפשר להעתיק ממנו ולהדביק בשיחה).
set -uo pipefail
OUT="$HOME/ogen-diagnose.txt"
exec > >(tee "$OUT") 2>&1

h() { echo; echo "=================== $* ==================="; }
SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo -n"

h "זמן ועומס כללי"
date; uptime
echo "ליבות: $(nproc)"
free -m
df -h / | tail -2

h "תהליכים הכבדים ביותר (CPU)"
ps aux --sort=-%cpu | head -8 | cut -c1-170
h "תהליכים הכבדים ביותר (זיכרון)"
ps aux --sort=-%mem | head -6 | cut -c1-170

h "שירות האתר (ogen-play)"
systemctl is-active ogen-play 2>&1
systemctl show ogen-play -p NRestarts -p MemoryCurrent -p ActiveEnterTimestamp 2>&1
journalctl -u ogen-play --since "1 hour ago" --no-pager 2>/dev/null | grep -ciE "error|failed|threw" | sed 's/^/שגיאות בשעה האחרונה: /'
journalctl -u ogen-play --since "1 hour ago" --no-pager 2>/dev/null | grep -iE "error|failed|threw" | cut -c1-200 | sort | uniq -c | sort -rn | head -12

h "דוקר - צריכת משאבים"
$SUDO docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>&1 | head -30

h "פריסות אחרונות"
tail -15 "$HOME/ogen-deploy.log" 2>/dev/null
[ -f "$HOME/ogen-deploy-failed.txt" ] && { echo "--- גרסאות שנכשלו:"; cat "$HOME/ogen-deploy-failed.txt"; }

h "תעבורה (לוג שרת ה-Web)"
LOG=""
for f in /var/log/nginx/access.log /var/log/caddy/access.log /var/log/caddy/ogenplay.log; do
  [ -r "$f" ] || { $SUDO test -r "$f" 2>/dev/null && LOG="$f" && break; continue; }
  LOG="$f"; break
done
if [ -z "$LOG" ]; then
  echo "לא נמצא לוג גישה קריא (nginx/caddy). נסו: sudo ls /var/log/nginx /var/log/caddy"
else
  echo "קובץ: $LOG"
  $SUDO tail -n 20000 "$LOG" > /tmp/ogen-access.tmp 2>/dev/null
  echo "--- קבצי לוג: $(wc -l < /tmp/ogen-access.tmp) שורות אחרונות"
  echo "--- 20 הנתיבים הנפוצים ביותר:"
  awk '{ for(i=1;i<=NF;i++) if ($i ~ /^"(GET|POST|PUT|PATCH|DELETE|HEAD)$/) { p=$(i+1); sub(/\?.*/,"",p); gsub(/[0-9a-f]{8}-[0-9a-f-]{27}/,":id",p); c[p]++ } } END { for (k in c) print c[k], k }' /tmp/ogen-access.tmp | sort -rn | head -20
  echo "--- התפלגות קודי תשובה:"
  awk '{ for(i=1;i<=NF;i++) if ($i ~ /^[1-5][0-9][0-9]$/ && $(i-1) ~ /"$/) { c[$i]++ } } END { for (k in c) print c[k], k }' /tmp/ogen-access.tmp | sort -rn | head
  echo "--- כתובות IP הפעילות ביותר:"
  awk '{ print $1 }' /tmp/ogen-access.tmp | sort | uniq -c | sort -rn | head -8
  rm -f /tmp/ogen-access.tmp
fi

h "מסד הנתונים (Postgres בדוקר)"
DB=$($SUDO docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase-db$' | head -1)
if [ -z "$DB" ]; then
  echo "קונטיינר supabase-db לא נמצא"
else
  q() { $SUDO docker exec "$DB" psql -U postgres -d postgres -X -q -c "$1" 2>&1 | head -${2:-25}; }
  echo "--- חיבורים פעילים:"
  q "select state, count(*) from pg_stat_activity where datname='postgres' group by 1 order by 2 desc;"
  echo "--- שאילתות איטיות שרצות עכשיו (מעל שנייה):"
  q "select now()-query_start as dur, left(query,110) as q from pg_stat_activity where state='active' and now()-query_start > interval '1 second' order by 1 desc limit 8;"
  echo "--- 10 הטבלאות הגדולות:"
  q "select relname, pg_size_pretty(pg_total_relation_size(relid)) as size, n_live_tup as rows, n_dead_tup as dead from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 10;"
  echo "--- טבלאות עם סריקות רציפות רבות (חסר אינדקס?):"
  q "select relname, seq_scan, seq_tup_read, idx_scan from pg_stat_user_tables where seq_scan > 100 order by seq_tup_read desc limit 10;"
  echo "--- שאילתות כבדות (pg_stat_statements, אם מופעל):"
  q "select calls, round(total_exec_time::numeric) as total_ms, round(mean_exec_time::numeric,1) as avg_ms, left(query,100) as q from pg_stat_statements order by total_exec_time desc limit 10;" 14
  echo "--- אינדקסים חדשים של 0072:"
  q "select indexname from pg_indexes where indexname in ('apps_status_created_idx','apps_developer_idx','profiles_points_idx','profiles_last_seen_idx','download_events_user_created_desc_idx');"
fi

h "מטמון תמונות של Next"
du -sh /opt/ogen-play/.next/cache 2>/dev/null
du -sh /opt/ogen-play/.next/cache/images 2>/dev/null

echo
echo "סיום. התוצאה נשמרה ב-$OUT"
