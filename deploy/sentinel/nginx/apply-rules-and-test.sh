#!/bin/bash
# deploy the CSRF origin rule (nginx) + updated sentinel; validated + rollback on failure
set -u
TS=$(date +%Y%m%d-%H%M%S)
sudo tar czf /root/nginx-backup-pre-csrf-$TS.tgz -C /etc nginx
rollback() { echo "!! ROLLBACK"; sudo rm -rf /etc/nginx; sudo tar xzf /root/nginx-backup-pre-csrf-$TS.tgz -C /etc; sudo nginx -t && sudo systemctl reload nginx; exit 1; }
sudo install -m 644 ~/04-ogen-security.conf /etc/nginx/conf.d/04-ogen-security.conf
# 04 duplicates are removed by the earlier apply (timeouts live in 03)
sudo sed -i -E '/^(client_header_timeout|client_body_timeout|send_timeout)\s/d' /etc/nginx/conf.d/04-ogen-security.conf
sudo install -m 644 ~/ogen-waf.snippet.conf /etc/nginx/snippets/ogen-waf.conf
sudo nginx -t 2>&1 | tail -1 || rollback
sudo nginx -t >/dev/null 2>&1 || rollback
sudo systemctl reload nginx
sleep 1
R="--resolve ogenplay.com:443:127.0.0.1"
t() { printf "%-52s -> " "$1"; shift; curl -sk -m 10 -o /dev/null -w '%{http_code}\n' "$@" 2>&1 || true; }
t "normal GET"                                     $R https://ogenplay.com/
t "POST same-origin (login-like, 401/400 ok)"      $R -X POST -H 'Origin: https://ogenplay.com' -H 'Content-Type: application/json' -d '{}' https://ogenplay.com/api/auth/email-exists
t "POST no Origin (app/server-to-server)"          $R -X POST -H 'Content-Type: application/json' -d '{}' https://ogenplay.com/api/auth/email-exists
t "POST chrome-extension origin"                   $R -X POST -H 'Origin: chrome-extension://abcdef' -H 'Content-Type: application/json' -d '{}' https://ogenplay.com/api/auth/email-exists
t "POST foreign origin (CSRF) -> expect 403"       $R -X POST -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -d '{}' https://ogenplay.com/api/auth/email-exists
t "POST Origin:null (sandboxed) -> expect 403"     $R -X POST -H 'Origin: null' -H 'Content-Type: application/json' -d '{}' https://ogenplay.com/api/auth/email-exists
t "OPTIONS preflight foreign (not state-changing)" $R -X OPTIONS -H 'Origin: https://evil.example' https://ogenplay.com/api/auth/email-exists
t "GET with foreign origin (reads allowed)"        $R -H 'Origin: https://evil.example' https://ogenplay.com/forum
t "POST foreign origin to a PAGE (not /api) -> ok" $R -X POST -H 'Origin: https://evil.example' https://ogenplay.com/forum
t "Next-Action header (server-actions probe) -> 403" $R -X POST -H 'Next-Action: 7f1234567890abcdef' -H 'Content-Type: text/plain;charset=UTF-8' -d '[]' https://ogenplay.com/
t "normal RSC navigation (RSC: 1) -> 200"          $R -H 'RSC: 1' https://ogenplay.com/forum
A="--resolve api.ogenplay.com:443:127.0.0.1"
t "Studio via /api/sb/ (must be 404)"              $R https://ogenplay.com/api/sb/
t "Studio project page via proxy (404)"            $R https://ogenplay.com/api/sb/project/default
t "pg-meta via proxy (404)"                        $R https://ogenplay.com/api/sb/pg/tables
t "analytics via proxy (404)"                      $R https://ogenplay.com/api/sb/analytics/v1/health
t "auth settings via proxy (still reaches API)"    $R https://ogenplay.com/api/sb/auth/v1/settings
t "rest via proxy (still reaches API)"             $R https://ogenplay.com/api/sb/rest/v1/profiles
t "storage via proxy (still reaches API)"          $R https://ogenplay.com/api/sb/storage/v1/bucket
t "api host root = Studio (must be 404)"           $A https://api.ogenplay.com/
t "api host /project/default (404)"                $A https://api.ogenplay.com/project/default
t "api host auth (still reaches API)"              $A https://api.ogenplay.com/auth/v1/settings
t "api host realtime ping (still reaches API)"     $A https://api.ogenplay.com/realtime/v1/api/ping
echo "nginx: $(systemctl is-active nginx)"
