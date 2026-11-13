#!/bin/bash
# runs the sentinel replay against real historical logs; prints a compact summary
cd ~
(curl -fsS -m 15 https://www.cloudflare.com/ips-v4; echo; curl -fsS -m 15 https://www.cloudflare.com/ips-v6) | grep -E '^[0-9a-f:./]+$' > cf.txt
echo "cloudflare ranges: $(wc -l < cf.txt)"
python3 -m py_compile sentinel.py || exit 1
LOGS="${@:-/mnt/ogen/var/log/nginx/access.log.1 /mnt/ogen/var/log/nginx/access.log}"
sudo python3 sentinel.py --replay $LOGS --whitelist 84.13.81.124 --whitelist-file cf.txt > /tmp/replay.json
python3 - <<'EOF'
import json
r = json.load(open('/tmp/replay.json'))
print(f"lines={r['lines']} secs={r['seconds']} ({r['lines_per_sec']}/s) unique_ips={r['unique_ips']} flagged={r['flagged_ips']} blocked={r['blocked_ips']}")
print("events:", r['events_by_type'])
print("period:", r['period'])
print("--- top flagged (ip | hits | types | blocks | tool | first path)")
for t in r['top_flagged'][:12]:
    print(f"{t['ip']:<16} {t['hits']:>6} {json.dumps(t['types'], ensure_ascii=False):<60} blocks={t['blocks']} {t['tool']:<8} {t['paths'][:2]}")
print("--- rare samples")
for k, v in r.get('rare_samples', {}).items():
    for s in v[:3]:
        print(f"[{k}] {s['ip']} {s['status']} {s['path'][:90]} {json.dumps(s['details'], ensure_ascii=False)[:120]}")
print("--- global events:", [ (e['type'], e['details']) for e in r['global_events'] ][:5])
EOF
