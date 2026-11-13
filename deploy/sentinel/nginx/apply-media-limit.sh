#!/bin/bash
# Images (/_next/image, /api/cdn) were rate-limited like page navigations (15 r/s, burst 40): a page with 60 icons fired a burst that got 429s
# (996 broken-image responses to real users in one day). Cached hits are cheap; give media its own, much higher limit.
set -u
TS=$(date +%Y%m%d-%H%M%S)
sudo tar czf /root/nginx-backup-pre-media-$TS.tgz -C /etc nginx
rollback() { echo "!! ROLLBACK"; sudo rm -rf /etc/nginx; sudo tar xzf /root/nginx-backup-pre-media-$TS.tgz -C /etc; sudo nginx -t && sudo systemctl reload nginx; exit 1; }
if ! grep -q 'ogen_media_v2' /etc/nginx/conf.d/03-ddos-protection.conf; then
  echo 'limit_req_zone $ogen_limit_key zone=ogen_media_v2:10m rate=60r/s;' | sudo tee -a /etc/nginx/conf.d/03-ddos-protection.conf >/dev/null
fi
sudo awk '
  /^[[:space:]]*location (\/_next\/image|\/api\/cdn\/) \{/ { inmedia=1 }
  /^[[:space:]]*location / && !/\/_next\/image|\/api\/cdn\// { inmedia=0 }
  { if (inmedia && $0 ~ /limit_req zone=ogen_general_v2 burst=40 nodelay;/) { sub(/zone=ogen_general_v2 burst=40/, "zone=ogen_media_v2 burst=250"); } print }
' /etc/nginx/sites-enabled/ogen-play | sudo tee /tmp/ogen-play.media >/dev/null && sudo cp /tmp/ogen-play.media /etc/nginx/sites-enabled/ogen-play
grep -nE "location (/_next/image|/api/cdn/)|ogen_media_v2" /etc/nginx/sites-enabled/ogen-play
sudo nginx -t 2>&1 | tail -1
sudo nginx -t >/dev/null 2>&1 || rollback
sudo systemctl reload nginx
sleep 1
# proof: a burst of 120 image requests (what a heavy page can fire) from a NON-exempt source IP can't be simulated locally (exempt), so check config effect via limit values
sudo nginx -T 2>/dev/null | grep -E "limit_req_zone.*(general|media)" | cut -c1-100
printf "site -> "; curl -sk -m 10 --resolve ogenplay.com:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://ogenplay.com/
