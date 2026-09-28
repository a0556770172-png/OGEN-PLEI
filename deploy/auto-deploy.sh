#!/usr/bin/env bash
# עדכון אוטומטי של האתר מ-GitHub. מותקן בשרת ב-/home/ubuntu/ogen-auto-deploy.sh ורץ כל 2 דקות מ-cron.
# הפעלה ידנית מיידית (גם בלי commit חדש): bash ~/ogen-auto-deploy.sh --force
# לוג: ~/ogen-deploy.log
#
# איך זה עובד (בלי שהאתר ייפול בזמן העדכון):
# 1. הגרסה החדשה נבנית בתיקייה נפרדת (BUILD_DIR) - האתר החי ממשיך לרוץ כרגיל כל הזמן הזה.
#    (בעבר הבנייה הייתה בתוך תיקיית האתר החי, ובמשך 1-2 דקות משתמשים קיבלו שגיאות
#    "Cannot find module ... page.js" - עמודים שלא נטענים, התחברות שנכשלת וכו'.)
# 2. מיגרציות חדשות של בסיס הנתונים (supabase/migrations) רצות אוטומטית, כל אחת פעם אחת בלבד
#    (רשימת מה שכבר רץ: APPLIED_FILE). מיגרציה שנכשלת עוצרת את העדכון, והאתר נשאר בגרסה הקודמת.
# 3. רק אם הכול הצליח: מחליפים את תיקיית ה-.next בפעולה של רגע ומפעילים מחדש את השירות.
# 4. בדיקת תקינות: אם האתר לא עונה אחרי ההחלפה - חוזרים אוטומטית לגרסה הקודמת.
set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

APP_DIR="/opt/ogen-play"
BUILD_DIR="$HOME/ogen-play-build"
BRANCH="main"
SERVICE="ogen-play"
LOG="$HOME/ogen-deploy.log"
LOCK="/tmp/ogen-deploy.lock"
APPLIED_FILE="$HOME/ogen-applied-migrations.txt"
DB_CONTAINER="supabase-db"

# אם העדכון הקודם עוד רץ - לא מתחילים עוד אחד במקביל
exec 9>"$LOCK"
flock -n 9 || exit 0

cd "$APP_DIR" || exit 1
git fetch -q origin "$BRANCH" || { echo "$(date '+%F %T') git fetch failed" >> "$LOG"; exit 1; }

OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse "origin/$BRANCH")
if [ "$OLD" = "$NEW" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi
# גרסה שכבר נכשלה - לא מנסים שוב כל 2 דקות (זה היה מפעיל מחדש את האתר בלי סוף).
# מנסים שוב רק כשמגיע commit חדש, או בהפעלה ידנית עם --force.
FAILED_FILE="$HOME/ogen-deploy-failed.txt"
if [ "$(cat "$FAILED_FILE" 2>/dev/null)" = "$NEW" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi
fail() {
  echo "$1"
  echo "$NEW" > "$FAILED_FILE"
  exit 1
}

exec >> "$LOG" 2>&1
echo "===== $(date '+%F %T') deploying ${OLD:0:7} -> ${NEW:0:7} ====="

# ---------- 1. בנייה בתיקייה נפרדת ----------
if [ ! -d "$BUILD_DIR/.git" ] && [ ! -f "$BUILD_DIR/.git" ]; then
  git -C "$APP_DIR" worktree prune
  git -C "$APP_DIR" worktree add -q --detach "$BUILD_DIR" "$NEW" || fail "!! worktree add failed"
fi
cd "$BUILD_DIR" || exit 1
git checkout -q --force --detach "$NEW" || fail "!! checkout failed"
ln -sf "$APP_DIR/.env.local" "$BUILD_DIR/.env.local"

LOCK_HASH=$(sha1sum package-lock.json | cut -d' ' -f1)
if [ ! -d node_modules ] || [ "$(cat .deps-hash 2>/dev/null)" != "$LOCK_HASH" ]; then
  npm ci --no-audit --no-fund && echo "$LOCK_HASH" > .deps-hash || fail "!! npm ci failed on ${NEW:0:7} - live site untouched"
fi
rm -rf .next
if ! npm run build; then
  fail "!! build failed on ${NEW:0:7} - live site untouched (still ${OLD:0:7})"
fi

# ---------- 2. מיגרציות חדשות ----------
touch "$APPLIED_FILE"
for f in $(ls "$BUILD_DIR"/supabase/migrations/*.sql 2>/dev/null | sort); do
  name=$(basename "$f")
  grep -qxF "$name" "$APPLIED_FILE" && continue
  echo "-- applying migration $name"
  if sudo docker exec -i "$DB_CONTAINER" psql -U postgres -1 -v ON_ERROR_STOP=1 -q < "$f"; then
    echo "$name" >> "$APPLIED_FILE"
  else
    fail "!! migration $name failed - deploy stopped, live site untouched (still ${OLD:0:7})"
  fi
done

# ---------- 3. החלפה מהירה והפעלה מחדש ----------
cd "$APP_DIR" || exit 1
git reset -q --hard "$NEW"
# תלויות: רק אם השתנו (נדיר). קורה ממש לפני ההפעלה מחדש.
if [ ! -d node_modules ] || ! git diff --quiet "$OLD" "$NEW" -- package-lock.json package.json; then
  npm ci --no-audit --no-fund || echo "!! npm ci in live dir failed"
fi
rm -rf "$APP_DIR/.next.prev" "$APP_DIR/.next.new"
mv "$BUILD_DIR/.next" "$APP_DIR/.next.new"
mv "$APP_DIR/.next" "$APP_DIR/.next.prev" 2>/dev/null
mv "$APP_DIR/.next.new" "$APP_DIR/.next"
sudo systemctl restart "$SERVICE"

# ---------- 4. בדיקת תקינות + חזרה לגרסה הקודמת אם צריך ----------
healthy=0
for i in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ || true)
  if [ "$code" = "200" ]; then healthy=1; break; fi
done
if [ "$healthy" = "1" ]; then
  echo "OK: deployed ${NEW:0:7} at $(date '+%F %T')"
else
  echo "!! site not healthy after deploy of ${NEW:0:7} - rolling back to ${OLD:0:7}"
  git reset -q --hard "$OLD"
  if [ -d "$APP_DIR/.next.prev" ]; then
    rm -rf "$APP_DIR/.next.bad" && mv "$APP_DIR/.next" "$APP_DIR/.next.bad" && mv "$APP_DIR/.next.prev" "$APP_DIR/.next"
  fi
  sudo systemctl restart "$SERVICE"
  fail "!! rolled back from ${NEW:0:7}"
fi
