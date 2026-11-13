#!/bin/bash
# Applies the nginx security layer with full backup, syntax check, graceful reload, and automatic rollback on failure.
set -u
TS=$(date +%Y%m%d-%H%M%S)
BK=/root/nginx-backup-pre-sec-$TS.tgz
sudo tar czf $BK -C /etc nginx
echo "backup: $BK"
rollback() { echo "!! ROLLBACK"; sudo rm -rf /etc/nginx; sudo tar xzf $BK -C /etc; sudo nginx -t && sudo systemctl reload nginx; exit 1; }

# --- 1. main files
sudo install -m 644 ~/04-ogen-security.conf /etc/nginx/conf.d/04-ogen-security.conf
sudo mkdir -p /etc/nginx/snippets
sudo install -m 644 ~/ogen-waf.snippet.conf /etc/nginx/snippets/ogen-waf.conf
# duplicate timeouts live in 03: tighten there instead
sudo sed -i -E 's/^client_header_timeout\s+15s;/client_header_timeout 10s;/' /etc/nginx/conf.d/03-ddos-protection.conf
sudo sed -i -E '/^(client_header_timeout|client_body_timeout|send_timeout)\s/d' /etc/nginx/conf.d/04-ogen-security.conf

# --- 2. Cloudflare real client IP (only trusted when the connection comes from Cloudflare's own ranges)
CF4=$(curl -fsS -m 15 https://www.cloudflare.com/ips-v4 || true)
CF6=$(curl -fsS -m 15 https://www.cloudflare.com/ips-v6 || true)
if [ -n "$CF4" ] && [ -n "$CF6" ]; then
  { echo "# כתובת הלקוח האמיתית מאחורי Cloudflare (נאמן רק כשהחיבור מגיע מטווחי Cloudflare עצמם)"
    for r in $CF4 $CF6; do echo "set_real_ip_from $r;"; done
    echo "real_ip_header CF-Connecting-IP;"
    echo "real_ip_recursive off;"; } | sudo tee /etc/nginx/conf.d/00-ogen-realip.conf >/dev/null
  echo "cloudflare ranges: $(echo $CF4 $CF6 | wc -w)"
else echo "WARN: could not fetch Cloudflare ranges - real_ip not configured"; fi

# --- 3. catch-all default server: unknown Host / bare-IP scans get dropped, no certificate shown
sudo tee /etc/nginx/conf.d/05-ogen-default.conf >/dev/null <<'EOF'
# כל בקשה שלא מיועדת לדומיינים שלנו (סריקות לפי כתובת IP, Host מזויף) - ניתוק מיידי בלי תעודה ובלי תשובה.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
    return 444;
}
EOF

# --- 4. hook the WAF snippet + auth limit into the site configs (idempotent)
for f in /etc/nginx/sites-enabled/ogen-play /etc/nginx/sites-enabled/ogen-play-api; do
  if ! sudo grep -q 'snippets/ogen-waf.conf' "$f"; then
    sudo sed -i -E '0,/^(\s*)limit_conn ogen_addr_v2 40;/s//\1limit_conn ogen_addr_v2 40;\n\1include snippets\/ogen-waf.conf;/' "$f"
  fi
done
if ! sudo grep -q 'ogen_authsb_v2' /etc/nginx/sites-enabled/ogen-play; then
  sudo awk '
    /^[[:space:]]*location \/ \{/ { inroot=1 }
    { print }
    inroot && /limit_req zone=ogen_general_v2/ { match($0,/^[[:space:]]*/); ind=substr($0,1,RLENGTH); print ind "limit_req zone=ogen_authsb_v2 burst=8 nodelay;"; inroot=0 }
  ' /etc/nginx/sites-enabled/ogen-play | sudo tee /tmp/ogen-play.new >/dev/null && sudo cp /tmp/ogen-play.new /etc/nginx/sites-enabled/ogen-play
fi
# buffered main access log (less disk I/O per request)
sudo sed -i -E 's#^(\s*)access_log /var/log/nginx/access.log;#\1access_log /var/log/nginx/access.log combined buffer=32k flush=2s;#' /etc/nginx/nginx.conf

# --- 5. validate + graceful reload
if ! sudo nginx -t 2>/tmp/nginx-t.txt; then echo "nginx -t FAILED:"; cat /tmp/nginx-t.txt; rollback; fi
sudo nginx -t 2>&1 | tail -1
sudo systemctl reload nginx
sleep 2
sudo tail -3 /var/log/nginx/error.log | cut -c1-200
echo "workers: $(pgrep -f 'nginx: worker' | tr '\n' ' ')"

# --- 6. functional tests through nginx (TLS, real hostnames, local = exempt from rate limits)
t() { printf "%-46s -> " "$1"; shift; curl -sk -m 10 -o /dev/null -w '%{http_code}\n' "$@" 2>&1 || true; }
R="--resolve ogenplay.com:443:127.0.0.1 --resolve www.ogenplay.com:443:127.0.0.1 --resolve api.ogenplay.com:443:127.0.0.1"
t "home page"                        $R https://ogenplay.com/
t "forum"                            $R https://ogenplay.com/forum
t "www"                              $R https://www.ogenplay.com/
t "search api"                       $R "https://ogenplay.com/api/apps/search?q=waze"
t "hebrew search"                    $R "https://ogenplay.com/api/apps/search?q=%D7%95%D7%95%D7%99%D7%96"
t "static chunk"                     $R https://ogenplay.com/_next/static/chunks/webpack-0aa2005544f9264f.js
t "api gateway (401 expected)"       $R https://api.ogenplay.com/
t "scan /.env (444=000)"             $R https://ogenplay.com/.env
t "scan /wp-login.php (444=000)"     $R https://ogenplay.com/wp-login.php
t "sqli union select (403)"          $R "https://ogenplay.com/api/apps/search?q=1%20union%20select%20password%20from%20users"
t "xss <script> (403)"               $R "https://ogenplay.com/forum?x=%3Cscript%3Ealert(1)%3C/script%3E"
t "lfi ../../etc/passwd (403)"       $R "https://ogenplay.com/api/cdn/..%2f..%2fetc/passwd"
t "log4shell jndi (403)"             $R -A 'x' -H 'X-Test: 1' "https://ogenplay.com/?q=\${jndi:ldap://x/a}"
t "bad scanner UA sqlmap (000)"      $R -A 'sqlmap/1.7' https://ogenplay.com/
t "x-middleware-subrequest (400)"    $R -H 'x-middleware-subrequest: middleware' https://ogenplay.com/
t "bare IP / wrong Host (000)"       -H 'Host: evil.example' https://127.0.0.1/
printf "%-46s -> " "http->https redirect"; curl -s -m 10 -o /dev/null -w '%{http_code} %{redirect_url}\n' --resolve ogenplay.com:80:127.0.0.1 http://ogenplay.com/
echo "== json log sample"; sudo tail -2 /var/log/nginx/ogen_json.log | cut -c1-330
