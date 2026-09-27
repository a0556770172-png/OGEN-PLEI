#!/usr/bin/env bash
# עדכון אוטומטי של האתר מ-GitHub. מותקן בשרת ב-/home/ubuntu/ogen-auto-deploy.sh ורץ כל 2 דקות מ-cron.
# אם יש commit חדש ב-main: מושך, מתקין חבילות (רק אם package-lock השתנה), בונה ומפעיל מחדש את השירות.
# אם הבנייה נכשלת - חוזר ל-commit הקודם ובונה אותו, כדי שהאתר לא יישאר שבור.
# הפעלה ידנית מיידית (גם בלי commit חדש): bash ~/ogen-auto-deploy.sh --force
# לוג: ~/ogen-deploy.log
set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

APP_DIR="/opt/ogen-play"
BRANCH="main"
SERVICE="ogen-play"
LOG="$HOME/ogen-deploy.log"
LOCK="/tmp/ogen-deploy.lock"

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

exec >> "$LOG" 2>&1
echo "===== $(date '+%F %T') deploying ${OLD:0:7} -> ${NEW:0:7} ====="

build() {
  # $1 = ה-commit שממנו באנו; מתקינים חבילות רק אם קובץ הנעילה השתנה (או שאין node_modules)
  if [ ! -d node_modules ] || ! git diff --quiet "$1" HEAD -- package-lock.json package.json; then
    npm ci --no-audit --no-fund || return 1
  fi
  npm run build
}

# .env.local, node_modules, backups/ וקבצים לא-במעקב אחרים לא נפגעים מ-reset
git reset -q --hard "origin/$BRANCH"

if build "$OLD"; then
  sudo systemctl restart "$SERVICE" && echo "OK: deployed ${NEW:0:7} at $(date '+%F %T')"
else
  echo "!! build failed on ${NEW:0:7} - rolling back to ${OLD:0:7}"
  git reset -q --hard "$OLD"
  build "$NEW" && sudo systemctl restart "$SERVICE"
  exit 1
fi
