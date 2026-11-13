#!/bin/bash
# מתקין את שירות ה-sentinel בשרת. מריצים כ-ubuntu (עם sudo) מתוך /opt/ogen-play/deploy/sentinel או מהתיקייה הזאת.
# אידמפוטנטי: אפשר להריץ שוב לעדכון הקוד. לא נוגע באתר ובנגינקס.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
sudo mkdir -p /opt/ogen-sentinel /etc/ogen-sentinel
sudo install -m 755 "$HERE/sentinel.py" /opt/ogen-sentinel/sentinel.py
[ -f /etc/ogen-sentinel/config.json ] || echo '{"mode": "observe"}' | sudo tee /etc/ogen-sentinel/config.json >/dev/null
# טווחי Cloudflare: לעולם לא נחסמים (מתעדכן בכל התקנה)
if C4=$(curl -fsS -m 15 https://www.cloudflare.com/ips-v4) && C6=$(curl -fsS -m 15 https://www.cloudflare.com/ips-v6); then
  { echo "# Cloudflare"; echo "$C4"; echo; echo "$C6"; } | sudo tee /etc/ogen-sentinel/cloudflare.txt >/dev/null
fi
sudo install -m 644 "$HERE/ogen-sentinel.service" /etc/systemd/system/ogen-sentinel.service
sudo python3 -m py_compile /opt/ogen-sentinel/sentinel.py
sudo systemctl daemon-reload
sudo systemctl enable ogen-sentinel >/dev/null 2>&1
sudo systemctl restart ogen-sentinel
sleep 3
systemctl is-active ogen-sentinel
sudo journalctl -u ogen-sentinel -n 5 --no-pager | cut -c1-200
